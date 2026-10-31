/**
 * Electron 主进程入口 —— 对应原 Tauri 的 src-tauri/src/lib.rs + tauri.conf.json。
 *
 * 窗口配置逐项对照 tauri.conf.json：
 *   title: "Lumina"             → title
 *   width/height: 1400×900      → width/height
 *   minWidth/minHeight: 1000×700→ minWidth/minHeight
 *   decorations: false          → frame: false（无边框，配自定义标题栏）
 *   transparent: true           → transparent: true
 *   backgroundColor: "#00000000"→ backgroundColor: '#00000000'
 *   center: true                → center: true
 *   resizable: true             → resizable: true
 */
import { app, BrowserWindow, globalShortcut, net, protocol, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { registerIpcHandlers } from './ipc'
import { cacheImagesDir, ensureCacheDirs } from './cache'
import { downloadManager } from './download'

// 应用名统一（影响 userData 缓存目录；需在 app ready 之前设置，打包后由 electron-builder productName 覆盖）
app.setName('Lumina')

// 必须在 app ready 之前注册自定义协议（等价于 Tauri 的 convertFileSrc 协议）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lumina',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
])

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: 'Lumina',
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    center: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  // 外部链接（如设置页的 wallhaven.cc 链接）交给系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // DevTools 快捷键（仅开发模式）：Cmd/Ctrl+J 打开，Cmd/Ctrl+K 关闭
  // 对应原 lib.rs 中 debug 模式注册的全局快捷键
  if (!app.isPackaged) {
    globalShortcut.register('CommandOrControl+J', () => {
      win.webContents.openDevTools({ mode: 'detach' })
    })
    globalShortcut.register('CommandOrControl+K', () => {
      win.webContents.closeDevTools()
    })
  }

  if (process.env['ELECTRON_RENDERER_URL']) {
    // 开发模式：加载 Vite dev server（HMR）
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // 生产模式：加载构建产物
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    // 窗口关闭（macOS 下点击 Dock 重新激活时重建）
  })

  return win
}

void app.whenReady().then(async () => {
  await ensureCacheDirs()

  // lumina:// 协议：提供本地缓存文件与任意本地文件给渲染进程
  //   lumina://cache/<file>          → {userData}/cache/images/<file>
  //   lumina://file?path=<absPath>   → 任意绝对路径（下载缩略图等）
  protocol.handle('lumina', (request) => {
    const url = new URL(request.url)
    let filePath: string

    if (url.hostname === 'file') {
      filePath = decodeURIComponent(url.searchParams.get('path') || '')
    } else {
      filePath = join(cacheImagesDir(), decodeURIComponent(url.pathname.replace(/^\//, '')))
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })

  // 下载进度事件 → 发送到所有窗口（等价于 Tauri app.emit）
  downloadManager.setEmitter((channel, payload) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, payload)
    }
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
