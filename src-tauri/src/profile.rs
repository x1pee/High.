use fs2::FileExt;
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Component, Path, PathBuf},
    sync::Mutex,
    time::UNIX_EPOCH,
};
use tauri::Manager;

pub struct Profile {
    pub root: PathBuf,
    pub isolated: bool,
    pub gate: Mutex<()>,
    _lock: File,
}

impl Profile {
    pub fn init(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let isolated = std::env::var_os("VYSHE_DATA_DIR");
        let root = if let Some(ref path) = isolated {
            PathBuf::from(path)
        } else {
            #[cfg(desktop)]
            {
                // Preserve existing journals and preferences across the High. rename.
                app.path().config_dir()?.join("Vyshe")
            }
            #[cfg(mobile)]
            {
                app.path().app_data_dir()?
            }
        };
        fs::create_dir_all(&root)?;
        let root = fs::canonicalize(root)?;
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(root.join(".tauri-profile.lock"))?;
        lock.try_lock_exclusive()
            .map_err(|_| io::Error::other("Дневник уже открыт в другом экземпляре приложения"))?;
        Ok(Self {
            root,
            isolated: isolated.is_some(),
            gate: Mutex::new(()),
            _lock: lock,
        })
    }

    pub fn resolve(&self, relative: &str) -> io::Result<PathBuf> {
        // Narrow allowlist, no drive letters, UNC, traversal or arbitrary files.
        let parts: Vec<_> = relative.split('/').collect();
        let allowed = match parts.as_slice() {
            ["graphs" | "backups" | "deleted-graphs"] => true,
            [name] => {
                ["journal.json", "journal.json.tmp"].contains(name)
                    || (name.starts_with("damaged-") && name.ends_with(".json"))
            }
            ["graphs" | "backups" | "deleted-graphs", name] => {
                name.ends_with(".json") || name.ends_with(".json.tmp")
            }
            _ => false,
        };
        if !allowed
            || relative.contains(['\\', ':'])
            || Path::new(relative)
                .components()
                .any(|c| !matches!(c, Component::Normal(_)))
        {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "Недопустимый путь дневника",
            ));
        }
        let mut result = self.root.clone();
        for part in parts {
            result.push(part);
            match fs::symlink_metadata(&result) {
                Ok(_) if !fs::canonicalize(&result)?.starts_with(&self.root) => {
                    return Err(io::Error::new(
                        io::ErrorKind::PermissionDenied,
                        "Путь вне папки дневника",
                    ))
                }
                Ok(_) => {}
                Err(e) if e.kind() == io::ErrorKind::NotFound => {}
                Err(e) => return Err(e),
            }
        }
        Ok(result)
    }
}

pub fn atomic(path: &Path, data: &[u8]) -> io::Result<()> {
    let mut temp = tempfile::NamedTempFile::new_in(
        path.parent()
            .ok_or_else(|| io::Error::other("Missing parent"))?,
    )?;
    temp.write_all(data)?;
    temp.as_file().sync_all()?;
    temp.persist(path).map_err(|e| e.error)?;
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct IoError {
    code: &'static str,
    message: String,
}
impl From<io::Error> for IoError {
    fn from(e: io::Error) -> Self {
        Self {
            code: if e.kind() == io::ErrorKind::NotFound {
                "ENOENT"
            } else {
                "EIO"
            },
            message: e.to_string(),
        }
    }
}

#[tauri::command]
pub fn profile_io(
    state: tauri::State<'_, Profile>,
    op: String,
    file: String,
    data: Option<String>,
    target: Option<String>,
) -> Result<Value, IoError> {
    let _guard = state
        .gate
        .lock()
        .map_err(|_| io::Error::other("Хранилище занято"))?;
    let path = state.resolve(&file)?;
    let dest = || {
        state.resolve(
            target
                .as_deref()
                .ok_or_else(|| io::Error::other("Missing destination"))?,
        )
    };
    match op.as_str() {
        "mkdir" => {
            fs::create_dir_all(path)?;
        }
        "read" => {
            if fs::metadata(&path)?.len() > 64 * 1024 * 1024 {
                return Err(io::Error::other("Файл слишком большой").into());
            }
            return Ok(json!(fs::read_to_string(path)?));
        }
        "write" => {
            let data = data.ok_or_else(|| io::Error::other("Missing data"))?;
            if data.len() > 64 * 1024 * 1024 {
                return Err(io::Error::other("Файл слишком большой").into());
            }
            atomic(&path, data.as_bytes())?;
        }
        "list" => {
            return Ok(json!(fs::read_dir(path)?
                .map(|entry| entry.map(|e| e.file_name().to_string_lossy().to_string()))
                .collect::<io::Result<Vec<_>>>()?))
        }
        "remove" => fs::remove_file(path)?,
        "access" => {
            fs::metadata(path)?;
        }
        "copy" => {
            atomic(&dest()?, &fs::read(path)?)?;
        }
        "rename" => {
            // Replacement must work on Windows too; never remove the old target first.
            atomic(&dest()?, &fs::read(&path)?)?;
            fs::remove_file(path)?;
        }
        "stat" => {
            return Ok(json!(fs::metadata(path)?
                .modified()?
                .duration_since(UNIX_EPOCH)
                .map_err(io::Error::other)?
                .as_millis() as u64))
        }
        _ => return Err(io::Error::other("Unknown profile operation").into()),
    }
    Ok(Value::Null)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn replacement_preserves_complete_document() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("journal.json");
        atomic(&path, b"old").unwrap();
        atomic(&path, b"new").unwrap();
        assert_eq!(fs::read(path).unwrap(), b"new");
    }
    #[test]
    fn profile_paths_are_scoped() {
        let dir = tempfile::tempdir().unwrap();
        let lock = File::create(dir.path().join("lock")).unwrap();
        let profile = Profile {
            root: fs::canonicalize(dir.path()).unwrap(),
            isolated: true,
            gate: Mutex::new(()),
            _lock: lock,
        };
        for path in [
            "../journal.json",
            "C:/journal.json",
            "graphs/../../secret.json",
            "preferences.json",
            "graphs/evil\\name.json",
        ] {
            assert!(profile.resolve(path).is_err(), "{path}");
        }
        assert!(profile.resolve("journal.json").is_ok());
        assert!(profile.resolve("graphs/abc.json").is_ok());
    }
}
