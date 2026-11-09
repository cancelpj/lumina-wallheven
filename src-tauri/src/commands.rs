use crate::download::{DownloadProgress, DownloadRequest, DownloadState};
use crate::thumbnail;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::{Mutex, Semaphore};

/// Upper bound for the full resolution image cache on disk.
const IMAGE_CACHE_MAX_BYTES: u64 = 512 * 1024 * 1024;

/// How many cache writes to let through before re-checking the cache size.
const PRUNE_INTERVAL: usize = 25;

/// How many thumbnails may be decoded at the same time.
///
/// Decoding a 4K original takes a few hundred milliseconds and a few tens of
/// megabytes, so an unbounded number of them in flight would spike memory.
const THUMB_CONCURRENCY: usize = 2;

static PRUNE_COUNTER: AtomicUsize = AtomicUsize::new(0);
static THUMB_SEMAPHORE: OnceLock<Semaphore> = OnceLock::new();

fn thumb_semaphore() -> &'static Semaphore {
    THUMB_SEMAPHORE.get_or_init(|| Semaphore::new(THUMB_CONCURRENCY))
}

/// Trim `dir` back under `max_bytes` every few writes.
///
/// Scanning the directory on every request would be wasteful; the cache only
/// needs a periodic sweep.
async fn maybe_prune(dir: PathBuf, max_bytes: u64) {
    if PRUNE_COUNTER.fetch_add(1, Ordering::Relaxed) % PRUNE_INTERVAL != 0 {
        return;
    }

    let _ = tauri::async_runtime::spawn_blocking(move || thumbnail::prune(&dir, max_bytes)).await;
}

#[derive(Serialize)]
pub struct CacheInfo {
    pub bytes: u64,
    pub path: String,
    pub platform: String,
}

