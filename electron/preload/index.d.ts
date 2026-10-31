/**
 * 全局类型声明：让渲染进程（Vue/TS）能直接使用 window.lumina。
 * 该文件已加入 tsconfig.app.json 的 include，保证类型检查生效。
 */
import type { LuminaApi } from './lumina-api'

declare global {
  interface Window {
    lumina: LuminaApi
  }
}

export {}
