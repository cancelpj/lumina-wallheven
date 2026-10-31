/**
 * 下载管理器 —— 对应原 Rust 端 download.rs + commands.rs 中的
 * download_image / cancel_download / get_downloads / clear_download /
 * delete_download_file / get_download_dir / set_download_dir。
 *
 * 用 Electron net.fetch（走 Chromium 网络栈、遵循系统代理，流式读取）替代
 * reqwest 流式下载，每 100ms 通过 webContents.send('download-progress', ...)
 * 推送进度，出错时推送 'download-error' —— 事件名与 Tauri 版完全一致，前端零改动。
 */
import { app, net } from 'electron'
import { createWriteStream } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import type { WriteStream } from 'fs'

export interface DownloadPayload {
  url: string
  id: string
  fileName: string
  resolution: string
}

export interface DownloadProgress {
  id: string
  received_bytes: number
  total_bytes: number
  speed_bytes: number
  state: 'downloading' | 'done'
  file_path?: string
  file_name?: string
  resolution?: string
  thumbnail?: string | null
}

type ProgressListener = (channel: string, payload: unknown) => void

class DownloadManager {
  private active = new Map<string, AbortController>()
  private completed: DownloadProgress[] = []
  private cancelled = new Set<string>()
  private dir: string | null = null
  private emit: ProgressListener = () => {}

  /** 由主进程注入进度事件发送器（发送到所有窗口）。 */
  setEmitter(listener: ProgressListener): void {
    this.emit = listener
  }

  getDownloadDir(): string {
    return this.dir ?? app.getPath('downloads')
  }

  setDownloadDir(path: string): void {
    this.dir = path
  }

  /** 入队下载；已在下载中时抛出（对应 Rust 的 "Already downloading"）。 */
  start(payload: DownloadPayload): void {
    if (this.active.has(payload.id)) {
      throw new Error('Already downloading')
    }

    const controller = new AbortController()
    this.active.set(payload.id, controller)
    this.cancelled.delete(payload.id)
    void this.execute(payload, controller.signal)
  }

  cancel(id: string): void {
    this.cancelled.add(id)
    this.active.get(id)?.abort()
    this.active.delete(id)
  }

  list(): DownloadProgress[] {
    return this.completed
  }

  clear(id: string): void {
    this.completed = this.completed.filter((d) => d.id !== id)
  }

  async deleteFile(id: string, filePath: string | null): Promise<void> {
    const target = filePath ?? this.completed.find((d) => d.id === id)?.file_path ?? null
    if (target) {
      await rm(target, { force: true })
    }
    this.completed = this.completed.filter((d) => d.id !== id)
  }

  private async execute(payload: DownloadPayload, signal: AbortSignal): Promise<void> {
    const { id, url, fileName, resolution } = payload

    try {
      const cdnUrl = /^https?:\/\//.test(url)
        ? url
        : `https://w.wallhaven.cc/full/${url.replace(/^\//, '')}`

      const res = await net.fetch(cdnUrl, {
        signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Referer: 'https://wallhaven.cc/',
        },
      })

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText || 'Unknown'}`)
      }
      if (!res.body) {
        throw new Error('Response body is empty')
      }

      const totalSize = Number(res.headers.get('content-length')) || 0
      const filePath = join(this.getDownloadDir(), fileName)

      await mkdir(join(filePath, '..'), { recursive: true })
      const file: WriteStream = createWriteStream(filePath)

      const reader = res.body.getReader()
      let received = 0
      let prevReceived = 0
      let lastEmit = Date.now()

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (this.cancelled.has(id)) {
          file.destroy()
          await rm(filePath, { force: true })
          this.cancelled.delete(id)
          return
        }

        const { done, value } = await reader.read()
        if (done) break

        const ok = file.write(Buffer.from(value))
        received += value.byteLength

        const now = Date.now()
        if (now - lastEmit >= 100) {
          const elapsedSec = (now - lastEmit) / 1000
          const speed = elapsedSec > 0 ? Math.round((received - prevReceived) / elapsedSec) : 0
          prevReceived = received
          lastEmit = now

          this.emit('download-progress', {
            id,
            received_bytes: received,
            total_bytes: totalSize,
            speed_bytes: speed,
            state: 'downloading',
            file_path: filePath,
            file_name: fileName,
            resolution,
            thumbnail: null,
          } satisfies DownloadProgress)

          if (!ok) {
            // 背压：等待写入队列排空
            await new Promise<void>((resolve, reject) => {
              file.once('drain', () => resolve())
              file.once('error', (err: Error) => reject(err))
            })
          }
        }
      }

      await new Promise<void>((resolve, reject) => {
        file.end((err?: Error) => (err ? reject(err) : resolve()))
      })

      // 完成
      this.active.delete(id)
      this.completed.push({
        id,
        received_bytes: received,
        total_bytes: totalSize,
        speed_bytes: 0,
        state: 'done',
        file_path: filePath,
        file_name: fileName,
        resolution,
        thumbnail: null,
      })
      this.emit('download-progress', {
        id,
        received_bytes: received,
        total_bytes: totalSize,
        speed_bytes: 0,
        state: 'done',
        file_path: filePath,
        file_name: fileName,
        resolution,
        thumbnail: null,
      } satisfies DownloadProgress)
    } catch (err) {
      this.active.delete(id)
      const message = err instanceof Error ? err.message : String(err)
      // 用户主动取消不报错
      if (!(err instanceof Error && err.name === 'AbortError')) {
        this.emit('download-error', { id, error: message })
      }
    }
  }
}

export const downloadManager = new DownloadManager()