#[tauri::command]
pub async fn download_image(
    app: AppHandle,
    state: State<'_, Arc<Mutex<DownloadState>>>,
    url: String,
    id: String,
    file_name: String,
    resolution: String,
) -> Result<(), String> {
    let mut guard = state.lock().await;

    if guard.active_downloads.contains_key(&id) {
        return Err("Already downloading".into());
    }

    let download_dir = guard.get_download_dir();

    let request = DownloadRequest {
        id: id.clone(),
        url,
        file_name,
        resolution,
        download_dir,
    };

    guard.cancelled.remove(&id);
    guard.active_downloads.insert(id.clone(), None);
    drop(guard);

    // Spawn download in background
    let state_clone = app.state::<Arc<Mutex<DownloadState>>>().inner().clone();
    let app_clone = app.clone();
    let id_clone = id.clone();

    tokio::spawn(async move {
        let result = crate::download::execute_download(
            DownloadRequest {
                id: id_clone.clone(),
                url: request.url,
                file_name: request.file_name,
                resolution: request.resolution,
                download_dir: request.download_dir,
            },
            app_clone.clone(),
        )
        .await;

        let mut guard = state_clone.lock().await;
        match result {
            Ok(path) => {
                guard.active_downloads.remove(&id_clone);
                guard.completed_downloads.push(DownloadProgress {
                    id: id_clone,
                    received_bytes: 0,
                    total_bytes: 0,
                    speed_bytes: 0,
                    state: "done".into(),
                    file_path: Some(path),
                    file_name: None,
                    resolution: None,
                    thumbnail: None,
                });
            }
            Err(e) => {
                guard.active_downloads.remove(&id_clone);
                let _ = app_clone.emit(
                    "download-error",
                    serde_json::json!({
                        "id": id_clone,
                        "error": e,
                    }),
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(
    state: State<'_, Arc<Mutex<DownloadState>>>,
    id: String,
) -> Result<(), String> {
    let mut guard = state.lock().await;
    guard.cancelled.insert(id.clone());
    guard.active_downloads.remove(&id);
    Ok(())
}

#[tauri::command]
pub async fn get_downloads(
    state: State<'_, Arc<Mutex<DownloadState>>>,
) -> Result<Vec<DownloadProgress>, String> {
    let guard = state.lock().await;
    Ok(guard.completed_downloads.clone())
}

#[tauri::command]
pub async fn clear_download(
    state: State<'_, Arc<Mutex<DownloadState>>>,
    id: String,
) -> Result<(), String> {
    let mut guard = state.lock().await;
    guard.completed_downloads.retain(|d| d.id != id);
    Ok(())
}

#[tauri::command]
pub async fn delete_download_file(
    state: State<'_, Arc<Mutex<DownloadState>>>,
    id: String,
    file_path: Option<String>,
) -> Result<(), String> {
    let file_path = if file_path.is_some() {
        file_path
    } else {
        let guard = state.lock().await;
        guard
            .completed_downloads
            .iter()
            .find(|d| d.id == id)
            .and_then(|d| d.file_path.clone())
    };

    if let Some(path) = file_path {
        let file = std::path::PathBuf::from(&path);
        if file.exists() {
            tokio::fs::remove_file(&file)
                .await
                .map_err(|e| format!("Failed to delete file: {}", e))?;
        }
    }

    let mut guard = state.lock().await;
    guard.completed_downloads.retain(|d| d.id != id);
    Ok(())
}

#[tauri::command]
pub async fn open_download_folder(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reveal_download_file(path: String) -> Result<(), String> {
    opener::reveal(std::path::PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_download_dir(
    state: State<'_, Arc<Mutex<DownloadState>>>,
) -> Result<String, String> {
    let guard = state.lock().await;
    Ok(guard.get_download_dir().to_string_lossy().to_string())
}

#[tauri::command]
pub async fn set_download_dir(
    state: State<'_, Arc<Mutex<DownloadState>>>,
    path: String,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(path);
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create download directory: {}", e))?;

    let mut guard = state.lock().await;
    guard.set_download_dir(dir.clone());
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn choose_download_dir(
    app: AppHandle,
    state: State<'_, Arc<Mutex<DownloadState>>>,
) -> Result<Option<String>, String> {
    let current_dir = {
        let guard = state.lock().await;
        guard.get_download_dir()
    };

    let selected = app
        .dialog()
        .file()
        .set_title("Select Download Folder")
        .set_directory(current_dir)
        .blocking_pick_folder()
        .and_then(|file_path| file_path.into_path().ok());

    let Some(path) = selected else {
        return Ok(None);
    };

    tokio::fs::create_dir_all(&path)
        .await
        .map_err(|e| format!("Failed to create download directory: {}", e))?;

    let mut guard = state.lock().await;
    guard.set_download_dir(path.clone());
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn get_app_data_path(app: AppHandle) -> Result<String, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_cache_info(app: AppHandle) -> Result<CacheInfo, String> {
    let cache_dir = app_cache_dir(&app)?;
    let size_dir = cache_dir.clone();
    let bytes = tokio::task::spawn_blocking(move || dir_size(&size_dir))
        .await
        .map_err(|e| format!("Failed to calculate cache size: {}", e))??;

    Ok(CacheInfo {
        bytes,
        path: cache_dir.to_string_lossy().to_string(),
        platform: current_platform().into(),
    })
}

#[tauri::command]
pub async fn clear_app_cache(app: AppHandle) -> Result<CacheInfo, String> {
    let cache_dir = app_cache_dir(&app)?;

    if cache_dir.exists() {
        tokio::fs::remove_dir_all(&cache_dir)
            .await
            .map_err(|e| format!("Failed to clear cache: {}", e))?;
    }

    tokio::fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| format!("Failed to recreate cache dir: {}", e))?;

    Ok(CacheInfo {
        bytes: 0,
        path: cache_dir.to_string_lossy().to_string(),
        platform: current_platform().into(),
    })
}

/// Proxy wallpaper image through Rust backend to bypass CDN hotlinking (403)
/// Downloads the image to local cache dir and returns the local file path.
#[tauri::command]
pub async fn fetch_wallpaper_image(app: AppHandle, path: String) -> Result<String, String> {
    let local_path = cache_wallpaper_image(&app, &path).await?;
    Ok(local_path.to_string_lossy().to_string())
}

/// Generate (or reuse) a bounded thumbnail for a local image file.
///
/// The webview has to decode whatever it renders, so handing it a 4K original
/// costs ~33 MB of bitmap memory per image. This returns a downscaled JPEG
/// instead, which is what the list views should use.
#[tauri::command]
pub async fn fetch_wallpaper_thumbnail(app: AppHandle, path: String) -> Result<String, String> {
    let cache_dir = app_cache_dir(&app)?.join("thumbs");

    tokio::fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| format!("Failed to create thumbnail cache dir: {e}"))?;

    let source = PathBuf::from(&path);
    let dest = cache_dir.join(format!("{}.jpg", thumbnail::cache_key(&source)));

    if !dest.exists() {
        let src = source.clone();
        let dst = dest.clone();

        let _permit = thumb_semaphore()
            .acquire()
            .await
            .map_err(|e| format!("Thumbnail semaphore closed: {e}"))?;

        tauri::async_runtime::spawn_blocking(move || thumbnail::generate(&src, &dst))
            .await
            .map_err(|e| format!("Thumbnail task failed: {e}"))??;
    }

    maybe_prune(cache_dir, thumbnail::THUMB_CACHE_MAX_BYTES).await;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn set_desktop_wallpaper(
    app: AppHandle,
    path: String,
    mode: Option<String>,
) -> Result<(), String> {
    let local_path = cache_wallpaper_image(&app, &path).await?;
    let mode = crate::wallpaper::WallpaperMode::parse(mode.as_deref());

    // The Win32 call itself is quick, but the macOS/Linux paths shell out to
    // osascript / gsettings, so keep them off the async runtime's worker.
    tauri::async_runtime::spawn_blocking(move || crate::wallpaper::set(&local_path, mode))
        .await
        .map_err(|e| format!("Wallpaper task failed: {e}"))?
}

async fn cache_wallpaper_image(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let cache_dir = app_cache_dir(app)?.join("images");

    tokio::fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| format!("Failed to create cache dir: {}", e))?;

    let file_name = Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "wallpaper.jpg".into());

    let local_path = cache_dir.join(&file_name);
    let temp_path = cache_dir.join(format!("{file_name}.part"));

    // Return cached file if it exists
    if local_path.exists() {
        return Ok(local_path);
    }

    let cdn_base = "https://w.wallhaven.cc/full/";
    let url = if path.starts_with("https://") || path.starts_with("http://") {
        path.to_string()
    } else {
        format!("{}{}", cdn_base, path.trim_start_matches('/'))
    };

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("Referer", "https://wallhaven.cc/")
        .send()
        .await
        .map_err(|e| format!("Image request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "CDN Error: {} {}",
            response.status().as_u16(),
            response.status().canonical_reason().unwrap_or("Unknown")
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;

    tokio::fs::write(&temp_path, &bytes)
        .await
        .map_err(|e| format!("Failed to write image file: {e}"))?;

    // Rename into place only once the bytes are fully on disk, so an
    // interrupted download can never be mistaken for a valid cache hit.
    tokio::fs::rename(&temp_path, &local_path)
        .await
        .map_err(|e| {
            let _ = std::fs::remove_file(&temp_path);
            format!("Failed to finalize image file: {e}")
        })?;

    maybe_prune(cache_dir, IMAGE_CACHE_MAX_BYTES).await;

    Ok(local_path)
}

fn app_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("cache"))
}

fn dir_size(path: &Path) -> Result<u64, String> {
    if !path.exists() {
        return Ok(0);
    }

    let mut total = 0;
    let entries = std::fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        if metadata.is_dir() {
            total += dir_size(&entry.path())?;
        } else {
            total += metadata.len();
        }
    }

    Ok(total)
}

fn current_platform() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "macOS"
    }
    #[cfg(target_os = "windows")]
    {
        "Windows"
    }
    #[cfg(target_os = "linux")]
    {
        "Linux"
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        "Unknown"
    }
}

/// Proxy wallhaven.cc API requests through Rust backend to bypass CORS.
/// API key is passed via X-API-Key header (recommended by Wallhaven docs).
#[tauri::command]
pub async fn fetch_wallhaven_api(
    endpoint: String,
    params: std::collections::HashMap<String, String>,
    api_key: Option<String>,
) -> Result<serde_json::Value, String> {
    let base_url = "https://wallhaven.cc/api/v1";
    let url = format!("{}{}", base_url, endpoint);

    let client = reqwest::Client::builder()
        .user_agent("Wallhaven-Desktop/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut request = client.get(&url).query(&params);

    if let Some(key) = &api_key {
        if !key.is_empty() {
            request = request.header("X-API-Key", key);
        }
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "API Error: {} {}",
            response.status().as_u16(),
            response.status().canonical_reason().unwrap_or("Unknown")
        ));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(json)
}
