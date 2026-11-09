//! Bounded thumbnail generation and cache management.
//!
//! The webview decodes whatever it is handed, so a full resolution 4K wallpaper
//! costs ~33 MB of bitmap memory the moment it lands in an `<img>`. Every
//! local image therefore gets a downscaled JPEG thumbnail, and the thumbnail
//! cache is kept under a size ceiling so it cannot grow forever.

use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Longest edge of a generated thumbnail, in pixels.
pub const THUMB_MAX_EDGE: u32 = 480;

/// JPEG quality used for generated thumbnails.
const THUMB_QUALITY: u8 = 82;

/// Upper bound for the thumbnail cache on disk.
pub const THUMB_CACHE_MAX_BYTES: u64 = 96 * 1024 * 1024;

/// Generate a thumbnail for `source` and write it to `dest`.
///
/// The write goes through a temporary file so a crash mid-write can never
/// leave a half written JPEG behind that later looks like a valid cache hit.
pub fn generate(source: &Path, dest: &Path) -> Result<(), String> {
    let reader = image::ImageReader::open(source)
        .map_err(|e| format!("failed to open image {}: {e}", source.display()))?
        .with_guessed_format()
        .map_err(|e| format!("failed to read image format: {e}"))?;

    let decoded = reader
        .decode()
        .map_err(|e| format!("failed to decode image {}: {e}", source.display()))?;

    let thumbnail = decoded.thumbnail(THUMB_MAX_EDGE, THUMB_MAX_EDGE);
    let flattened = flatten_on_white(&thumbnail);

    let mut encoded = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut encoded, THUMB_QUALITY)
        .encode_image(&flattened)
        .map_err(|e| format!("failed to encode thumbnail: {e}"))?;

    write_atomic(dest, &encoded)
}

/// Composite a possibly transparent image onto an opaque white background.
///
/// JPEG has no alpha channel, so dropping the alpha straight to RGB would turn
/// transparent PNG regions black.
fn flatten_on_white(image: &image::DynamicImage) -> image::RgbImage {
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();

    image::RgbImage::from_fn(width, height, |x, y| {
        let pixel = rgba.get_pixel(x, y);
        let alpha = pixel[3] as f32 / 255.0;

        let blend = |channel: u8| {
            (channel as f32 * alpha + 255.0 * (1.0 - alpha)).round() as u8
        };

        image::Rgb([blend(pixel[0]), blend(pixel[1]), blend(pixel[2])])
    })
}

/// Write `bytes` to `dest` atomically.
pub fn write_atomic(dest: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp = dest.with_extension("tmp");

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create {}: {e}", parent.display()))?;
    }

    std::fs::write(&temp, bytes)
        .map_err(|e| format!("failed to write {}: {e}", temp.display()))?;

    std::fs::rename(&temp, dest).map_err(|e| {
        let _ = std::fs::remove_file(&temp);
        format!("failed to replace {}: {e}", dest.display())
    })
}

/// Stable cache key for a source path.
///
/// FNV-1a over the path — cheap, dependency free, and stable across runs.
pub fn cache_key(source: &Path) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;

    for byte in source.to_string_lossy().as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }

    format!("{hash:016x}")
}

/// Delete the oldest files in `dir` until the directory is under `max_bytes`.
pub fn prune(dir: &Path, max_bytes: u64) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }

    let mut entries: Vec<(PathBuf, u64, SystemTime)> = Vec::new();
    let mut total = 0u64;

    for entry in std::fs::read_dir(dir)
        .map_err(|e| format!("failed to read {}: {e}", dir.display()))?
    {
        let entry = entry.map_err(|e| format!("failed to read directory entry: {e}"))?;
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        if !metadata.is_file() {
            continue;
        }

        total += metadata.len();
        let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        entries.push((entry.path(), metadata.len(), modified));
    }

    if total <= max_bytes {
        return Ok(());
    }

    // Oldest first — those are the ones least likely to be looked at again.
    entries.sort_by_key(|(_, _, modified)| *modified);

    let mut excess = total - max_bytes;
    for (path, len, _) in entries {
        if excess == 0 {
            break;
        }
        if std::fs::remove_file(&path).is_ok() {
            excess = excess.saturating_sub(len);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_key_is_stable_and_distinct() {
        let a = Path::new("/tmp/wallhaven-abc.jpg");
        let b = Path::new("/tmp/wallhaven-xyz.jpg");

        assert_eq!(cache_key(a), cache_key(a));
        assert_ne!(cache_key(a), cache_key(b));
        assert_eq!(cache_key(a).len(), 16);
    }

    #[test]
    fn write_atomic_replaces_existing_file() {
        let dir = std::env::temp_dir().join("lumina-thumbnail-test");
        std::fs::create_dir_all(&dir).unwrap();
        let dest = dir.join("thumb.jpg");

        write_atomic(&dest, b"first").unwrap();
        write_atomic(&dest, b"second").unwrap();

        assert_eq!(std::fs::read(&dest).unwrap(), b"second");
        // No leftover temp file.
        assert!(!dest.with_extension("tmp").exists());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn prune_removes_oldest_until_under_the_cap() {
        let dir = std::env::temp_dir().join("lumina-prune-test");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        for index in 0..4 {
            std::fs::write(dir.join(format!("{index}.bin")), [0u8; 128]).unwrap();
        }

        prune(&dir, 300).unwrap();

        let remaining = std::fs::read_dir(&dir).unwrap().count();
        assert!(remaining < 4, "prune should have removed something");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
