import type { SearchParams, SearchResponse } from '@/types/wallhaven'

const IMAGE_CDN = 'https://w.wallhaven.cc/full'

class WallhavenAPI {
  async search(params: SearchParams): Promise<SearchResponse> {
    const queryParams: Record<string, string> = {}
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParams[key] = String(value)
      }
    }

    const apiKey = localStorage.getItem('wallhaven-api-key') || null

    // 由 Electron 主进程代理请求，绕过 CORS（原 Tauri invoke('fetch_wallhaven_api')）
    const result = await window.lumina.fetchWallhavenApi('/search', queryParams, apiKey)

    return result as SearchResponse
  }

  getFullImageUrl(path: string): string {
    if (path.startsWith('https://') || path.startsWith('http://')) return path
    return `${IMAGE_CDN}/${path.replace(/^\//, '')}`
  }

  async fetchImage(path: string): Promise<string> {
    // 下载到本地缓存并通过 lumina:// 协议访问（原 Tauri invoke + convertFileSrc）
    return window.lumina.fetchWallpaperImage(path)
  }

  async setDesktopWallpaper(path: string): Promise<void> {
    await window.lumina.setDesktopWallpaper(path)
  }
}

export const wallhavenApi = new WallhavenAPI()
