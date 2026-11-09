<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useDownloadStore } from '@/stores/download'
import { useToastStore } from '@/stores/toast'
import { wallhavenApi } from '@/api/wallhaven'
import type { WallpaperMode } from '@/types/wallhaven'

interface CacheInfo {
  bytes: number
  path: string
  platform: string
}

const downloadStore = useDownloadStore()
const toast = useToastStore()

const apiKey = ref('')
const savedKey = ref('')
const showKey = ref(false)
const saved = ref(false)
const cacheInfo = ref<CacheInfo | null>(null)
const cacheLoading = ref(false)
const cacheClearing = ref(false)
const wallpaperMode = ref<WallpaperMode>('fill')

const WALLPAPER_MODE_OPTIONS: { value: WallpaperMode; label: string; hint: string }[] = [
  { value: 'fill', label: '填充', hint: '缩放至铺满屏幕，裁掉溢出的部分' },
  { value: 'fit', label: '适应', hint: '完整显示整张图片，不裁剪' },
  { value: 'stretch', label: '拉伸', hint: '忽略原始比例，直接铺满屏幕' },
  { value: 'tile', label: '平铺', hint: '以原始尺寸重复铺满桌面' },
  { value: 'center', label: '居中', hint: '以原始尺寸居中显示' },
  { value: 'span', label: '跨屏', hint: '跨多个显示器延展' },
]

const API_KEY_STORAGE = 'wallhaven-api-key'

onMounted(() => {
  savedKey.value = localStorage.getItem(API_KEY_STORAGE) || ''
  apiKey.value = savedKey.value
  wallpaperMode.value = wallhavenApi.getWallpaperMode()
  refreshCacheInfo()
})

function selectWallpaperMode(mode: WallpaperMode) {
  wallpaperMode.value = mode
  wallhavenApi.setWallpaperMode(mode)
  const label = WALLPAPER_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode
  toast.show(`壁纸填充方式已切换为「${label}」`, { icon: 'wallpaper', tone: 'success' })
}

function saveApiKey() {
  const key = apiKey.value.trim()
  if (key) {
    localStorage.setItem(API_KEY_STORAGE, key)
    savedKey.value = key
  } else {
    localStorage.removeItem(API_KEY_STORAGE)
    savedKey.value = ''
  }
  window.dispatchEvent(new CustomEvent('api-key-changed'))
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

function maskKey(key: string): string {
  if (key.length <= 4) return key
  return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 4, 20))
}

