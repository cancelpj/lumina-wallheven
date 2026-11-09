//! Cross-platform desktop wallpaper setter.
//!
//! Windows is implemented directly against Win32 through the `windows` crate:
//! the fill style is written to `HKCU\Control Panel\Desktop` and the shell is
//! notified with `SystemParametersInfoW(SPI_SETDESKWALLPAPER)`. No PowerShell,
//! no child process, no ANSI/GBK path juggling — the `W` variant takes a real
//! UTF-16 path, so non-ASCII directories work.
//!
//! macOS and Linux shell out to the platform's own tooling (`osascript`,
//! `gsettings`), which is the supported way to drive them.

use serde::{Deserialize, Serialize};
use std::path::Path;

/// How the wallpaper is laid out on the desktop.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum WallpaperMode {
    /// Scale to fill the screen, cropping whatever overflows.
    Fill,
    /// Scale down until the whole image fits on screen.
    Fit,
    /// Stretch to the screen size, ignoring the aspect ratio.
    Stretch,
    /// Repeat the image across the desktop.
    Tile,
    /// Keep the native size, centred on the screen.
    Center,
    /// Span the image across multiple monitors.
    Span,
    /// Leave the operating system's current fill mode alone.
    #[default]
    System,
}

impl WallpaperMode {
    /// Parse a mode coming from the frontend. Unknown values fall back to
    /// [`WallpaperMode::System`] instead of failing the whole operation.
    pub fn parse(raw: Option<&str>) -> Self {
        match raw.map(str::trim).map(str::to_ascii_lowercase).as_deref() {
            Some("fill") => Self::Fill,
            Some("fit") => Self::Fit,
            Some("stretch") => Self::Stretch,
            Some("tile") => Self::Tile,
            Some("center") | Some("centre") => Self::Center,
            Some("span") => Self::Span,
            _ => Self::System,
        }
    }

    /// The `WallpaperStyle` / `TileWallpaper` pair this mode maps to on
    /// Windows, or `None` when the mode should leave the current setting be.
    #[cfg(target_os = "windows")]
    fn style_values(self) -> Option<(&'static str, &'static str)> {
        match self {
            Self::Fill => Some(("10", "0")),
            Self::Fit => Some(("6", "0")),
            Self::Stretch => Some(("2", "0")),
            Self::Tile => Some(("0", "1")),
            Self::Center => Some(("0", "0")),
            Self::Span => Some(("22", "0")),
            Self::System => None,
        }
    }
}

/// Apply `path` as the desktop wallpaper using `mode` for the fit style.
pub fn set(path: &Path, mode: WallpaperMode) -> Result<(), String> {
    imp::set(path, mode)
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
mod imp {
    use super::WallpaperMode;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;

    use windows::core::PCWSTR;
    use windows::Win32::Foundation::WIN32_ERROR;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE,
        REG_SZ,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        SystemParametersInfoW, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SPI_SETDESKWALLPAPER,
    };

    const DESKTOP_KEY: &str = r"Control Panel\Desktop";

    pub(super) fn set(path: &Path, mode: WallpaperMode) -> Result<(), String> {
        if !path.exists() {
            return Err(format!("wallpaper file not found: {}", path.display()));
        }

        // UTF-16, NUL terminated. The `W` API takes it as-is, so paths with
        // CJK characters no longer need the GBK round trip the old
        // `SystemParametersInfoA` hack required.
        let mut path_wide = wide_path(path);

        // The shell repaints from the `Wallpaper` registry value, so writing it
        // explicitly is what lets paths longer than MAX_PATH survive.
        write_desktop_string("Wallpaper", &path_wide)?;

        if let Some((style, tile)) = mode.style_values() {
            write_desktop_string("WallpaperStyle", &wide_nul(style))?;
            write_desktop_string("TileWallpaper", &wide_nul(tile))?;
        }

        // SPIF_UPDATEINIFILE persists the value, SPIF_SENDCHANGE makes the
        // shell redraw every monitor right away.
        unsafe {
            SystemParametersInfoW(
                SPI_SETDESKWALLPAPER,
                0,
                Some(path_wide.as_mut_ptr() as *mut core::ffi::c_void),
                SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
            )
        }
        .map_err(|e| format!("SystemParametersInfoW(SPI_SETDESKWALLPAPER) failed: {e}"))
    }

    /// Write a REG_SZ value under `HKCU\Control Panel\Desktop`.
    fn write_desktop_string(name: &str, value: &[u16]) -> Result<(), String> {
        let key_wide = wide_nul(DESKTOP_KEY);
        let name_wide = wide_nul(name);

        unsafe {
            let mut key = HKEY(std::ptr::null_mut());
            let status = RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(key_wide.as_ptr()),
                None,
                KEY_SET_VALUE,
                &mut key,
            );

            if status != WIN32_ERROR(0) {
                return Err(format!(
                    "RegOpenKeyExW({DESKTOP_KEY}) failed with status {}",
                    status.0
                ));
            }

            let result = RegSetValueExW(
                key,
                PCWSTR(name_wide.as_ptr()),
                None,
                REG_SZ,
                Some(&wide_bytes(value)),
            );

            let _ = RegCloseKey(key);

            if result != WIN32_ERROR(0) {
                return Err(format!(
                    "RegSetValueExW({name}) failed with status {}",
                    result.0
                ));
            }
        }

        Ok(())
    }

    /// UTF-16, NUL terminated, from a `&str`.
    fn wide_nul(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// UTF-16, NUL terminated, from an OS path.
    fn wide_path(path: &Path) -> Vec<u16> {
        path.as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    /// UTF-16 bytes for a REG_SZ payload (little endian, NUL included).
    fn wide_bytes(value: &[u16]) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(value.len() * 2);
        for unit in value {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }
        bytes
    }
}

