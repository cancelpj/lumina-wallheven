<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDownloadStore } from '@/stores/download'
import EmptyState from '@/components/common/EmptyState.vue'
import ThumbImage from '@/components/common/ThumbImage.vue'
import { useToastStore } from '@/stores/toast'
import type { DownloadItem } from '@/types/wallhaven'

const store = useDownloadStore()
const toast = useToastStore()

const activeDownloads = computed(() => store.getActive())
const completedDownloads = computed(() => store.getCompleted())
const deleteConfirm = ref<{
  id: string
  top: number
  left: number
} | null>(null)

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatSpeed(bytes: number): string {
  return formatBytes(bytes) + '/s'
}

function progressPercent(received: number, total: number): number {
  if (total === 0) return 0
  return Math.min((received / total) * 100, 100)
}

function fileLabel(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

async function selectDownloadDir() {
  try {
    const path = await store.chooseDownloadDir()
    if (path) {
      toast.show('下载位置已更新', { icon: 'folder_managed' })
    }
  } catch {
    toast.show('下载位置更新失败', { icon: 'error', tone: 'info' })
  }
}

async function openDownloadDir() {
  try {
    await store.openDownloadDir()
  } catch {
    toast.show('无法打开下载目录', { icon: 'folder_off', tone: 'info' })
  }
}

async function revealDownloadedFile(item: DownloadItem) {
  try {
    await store.revealDownloadFile(item.file_path)
  } catch {
    toast.show('无法定位下载图片', { icon: 'folder_off', tone: 'info' })
  }
}

function toggleDeleteConfirm(id: string, event: MouseEvent) {
  if (deleteConfirm.value?.id === id) {
    deleteConfirm.value = null
    return
  }

  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  const popoverWidth = 256
  const gap = 10

  deleteConfirm.value = {
    id,
    top: Math.min(rect.bottom + gap, window.innerHeight - 150),
    left: Math.max(16, rect.right - popoverWidth),
  }
}

async function confirmDelete(id: string) {
  try {
    await store.deleteDownload(id)
    deleteConfirm.value = null
    toast.show('本地图片已删除', { icon: 'delete' })
  } catch {
    toast.show('删除失败，请稍后再试', { icon: 'error', tone: 'info' })
  }
}

onMounted(() => {
  store.setupListeners()
  store.initializeDownloadDir()
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-8 custom-scrollbar">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 pt-4 md:px-6">
        <!-- Page Header -->
        <div class="rounded-2xl border border-black/5 bg-white/40 px-6 py-5 backdrop-blur-[40px]">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-primary text-[28px]">download</span>
              <div>
                <h2 class="text-headline-lg text-on-surface">Downloads</h2>
                <p class="text-body-sm text-on-surface-variant">{{ store.items.length }} items</p>
              </div>
            </div>
            <div class="flex items-center gap-2 rounded-full bg-black/5 px-4 py-2 text-body-sm text-on-surface-variant">
              <span class="material-symbols-outlined text-[18px] text-primary">task_alt</span>
              {{ completedDownloads.length }} completed
            </div>
          </div>
        </div>

        <!-- Download Directory -->
        <div class="rounded-2xl border border-black/5 bg-white/60 p-5 backdrop-blur-[24px]">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-label-caps text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px] text-primary">folder_open</span>
                Download Location
              </div>
              <p class="mt-2 text-body-md text-on-surface break-all">
                {{ store.downloadDir || 'Using system default download folder' }}
              </p>
              <p class="mt-1 text-body-sm text-on-surface-variant">
                New wallpapers will be saved here.
              </p>
            </div>
            <div class="flex flex-wrap gap-3">
              <button
                @click="selectDownloadDir"
                class="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-body-sm font-medium text-on-primary transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
                :disabled="store.selectingDir"
              >
                <span class="material-symbols-outlined text-[18px]">
                  {{ store.selectingDir ? 'progress_activity' : 'edit_location_alt' }}
                </span>
                {{ store.selectingDir ? 'Choosing...' : 'Choose Folder' }}
              </button>
              <button
                @click="openDownloadDir"
                class="flex items-center gap-2 rounded-xl border border-black/5 bg-black/5 px-4 py-2.5 text-body-sm text-on-surface transition-all hover:bg-black/10"
              >
                <span class="material-symbols-outlined text-[18px]">folder</span>
                Open Folder
              </button>
            </div>
          </div>
        </div>

        <!-- Active downloads -->
        <div v-if="activeDownloads.length > 0" class="space-y-3">
          <div
            v-for="item in activeDownloads"
            :key="item.id"
            class="rounded-2xl border border-black/5 bg-white/60 p-4 backdrop-blur-[18px]"
          >
            <div class="flex items-center gap-4">
              <ThumbImage
                v-if="item.thumbnail"
                :fallback="item.thumbnail"
                class="h-12 w-20 rounded-xl border border-black/5 object-cover flex-shrink-0"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-body-md font-medium text-on-surface">{{ item.file_name || item.id }}</p>
                <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span class="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span class="text-body-sm text-on-surface-variant">
                    {{ formatBytes(item.received_bytes) }} / {{ formatBytes(item.total_bytes) }}
                  </span>
                  <span class="text-body-sm text-on-surface-variant/60">{{ formatSpeed(item.speed_bytes) }}</span>
                </div>
                <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-black/5">
                  <div
                    class="h-full rounded-full bg-primary transition-all duration-300"
                    :style="{ width: `${progressPercent(item.received_bytes, item.total_bytes)}%` }"
                  />
                </div>
              </div>
              <button
                @click="store.cancelDownload(item.id)"
                class="rounded-xl p-2 text-on-surface-variant/40 transition-all duration-200 hover:bg-error/5 hover:text-error"
              >
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Completed downloads -->
        <div v-if="completedDownloads.length > 0" class="space-y-3">
          <div
            v-for="item in completedDownloads"
            :key="item.id"
            class="rounded-2xl border border-black/5 bg-white/60 p-4 backdrop-blur-[18px]"
          >
            <div class="flex items-center gap-4">
              <ThumbImage
                v-if="item.file_path || item.thumbnail"
                :path="item.file_path"
                :fallback="item.thumbnail"
                class="h-16 w-28 rounded-xl border border-black/5 object-cover flex-shrink-0 shadow-sm"
              />
              <div
                v-else
                class="flex h-16 w-28 flex-shrink-0 items-center justify-center rounded-xl border border-black/5 bg-black/5"
              >
                <span class="material-symbols-outlined text-on-surface-variant/50">image</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-body-md font-medium text-on-surface">{{ item.file_name || item.id }}</p>
                <p class="mt-0.5 text-body-sm text-on-surface-variant">{{ item.resolution }}</p>
                <p v-if="item.file_path" class="mt-1 truncate text-label-caps text-on-surface-variant/70">
                  {{ fileLabel(item.file_path) }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <button
                  @click="revealDownloadedFile(item)"
                  class="rounded-xl p-2 text-on-surface-variant/50 transition-all hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="!item.file_path"
                >
                  <span class="material-symbols-outlined text-[18px]">folder_open</span>
                </button>
                <div>
                  <button
                    @click="toggleDeleteConfirm(item.id, $event)"
                    class="rounded-xl p-2 text-on-surface-variant/50 transition-all hover:bg-error/5 hover:text-error"
                  >
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty -->
        <div v-if="store.items.length === 0" class="flex min-h-[320px] items-center justify-center">
          <EmptyState
            title="No downloads yet"
            description="Downloaded wallpapers will appear here"
          />
        </div>
      </div>
    </div>

    <Teleport to="body">
      <transition name="delete-popover">
        <div
          v-if="deleteConfirm"
          class="fixed z-[220] w-64 rounded-2xl border border-black/5 bg-white/85 p-4 shadow-2xl backdrop-blur-[28px]"
          :style="{ top: `${deleteConfirm.top}px`, left: `${deleteConfirm.left}px` }"
        >
          <p class="text-body-sm text-on-surface">删除本地图片？</p>
          <p class="mt-1 text-body-sm text-on-surface-variant">
            这会同时移除下载记录。
          </p>
          <div class="mt-3 flex justify-end gap-2">
            <button
              @click="deleteConfirm = null"
              class="rounded-xl border border-black/5 bg-black/5 px-3 py-2 text-body-sm text-on-surface transition-all hover:bg-black/10"
            >
              Cancel
            </button>
            <button
              @click="confirmDelete(deleteConfirm.id)"
              class="rounded-xl bg-error px-3 py-2 text-body-sm text-on-error transition-all hover:brightness-105"
            >
              Delete
            </button>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
.delete-popover-enter-active,
.delete-popover-leave-active {
  transition: opacity 0.18s ease-out, transform 0.18s ease-out;
}

.delete-popover-enter-from,
.delete-popover-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
