use crate::profile::{atomic, Profile};
use serde_json::{json, Value};
#[cfg(mobile)]
use std::io::Write;
use std::{fs, io::Read, path::PathBuf};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

#[derive(Default)]
pub struct Lifecycle {
    pub ready: std::sync::atomic::AtomicBool,
    pub may_close: std::sync::atomic::AtomicBool,
}

#[tauri::command]
pub fn ui_ready(state: tauri::State<'_, Lifecycle>) {
    state.ready.store(true, std::sync::atomic::Ordering::SeqCst);
}

fn read_preferences(profile: &Profile) -> Result<Value, String> {
    let mut value = json!({ "initialized": cfg!(mobile), "autoStart": false, "tray": false, "autoUpdates": false });
    match fs::read(profile.root.join("preferences.json")) {
        Ok(bytes) => {
            let stored: Value = serde_json::from_slice(&bytes)
                .map_err(|e| format!("Повреждены настройки приложения: {e}"))?;
            for key in ["initialized", "autoStart", "tray", "autoUpdates"] {
                if let Some(flag) = stored[key].as_bool() {
                    value[key] = json!(flag);
                }
            }
            if let Some(path) = stored["shortcutTarget"].as_str() {
                value["shortcutTarget"] = json!(path);
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.to_string()),
    }
    Ok(value)
}

fn executable() -> Result<PathBuf, String> {
    #[cfg(target_os = "linux")]
    if let Some(path) = std::env::var_os("APPIMAGE") {
        return Ok(PathBuf::from(path));
    }
    std::env::current_exe().map_err(|e| e.to_string())
}

fn shortcut_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        return app.path().desktop_dir().ok().map(|p| p.join("VYSHE.lnk"));
    }
    #[cfg(target_os = "linux")]
    {
        return app
            .path()
            .desktop_dir()
            .ok()
            .map(|p| p.join("VYSHE.desktop"));
    }
    #[allow(unreachable_code)]
    {
        let _ = app;
        None
    }
}

#[tauri::command]
pub fn preferences(
    app: tauri::AppHandle,
    state: tauri::State<'_, Profile>,
) -> Result<Value, String> {
    let _guard = state.gate.lock().map_err(|e| e.to_string())?;
    let mut prefs = read_preferences(&state)?;
    let executable = executable()?.to_string_lossy().to_string();
    let exists = shortcut_path(&app).is_some_and(|path| path.exists());
    prefs["desktopShortcutExists"] = json!(exists);
    prefs["desktopShortcutMatches"] =
        json!(exists && prefs["shortcutTarget"].as_str() == Some(&executable));
    prefs["platform"] = json!(if cfg!(mobile) {
        "mobile"
    } else if cfg!(windows) {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    });
    prefs["portable"] = json!(cfg!(windows) && option_env!("VYSHE_INSTALLED_BUILD") != Some("1"));
    prefs["dataPath"] = json!(state.root.to_string_lossy());
    prefs["executable"] = json!(executable);
    Ok(prefs)
}

fn startup(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        let root = RegKey::predef(HKEY_CURRENT_USER);
        let (run, _) = root
            .create_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")
            .map_err(|e| e.to_string())?;
        // Reuse the existing entry: migration must not create duplicate launches.
        if enabled {
            run.set_value(
                "electron.app.Vyshe",
                &format!("\"{}\" --background", executable()?.display()),
            )
            .map_err(|e| e.to_string())?;
        } else if let Err(e) = run.delete_value("electron.app.Vyshe") {
            if e.kind() != std::io::ErrorKind::NotFound {
                return Err(e.to_string());
            }
        }
    }
    #[cfg(all(desktop, not(windows)))]
    {
        use tauri_plugin_autostart::ManagerExt;
        if enabled {
            app.autolaunch().enable()
        } else {
            app.autolaunch().disable()
        }
        .map_err(|e| e.to_string())?;
    }
    let _ = (app, enabled);
    Ok(())
}

fn create_shortcut(app: &tauri::AppHandle) -> Result<(), String> {
    let file = shortcut_path(app).ok_or("Ярлык недоступен на этой платформе")?;
    let exe = executable()?;
    #[cfg(windows)]
    mslnk::ShellLink::new(&exe)
        .and_then(|link| link.create_lnk(&file))
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::PermissionsExt;
        let escaped = exe
            .to_string_lossy()
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('`', "\\`")
            .replace('$', "\\$")
            .replace('%', "%%");
        atomic(&file, format!("[Desktop Entry]\nType=Application\nName=High.\nExec=\"{escaped}\"\nTerminal=false\nCategories=Office;\n").as_bytes()).map_err(|e| e.to_string())?;
        fs::set_permissions(&file, fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
    }
    let _ = (file, exe);
    Ok(())
}

#[tauri::command]
pub fn configure(
    app: tauri::AppHandle,
    state: tauri::State<'_, Profile>,
    data: Value,
) -> Result<Value, String> {
    if cfg!(mobile) {
        return Err("Настройки запуска управляются системой телефона".into());
    }
    let _guard = state.gate.lock().map_err(|e| e.to_string())?;
    let previous = read_preferences(&state)?;
    let mut next = previous.clone();
    for name in ["autoStart", "tray", "autoUpdates"] {
        if let Some(value) = data.get(name) {
            next[name] = json!(value.as_bool().ok_or("Некорректная настройка")?);
        }
    }
    next["initialized"] = json!(true);
    next["tray"] = json!(next["autoStart"] == true && next["tray"] == true);
    if !state.isolated {
        if data["shortcut"] == true {
            create_shortcut(&app)?;
            next["shortcutTarget"] = json!(executable()?.to_string_lossy());
        }
        startup(&app, next["autoStart"] == true)?;
    }
    if let Err(e) = atomic(
        &state.root.join("preferences.json"),
        serde_json::to_string_pretty(&next).unwrap().as_bytes(),
    ) {
        if !state.isolated {
            let _ = startup(&app, previous["autoStart"] == true);
        }
        return Err(e.to_string());
    }
    Ok(next)
}

