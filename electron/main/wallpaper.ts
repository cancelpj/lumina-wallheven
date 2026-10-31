/**
 * 设置系统壁纸 —— 对应原 Rust 端 commands.rs 中的 set_system_wallpaper。
 * 三平台实现原样移植：
 * - macOS : osascript + System Events
 * - Windows : PowerShell + SystemParametersInfo (user32)
 * - Linux : gsettings (GNOME)
 */
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function setSystemWallpaper(path: string): Promise<void> {
  if (process.platform === 'darwin') {
    const script = [
      'on run argv',
      '  tell application "System Events"',
      '    set picture of every desktop to item 1 of argv',
      '  end tell',
      'end run',
    ].join('\n')
    await execFileAsync('osascript', ['-e', script, path])
    return
  }

  if (process.platform === 'win32') {
    const script = [
      `Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class Wallpaper { [DllImport("user32.dll", SetLastError=true)] public static extern bool SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni); }'`,
      'if (-not [Wallpaper]::SystemParametersInfo(20, 0, $args[0], 3)) { exit 1 }',
    ].join('\n')
    await execFileAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
      path,
    ])
    return
  }

  if (process.platform === 'linux') {
    const uri = `file://${path.replace(/ /g, '%20')}`
    await execFileAsync('gsettings', [
      'set',
      'org.gnome.desktop.background',
      'picture-uri',
      uri,
    ])
    await execFileAsync('gsettings', [
      'set',
      'org.gnome.desktop.background',
      'picture-uri-dark',
      uri,
    ]).catch(() => {})
    return
  }

  throw new Error('Setting desktop wallpaper is not supported on this platform')
}
