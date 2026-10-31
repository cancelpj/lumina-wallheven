/**
 * 图片缓存模块 —— 对应原 Rust 端 commands.rs 中的
 * fetch_wallpaper_image / get_cache_info / clear_app_cache / app_cache_dir / dir_size。
 *
 * 缓存目录：{userData}/cache/images
 * 返回给前端的不是本地磁盘路径，而是 lumina://cache/<文件名> 自定义协议 URL，
 * 由主进程 protocol.handle('lumina') 提供本地文件服务（等价于 Tauri 的 convertFileSrc）。
 */
import { app } from 'electron'
import { join, basename } from 'path'
import { mkdir, readdir, stat, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { httpFetch } from './http'

export const cacheRoot = (): string => join(app.getPath('userData'), 'cache')
export const cacheImagesDir = (): string => join(cacheRoot(), 'images')

export async function ensureCacheDirs(): Promise<void> {
  await mkdir(cacheImagesDir(), { recursive: true })
}

/**
 * 把壁纸图片下载/复用本地缓存，返回本地绝对路径。
 * 绕过 w.wallhaven.cc 的 CDN 防盗链（需 Referer: https://wallhaven.cc/）。
 */
export async function cacheWallpaperImage(path: string): Promise<string> {
  await ensureCacheDirs()

  const fileName = basename(path) || 'wallpaper.jpg'
  const localPath = join(cacheImagesDir(), fileName)

  if (existsSync(localPath)) return localPath

  const url = /^https?:\/\//.test(path)
    ? path
    : `https://w.wallhaven.cc/full/${path.replace(/^\//, '')}`

  const res = await httpFetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Referer: 'https://wallhaven.cc/',
    },
  })

  if (!res.ok) {
    throw new Error(`CDN Error: ${res.status} ${res.statusText || 'Unknown'}`)
  }

  const bytes = Buffer.from(await res.arrayBuffer())
  await writeFile(localPath, bytes)
  return localPath
}

/** 供渲染进程 <img> 使用的可访问 URL（等价于 Tauri convertFileSrc）。 */
export async function fetchWallpaperImage(path: string): Promise<string> {
  const localPath = await cacheWallpaperImage(path)
  const fileName = basename(localPath)
  return `lumina://cache/${encodeURIComponent(fileName)}`
}

export interface CacheInfo {
  bytes: number
  path: string
  platform: string
}

function currentPlatform(): string {
  if (process.platform === 'darwin') return 'macOS'
  if (process.platform === 'win32') return 'Windows'
  if (process.platform === 'linux') return 'Linux'
  return 'Unknown'
}

async function dirSize(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0

  let total = 0
  const entries = await readdir(dir)
  for (const entry of entries) {
    const meta = await stat(join(dir, entry))
    if (meta.isDirectory()) {
      total += await dirSize(join(dir, entry))
    } else {
      total += meta.size
    }
  }
  return total
}

export async function getCacheInfo(): Promise<CacheInfo> {
  await ensureCacheDirs()
  const bytes = await dirSize(cacheRoot())
  return {
    bytes,
    path: cacheRoot(),
    platform: currentPlatform(),
  }
}

export async function clearAppCache(): Promise<CacheInfo> {
  await rm(cacheRoot(), { recursive: true, force: true })
  await ensureCacheDirs()
  return {
    bytes: 0,
    path: cacheRoot(),
    platform: currentPlatform(),
  }
}