#[tauri::command]
pub fn window_action(app: tauri::AppHandle, action: String) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Окно недоступно")?;
    match action.as_str() {
        #[cfg(desktop)]
        "minimize" => window.minimize(),
        #[cfg(desktop)]
        "maximize" => {
            if window.is_maximized().map_err(|e| e.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "close" => {
            app.state::<Lifecycle>()
                .may_close
                .store(true, std::sync::atomic::Ordering::SeqCst);
            window.close()
        }
        _ => return Err("Неизвестное действие окна".into()),
    }
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_journal(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = app
            .dialog()
            .file()
            .add_filter("Дневник JSON", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let mut options = tauri_plugin_fs::OpenOptions::new();
        options.read(true);
        let file = app
            .fs()
            .open(path.clone(), options)
            .map_err(|e| e.to_string())?;
        let mut content = String::new();
        let result = file
            .take(32 * 1024 * 1024 + 1)
            .read_to_string(&mut content)
            .map_err(|e| e.to_string());
        #[cfg(target_os = "ios")]
        {
            let _ = app.fs().stop_accessing_security_scoped_resource(path);
        }
        result?;
        if content.len() > 32 * 1024 * 1024 {
            return Err("Файл слишком большой".into());
        }
        Ok(Some(content))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn export_journal(app: tauri::AppHandle, data: String) -> Result<bool, String> {
    if data.len() > 64 * 1024 * 1024 {
        return Err("Файл слишком большой".into());
    }
    serde_json::from_str::<Value>(&data).map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = app
            .dialog()
            .file()
            .add_filter("Дневник JSON", &["json"])
            .set_file_name("High-journal.json")
            .blocking_save_file()
        else {
            return Ok(false);
        };
        #[cfg(desktop)]
        {
            let target = path.clone().into_path().map_err(|e| e.to_string())?;
            let parent = target
                .parent()
                .ok_or("Нет папки назначения")?
                .canonicalize()
                .map_err(|e| e.to_string())?;
            if parent.starts_with(&app.state::<Profile>().root)
                || target
                    .canonicalize()
                    .is_ok_and(|p| p.starts_with(&app.state::<Profile>().root))
            {
                return Err("Сохрани экспорт вне служебной папки дневника".into());
            }
            atomic(&target, data.as_bytes()).map_err(|e| e.to_string())?;
        }
        #[cfg(mobile)]
        {
            let mut options = tauri_plugin_fs::OpenOptions::new();
            options.write(true).create(true).truncate(true);
            let mut file = app
                .fs()
                .open(path.clone(), options)
                .map_err(|e| e.to_string())?;
            let result = file
                .write_all(data.as_bytes())
                .and_then(|_| file.sync_all())
                .map_err(|e| e.to_string());
            drop(file);
            #[cfg(target_os = "ios")]
            {
                let _ = app.fs().stop_accessing_security_scoped_resource(path);
            }
            result?;
        }
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_backups(
    app: tauri::AppHandle,
    state: tauri::State<'_, Profile>,
) -> Result<String, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener()
            .open_path(
                state.root.join("backups").to_string_lossy().to_string(),
                None::<&str>,
            )
            .map_err(|e| e.to_string())?;
        Ok(String::new())
    }
    #[cfg(mobile)]
    {
        let _ = (app, state);
        Ok("Сохрани резервную копию через экспорт JSON в Файлы".into())
    }
}

pub fn setup(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<Profile>();
    let prefs = read_preferences(&state).map_err(std::io::Error::other)?;
    let window = app.get_webview_window("main").ok_or("Missing window")?;
    #[cfg(desktop)]
    {
        use tauri::{
            menu::{Menu, MenuItem},
            tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
        };
        if !state.isolated && prefs["autoStart"] == true {
            startup(app, true).map_err(std::io::Error::other)?;
        }
        let open = MenuItem::with_id(app, "open", "Открыть High.", true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "quit", "Выйти", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&open, &quit])?;
        let tray = TrayIconBuilder::new()
            .icon(tauri::image::Image::from_bytes(include_bytes!(
                "../../assets/icon.png"
            ))?)
            .tooltip("High. — личная траектория")
            .menu(&menu)
            .show_menu_on_left_click(false)
            .on_menu_event(|app, event| {
                if let Some(window) = app.get_webview_window("main") {
                    match event.id.as_ref() {
                        "open" => {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        "quit" => {
                            let _ = window.close();
                        }
                        _ => {}
                    }
                }
            })
            .on_tray_icon_event(|tray, event| {
                if matches!(
                    event,
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                ) {
                    if let Some(window) = tray.app_handle().get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            })
            .build(app);
        // If the desktop has no working tray, never leave an invisible application.
        let background = tray.is_ok()
            && std::env::args().any(|a| a == "--background")
            && prefs["autoStart"] == true
            && prefs["tray"] == true;
        if !background {
            window.show()?;
            window.set_focus()?;
        }
    }
    #[cfg(mobile)]
    {
        let _ = prefs;
        window.show()?;
    }
    Ok(())
}
