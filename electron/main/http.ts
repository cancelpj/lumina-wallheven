/**
 * 统一的网络请求封装：为 Electron net.fetch 增加显式超时与详细错误信息。
 *
 * 说明：这里使用 net.fetch（而非 Node 的 undici fetch），它走 Chromium 网络栈、
 * 自动遵循系统代理设置；调用点均在 app.whenReady() 之后的 IPC handler 内，可安全使用。
 * AbortSignal.timeout 与普通 fetch 的 signal 语义完全兼容。
 */
import { net } from 'electron'

export const REQUEST_TIMEOUT_MS = 30_000

export async function httpFetch(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await net.fetch(url.toString(), {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error'
    const message = err instanceof Error ? err.message : String(err)
    // 底层原因（连接超时 / DNS / TLS）藏在 cause 里
    const cause =
      err instanceof Error && err.cause && err.cause !== err
        ? String(err.cause)
        : ''

    if (name === 'TimeoutError' || message.includes('Timeout')) {
      throw new Error(
        `请求超时（${timeoutMs}ms）: ${new URL(url.toString()).host}${cause ? ` — ${cause}` : ''}`,
      )
    }

    throw new Error(`网络请求失败: ${message}${cause ? ` — ${cause}` : ''}`)
  }
}