async function changeDownloadDir() {
  await downloadStore.chooseDownloadDir()
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function platformCacheHint(info: CacheInfo): string {
  if (info.platform === 'macOS') return 'macOS 应用缓存位于应用支持目录下。'
  if (info.platform === 'Windows') return 'Windows 应用缓存位于 AppData 目录下。'
  return `${info.platform} 应用缓存目录。`
}

async function refreshCacheInfo() {
  cacheLoading.value = true
  try {
    cacheInfo.value = await invoke<CacheInfo>('get_cache_info')
  } catch {
    toast.show('读取缓存大小失败', { icon: 'error', tone: 'info' })
  } finally {
    cacheLoading.value = false
  }
}

async function clearCache() {
  cacheClearing.value = true
  try {
    cacheInfo.value = await invoke<CacheInfo>('clear_app_cache')
    toast.show('应用缓存已清理', { icon: 'cleaning_services', tone: 'success' })
  } catch {
    toast.show('清理缓存失败，请稍后再试', { icon: 'error', tone: 'info' })
  } finally {
    cacheClearing.value = false
  }
}

async function openCacheDir() {
  if (!cacheInfo.value?.path) return

  try {
    await invoke('open_download_folder', { path: cacheInfo.value.path })
  } catch {
    toast.show('无法打开缓存目录', { icon: 'folder_off', tone: 'info' })
  }
}
</script>

<template>
  <div class="flex flex-col h-full p-10 overflow-y-auto custom-scrollbar">
    <h1 class="text-headline-lg text-on-surface mb-10">设置</h1>

    <div class="max-w-2xl space-y-8">
      <!-- API Key -->
      <section class="detail-info-card rounded-2xl p-6">
        <h2 class="font-headline-md text-on-surface mb-1">Wallhaven API Key</h2>
        <p class="text-body-sm text-modal-secondary mb-4">
          用于访问 NSFW 内容及个性化功能。在
          <a href="https://wallhaven.cc/settings/account" target="_blank" class="text-primary underline">wallhaven.cc/settings/account</a>
          获取。
        </p>
        <div class="flex items-center gap-3">
          <div class="relative flex-1 max-w-md">
            <input
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              class="w-full bg-white/60 border border-black/5 rounded-xl py-2.5 px-4 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              placeholder="输入 API Key…"
            />
            <button
              @click="showKey = !showKey"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
            >
              <span class="material-symbols-outlined text-[20px]">
                {{ showKey ? 'visibility_off' : 'visibility' }}
              </span>
            </button>
          </div>
          <button
            @click="saveApiKey"
            class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-headline-md hover:brightness-110 transition-all"
          >
            {{ saved ? '已保存' : '保存' }}
          </button>
        </div>
        <p v-if="savedKey" class="text-body-sm text-modal-secondary mt-3">
          当前 Key：{{ maskKey(savedKey) }}
        </p>
      </section>

      <!-- Download Directory -->
      <section class="detail-info-card rounded-2xl p-6">
        <h2 class="font-headline-md text-on-surface mb-1">壁纸下载地址</h2>
        <p class="text-body-sm text-modal-secondary mb-4">下载的壁纸将保存到此目录。</p>
        <div class="flex items-center gap-3">
          <div class="flex-1 max-w-md bg-white/40 border border-black/5 rounded-xl py-2.5 px-4 text-body-sm text-on-surface truncate">
            {{ downloadStore.downloadDir || '未设置' }}
          </div>
          <button
            @click="changeDownloadDir"
            :disabled="downloadStore.selectingDir"
            class="px-5 py-2.5 detail-info-card rounded-xl font-headline-md hover:bg-white/50 transition-all"
          >
            {{ downloadStore.selectingDir ? '选择中…' : '更改' }}
          </button>
        </div>
      </section>

      <!-- Wallpaper Fit Mode -->
      <section class="detail-info-card rounded-2xl p-6">
        <h2 class="font-headline-md text-on-surface mb-1">壁纸填充方式</h2>
        <p class="text-body-sm text-modal-secondary mb-4">
          设置壁纸时应用到所有显示器。Windows 支持全部六种方式；macOS 由系统拉伸填充；Linux 需要 GNOME 环境。
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in WALLPAPER_MODE_OPTIONS"
            :key="option.value"
            @click="selectWallpaperMode(option.value)"
            class="rounded-xl px-5 py-2.5 font-headline-md transition-all"
            :class="wallpaperMode === option.value
              ? 'bg-primary text-on-primary'
              : 'detail-info-card text-on-surface hover:bg-white/50'"
          >
            {{ option.label }}
          </button>
        </div>
        <p class="text-body-sm text-modal-secondary mt-3">
          {{ WALLPAPER_MODE_OPTIONS.find((o) => o.value === wallpaperMode)?.hint }}
        </p>
      </section>

      <!-- App Cache -->
      <section class="detail-info-card rounded-2xl p-6">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="font-headline-md text-on-surface mb-1">应用缓存</h2>
            <p class="text-body-sm text-modal-secondary">
              高清预览图缓存会保存在本机，清理后不会删除下载目录中的壁纸。
            </p>
          </div>
          <button
            @click="refreshCacheInfo"
            :disabled="cacheLoading || cacheClearing"
            class="rounded-xl p-2 text-on-surface-variant transition-all hover:bg-white/50 hover:text-primary disabled:cursor-wait disabled:opacity-60"
            title="刷新缓存大小"
          >
            <span class="material-symbols-outlined text-[20px]" :class="{ 'animate-spin': cacheLoading }">refresh</span>
          </button>
        </div>

        <div class="grid gap-3 sm:grid-cols-[140px_1fr]">
          <div class="rounded-xl border border-black/5 bg-white/40 p-4">
            <span class="block text-label-caps text-on-surface-variant">CACHE SIZE</span>
            <span class="mt-1 block font-headline-md text-on-surface">
              {{ cacheLoading && !cacheInfo ? '读取中…' : formatBytes(cacheInfo?.bytes || 0) }}
            </span>
          </div>
          <div class="min-w-0 rounded-xl border border-black/5 bg-white/40 p-4">
            <span class="block text-label-caps text-on-surface-variant">{{ cacheInfo?.platform || 'Platform' }}</span>
            <p class="mt-1 truncate text-body-sm text-on-surface">
              {{ cacheInfo?.path || '缓存目录读取中…' }}
            </p>
            <p v-if="cacheInfo" class="mt-1 text-body-sm text-modal-secondary">
              {{ platformCacheHint(cacheInfo) }}
            </p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap justify-end gap-3">
          <button
            @click="openCacheDir"
            :disabled="!cacheInfo?.path"
            class="flex items-center gap-2 rounded-xl border border-black/5 bg-black/5 px-5 py-2.5 font-headline-md text-on-surface transition-all hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-[18px]">folder_open</span>
            打开缓存目录
          </button>
          <button
            @click="clearCache"
            :disabled="cacheClearing || cacheLoading || !cacheInfo || cacheInfo.bytes === 0"
            class="flex items-center gap-2 rounded-xl bg-error px-5 py-2.5 font-headline-md text-on-error transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-[18px]">
              {{ cacheClearing ? 'progress_activity' : 'cleaning_services' }}
            </span>
            {{ cacheClearing ? '清理中…' : '一键清理缓存' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
