mod commands;
mod download;
mod thumbnail;
mod wallpaper;

use download::DownloadState;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Initialize download manager state
            let download_state = DownloadState::new();
            app.manage(Arc::new(Mutex::new(download_state)));

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::download_image,
            commands::cancel_download,
            commands::get_downloads,
            commands::clear_download,
            commands::delete_download_file,
            commands::open_download_folder,
            commands::reveal_download_file,
            commands::get_download_dir,
            commands::set_download_dir,
            commands::choose_download_dir,
            commands::get_app_data_path,
            commands::get_cache_info,
            commands::clear_app_cache,
            commands::fetch_wallpaper_image,
            commands::fetch_wallpaper_thumbnail,
            commands::set_desktop_wallpaper,
            commands::fetch_wallhaven_api,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
