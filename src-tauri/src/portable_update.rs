use std::{path::PathBuf, sync::Mutex, time::Duration};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const MAX_UPDATE_BYTES: usize = 50 * 1024 * 1024;

#[derive(Default)]
pub struct PortableUpdater {
    pending: Mutex<Option<Update>>,
    staged: Mutex<Option<PathBuf>>,
}

#[tauri::command]
pub async fn check_portable_update(
    app: AppHandle,
    state: State<'_, PortableUpdater>,
) -> Result<Option<serde_json::Value>, String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, state);
        return Ok(None);
    }

    #[cfg(target_os = "windows")]
    {
        let update = app
            .updater_builder()
            .build()
            .map_err(|error| format!("Не удалось подготовить проверку обновлений: {error}"))?
            .check()
            .await
            .map_err(|error| format!("Не удалось проверить обновления: {error}"))?;

        if let Some(update) = &update {
            let expected_url = format!(
                "https://github.com/x1pee/High./releases/download/v{}/High_{}_x64.exe",
                update.version, update.version
            );
            if update.download_url.as_str() != expected_url {
                return Err("Адрес файла обновления не совпадает с Windows-релизом".into());
            }
        }

        let result = update.as_ref().map(|update| {
            let display_version = update
                .raw_json
                .get("display_version")
                .and_then(serde_json::Value::as_str)
                .filter(|value| !value.is_empty())
                .unwrap_or(&update.version);
            serde_json::json!({
                "version": update.version,
                "displayVersion": display_version,
                "notes": update.body,
            })
        });
        *state
            .pending
            .lock()
            .map_err(|_| "Состояние обновления недоступно".to_string())? = update;
        Ok(result)
    }
}

#[tauri::command]
pub async fn download_portable_update(
    app: AppHandle,
    state: State<'_, PortableUpdater>,
) -> Result<serde_json::Value, String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, state);
        return Err("Обновления Windows доступны только в Windows-версии".into());
    }

    #[cfg(target_os = "windows")]
    {
        let update = state
            .pending
            .lock()
            .map_err(|_| "Состояние обновления недоступно".to_string())?
            .clone()
            .ok_or_else(|| "Сначала проверь наличие обновления".to_string())?;
        let mut started = false;
        let progress_app = app.clone();
        let bytes = update
            .download(
                move |chunk_length, content_length| {
                    if !started {
                        let _ = progress_app.emit(
                            "portable-update-progress",
                            serde_json::json!({
                                "event": "Started",
                                "data": { "contentLength": content_length },
                            }),
                        );
                        started = true;
                    }
                    let _ = progress_app.emit(
                        "portable-update-progress",
                        serde_json::json!({
                            "event": "Progress",
                            "data": { "chunkLength": chunk_length },
                        }),
                    );
                },
                || {},
            )
            .await
            .map_err(|error| {
                format!("Не удалось загрузить или проверить подпись обновления: {error}")
            })?;
        if bytes.len() > MAX_UPDATE_BYTES || !bytes.starts_with(b"MZ") {
            return Err("Загруженный файл не похож на Windows-приложение".into());
        }

        let current = std::env::current_exe().map_err(|error| error.to_string())?;
        let parent = current
            .parent()
            .ok_or_else(|| "Не удалось определить папку приложения".to_string())?;
        let file_name = current
            .file_name()
            .ok_or_else(|| "Не удалось определить имя приложения".to_string())?
            .to_string_lossy();
        let staged = parent.join(format!("{file_name}.update-{}", std::process::id()));
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&staged)
            .map_err(|error| {
                format!("Не удалось сохранить обновление рядом с приложением: {error}")
            })?;
        use std::io::Write;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|error| format!("Не удалось записать обновление: {error}"))?;
        *state
            .staged
            .lock()
            .map_err(|_| "Состояние обновления недоступно".to_string())? = Some(staged);
        Ok(serde_json::json!({
            "size": bytes.len(),
            "version": update.raw_json.get("display_version")
                .and_then(serde_json::Value::as_str)
                .unwrap_or(&update.version),
        }))
    }
}

#[cfg(target_os = "windows")]
fn powershell_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[tauri::command]
pub fn install_portable_update(
    app: AppHandle,
    state: State<'_, PortableUpdater>,
) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, state);
        return Err("Обновления Windows доступны только в Windows-версии".into());
    }

    #[cfg(target_os = "windows")]
    {
        use std::{os::windows::process::CommandExt, process::Command, thread};

        let staged = state
            .staged
            .lock()
            .map_err(|_| "Состояние обновления недоступно".to_string())?
            .clone()
            .ok_or_else(|| "Сначала загрузи обновление".to_string())?;
        let target = std::env::current_exe().map_err(|error| error.to_string())?;
        if staged.parent() != target.parent() || !staged.is_file() {
            return Err("Временный файл обновления не найден рядом с приложением".into());
        }

        let target_literal = powershell_literal(&target.to_string_lossy());
        let staged_literal = powershell_literal(&staged.to_string_lossy());
        let process_id = std::process::id();
        let script = format!(
            "$ErrorActionPreference='Stop'\n$target={target_literal}\n$staged={staged_literal}\n$pidToWait={process_id}\n$backup=\"$target.high-backup-$pidToWait\"\nfor($i=0;$i -lt 160;$i++){{if(-not(Get-Process -Id $pidToWait -ErrorAction SilentlyContinue)){{break}};Start-Sleep -Milliseconds 250}}\nif(Get-Process -Id $pidToWait -ErrorAction SilentlyContinue){{exit 10}}\ntry{{Move-Item -LiteralPath $target -Destination $backup;Move-Item -LiteralPath $staged -Destination $target;Start-Process -FilePath $target -WorkingDirectory (Split-Path -Parent $target);Start-Sleep -Milliseconds 500;Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue}}catch{{if(Test-Path -LiteralPath $backup){{if(Test-Path -LiteralPath $target){{Remove-Item -LiteralPath $target -Force}};Move-Item -LiteralPath $backup -Destination $target -ErrorAction SilentlyContinue}};if(Test-Path -LiteralPath $target){{Start-Process -FilePath $target -WorkingDirectory (Split-Path -Parent $target) -ErrorAction SilentlyContinue}};exit 11}}\nRemove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue\n"
        );
        let script_path = std::env::temp_dir().join(format!("high-update-{process_id}.ps1"));
        std::fs::write(&script_path, script)
            .map_err(|error| format!("Не удалось подготовить замену приложения: {error}"))?;
        Command::new("powershell.exe")
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-File",
            ])
            .arg(&script_path)
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|error| format!("Не удалось запустить замену приложения: {error}"))?;
        *state
            .staged
            .lock()
            .map_err(|_| "Состояние обновления недоступно".to_string())? = None;
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(700));
            app.exit(0);
        });
        Ok(())
    }
}
