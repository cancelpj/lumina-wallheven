import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

/**
 * Electron-vite 三端配置：
 * - main    : 主进程（替代原 Rust 后端），入口 electron/main/index.ts
 * - preload : 预加载桥接层（contextBridge 暴露 window.lumina），入口 electron/preload/index.ts
 * - renderer: 渲染进程（原 Vue 前端，代码零改动迁移），根目录即项目根，index.html 入口
 */
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/main/index.ts'),
        },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/preload/index.ts'),
        },
      },
    },
  },
  renderer: {
    // electron-vite 5 默认 renderer 根目录为 src/renderer，此处显式指回项目根（index.html 所在处）
    root: '.',
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve('src'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('index.html'),
        },
      },
    },
    server: {
      port: 1420,
      strictPort: true,
    },
  },
})