// ---------------------------------------------------------------------------
// macOS
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
mod imp {
    use super::WallpaperMode;
    use std::path::Path;
    use std::process::Command;

    pub(super) fn set(path: &Path, _mode: WallpaperMode) -> Result<(), String> {
        if !path.exists() {
            return Err(format!("wallpaper file not found: {}", path.display()));
        }

        // macOS stretches the picture to fill the display, so the fit mode has
        // no equivalent to map onto here.
        let script = r#"
on run argv
  tell application "System Events"
    set picture of every desktop to item 1 of argv
  end tell
end run
"#;

        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .arg(path)
            .output()
            .map_err(|e| format!("Failed to run osascript: {e}"))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let message = stderr.trim();
            if message.is_empty() {
                Err("osascript failed with no output".into())
            } else {
                Err(format!("osascript failed: {message}"))
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Linux (GNOME / gsettings)
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
mod imp {
    use super::WallpaperMode;
    use std::path::Path;
    use std::process::Command;

    pub(super) fn set(path: &Path, mode: WallpaperMode) -> Result<(), String> {
        if !path.exists() {
            return Err(format!("wallpaper file not found: {}", path.display()));
        }

        let uri = format!("file://{}", path.to_string_lossy().replace(' ', "%20"));

        let options = match mode {
            WallpaperMode::Fill => "zoom",
            WallpaperMode::Fit => "scaled",
            WallpaperMode::Stretch => "stretched",
            WallpaperMode::Tile => "wallpaper",
            WallpaperMode::Center => "centered",
            WallpaperMode::Span => "spanned",
            WallpaperMode::System => "zoom",
        };

        for key in ["picture-uri", "picture-uri-dark"] {
            let status = Command::new("gsettings")
                .args(["set", "org.gnome.desktop.background", key, &uri])
                .status()
                .map_err(|e| format!("Failed to run gsettings: {e}"))?;

            if !status.success() {
                return Err(format!("Failed to set GNOME wallpaper ({key})"));
            }
        }

        let status = Command::new("gsettings")
            .args([
                "set",
                "org.gnome.desktop.background",
                "picture-options",
                options,
            ])
            .status()
            .map_err(|e| format!("Failed to run gsettings: {e}"))?;

        if !status.success() {
            return Err("Failed to set GNOME picture-options".into());
        }

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Unsupported platforms
// ---------------------------------------------------------------------------

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod imp {
    use super::WallpaperMode;
    use std::path::Path;

    pub(super) fn set(_path: &Path, _mode: WallpaperMode) -> Result<(), String> {
        Err("Setting desktop wallpaper is not supported on this platform".into())
    }
}

#[cfg(test)]
mod tests {
    use super::WallpaperMode;

    #[test]
    fn parses_known_modes_case_insensitively() {
        assert_eq!(WallpaperMode::parse(Some("fill")), WallpaperMode::Fill);
        assert_eq!(WallpaperMode::parse(Some("FIT")), WallpaperMode::Fit);
        assert_eq!(WallpaperMode::parse(Some("  Tile ")), WallpaperMode::Tile);
        assert_eq!(WallpaperMode::parse(Some("center")), WallpaperMode::Center);
        assert_eq!(WallpaperMode::parse(Some("span")), WallpaperMode::Span);
        assert_eq!(
            WallpaperMode::parse(Some("stretch")),
            WallpaperMode::Stretch
        );
    }

    #[test]
    fn unknown_modes_fall_back_to_system() {
        assert_eq!(WallpaperMode::parse(None), WallpaperMode::System);
        assert_eq!(WallpaperMode::parse(Some("")), WallpaperMode::System);
        assert_eq!(
            WallpaperMode::parse(Some("nonsense")),
            WallpaperMode::System
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn style_values_match_the_original_electron_app() {
        // The legacy implementation used [[10,0],[6,0],[2,0],[0,1],[0,0],[22,0]]
        // for fill / fit / stretch / tile / center / span.
        assert_eq!(WallpaperMode::Fill.style_values(), Some(("10", "0")));
        assert_eq!(WallpaperMode::Fit.style_values(), Some(("6", "0")));
        assert_eq!(WallpaperMode::Stretch.style_values(), Some(("2", "0")));
        assert_eq!(WallpaperMode::Tile.style_values(), Some(("0", "1")));
        assert_eq!(WallpaperMode::Center.style_values(), Some(("0", "0")));
        assert_eq!(WallpaperMode::Span.style_values(), Some(("22", "0")));
        assert_eq!(WallpaperMode::System.style_values(), None);
    }
}
