mod profile;
mod system;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--background"]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = profile::Profile::init(app.handle())?;
            let cache = state.root.join("webview-cache");
            app.manage(state);
            app.manage(system::Lifecycle::default());
            let window =
                tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?;
            #[cfg(any(windows, target_os = "linux"))]
            let window = window.data_directory(cache);
            #[cfg(not(any(windows, target_os = "linux")))]
            let _ = cache;
            window.build()?;
            system::setup(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                use std::sync::atomic::Ordering;
                let state = window.state::<system::Lifecycle>();
                if state.ready.load(Ordering::SeqCst) && !state.may_close.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.emit("native-close-request", ());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            profile::profile_io,
            system::preferences,
            system::configure,
            system::window_action,
            system::import_journal,
            system::export_journal,
            system::open_backups,
            system::ui_ready,
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start High");
}
