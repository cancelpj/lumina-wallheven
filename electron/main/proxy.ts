/**
 * Wallhaven API 代理 —— 对应原 Rust 端 commands.rs 中的 fetch_wallhaven_api。
 * 用 Node 原生 fetch 替代 reqwest，绕过浏览器 CORS 限制；
 * API Key 通过 X-API-Key 请求头传递（Wallhaven 官方推荐）。
 */
import { httpFetch } from './http'

export async function fetchWallhavenApi(
  endpoint: string,
  params: Record<string, string>,
  apiKey?: string | null,
): Promise<unknown> {
  const baseUrl = 'https://wallhaven.cc/api/v1'
  const url = new URL(`${baseUrl}${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {
    'User-Agent': 'Wallhaven-Desktop/1.0',
  }
  if (apiKey && apiKey.trim() !== '') {
    headers['X-API-Key'] = apiKey
  }

  const res = await httpFetch(url, { headers })

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText || 'Unknown'}`)
  }

  return res.json()
}
