<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useDownloadStore } from '@/stores/download'

const store = useDownloadStore()

const visible = ref(false)
const currentId = ref<string | null>(null)
let hideTimer: number | null = null

const currentItem = computed(() => {
  if (!currentId.value) return null
  return store.items.find(item => item.id === currentId.value) || null
})

const percent = computed(() => {
  const item = currentItem.value
  if (!item || item.total_bytes <= 0) return item?.state === 'done' ? 100 : 0
  return Math.min((item.received_bytes / item.total_bytes) * 100, 100)
})

const statusLabel = computed(() => {
  const item = currentItem.value
  if (!item) return ''
  if (item.state === 'done') return 'Download complete'
  if (item.state === 'error') return 'Download failed'
  if (item.state === 'waiting') return 'Waiting...'
  return `${Math.round(percent.value)}%`
})

function clearHideTimer() {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }
}

watch(
  () => store.items.map(item => `${item.id}:${item.state}:${item.received_bytes}:${item.total_bytes}`).join('|'),
  () => {
    const active = store.items.find(item => item.state === 'waiting' || item.state === 'downloading')
    if (active) {
      clearHideTimer()
      currentId.value = active.id
      visible.value = true
      return
    }

    const item = currentItem.value
    if (!item) {
      visible.value = false
      currentId.value = null
      clearHideTimer()
      return
    }
    if (item.state !== 'done' && item.state !== 'error') return

    visible.value = true
    clearHideTimer()
    hideTimer = window.setTimeout(() => {
      visible.value = false
      currentId.value = null
      hideTimer = null
    }, 2000)
  },
)

onUnmounted(clearHideTimer)
</script>

<template>
  <Teleport to="body">
    <transition name="download-popover">
      <div
        v-if="visible && currentItem"
        class="fixed right-8 top-8 z-[190] w-[min(280px,calc(100vw-40px))]"
        role="status"
      >
        <div class="download-popover-glass rounded-xl border border-black/5 p-3 shadow-xl backdrop-blur-[24px]">
          <div class="flex items-center gap-2.5">
            <img
              v-if="currentItem.thumbnail"
              :src="currentItem.thumbnail"
              class="h-10 w-16 shrink-0 rounded-lg border border-white/40 object-cover shadow-sm"
              draggable="false"
              referrerpolicy="no-referrer"
            />
            <div
              v-else
              class="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg border border-white/40 bg-black/5"
            >
              <span class="material-symbols-outlined text-on-surface-variant/50">image</span>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <p class="truncate text-[13px] font-medium leading-5 text-on-surface">
                  {{ currentItem.file_name || currentItem.id }}
                </p>
                <span
                  class="material-symbols-outlined text-[18px]"
                  :class="currentItem.state === 'done' ? 'text-primary' : 'text-on-surface-variant'"
                >
                  {{ currentItem.state === 'done' ? 'check_circle' : 'download' }}
                </span>
              </div>
              <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-black/10">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-300"
                  :style="{ width: `${percent}%` }"
                />
              </div>
              <p class="mt-1 text-[11px] font-medium leading-4 text-on-surface-variant">
                {{ statusLabel }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.download-popover-glass {
  background: rgba(255, 255, 255, 0.78);
}

.download-popover-enter-active,
.download-popover-leave-active {
  transform-origin: top right;
  transition:
    opacity 0.18s ease-out,
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.download-popover-enter-from,
.download-popover-leave-to {
  opacity: 0;
  transform: translate3d(12px, -8px, 0) scale(0.96);
}
</style>
