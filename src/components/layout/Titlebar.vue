<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isMaximized = ref(false)

onMounted(async () => {
  try {
    isMaximized.value = await window.lumina.window.isMaximized()
  } catch {
    // 非 Electron 环境（浏览器预览）
  }
})

async function minimize() { await window.lumina.window.minimize() }
async function toggleMaximize() {
  await window.lumina.window.toggleMaximize()
  isMaximized.value = await window.lumina.window.isMaximized()
}
async function close() { await window.lumina.window.close() }
</script>

<template>
  <header
    style="-webkit-app-region: drag"
    class="fixed top-0 left-0 right-0 z-[200] h-9 flex items-center justify-between px-4 bg-white/60 backdrop-blur-xl border-b border-black/5"
  >
    <!-- Brand -->
    <div class="flex items-center gap-2 pl-2">
      <div class="w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/30" />
      <span class="text-[11px] font-semibold text-primary font-headline-lg tracking-tight">Lumina</span>
    </div>

    <!-- Window Controls -->
    <div class="flex items-center gap-1.5 -mr-1" style="-webkit-app-region: no-drag">
      <button @click="minimize" class="w-7 h-6 rounded-md flex items-center justify-center text-on-surface-variant/50 hover:bg-black/5 hover:text-on-surface-variant transition-all">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="1.5" rx="0.75" fill="currentColor" /></svg>
      </button>
      <button @click="toggleMaximize" class="w-7 h-6 rounded-md flex items-center justify-center text-on-surface-variant/50 hover:bg-black/5 hover:text-on-surface-variant transition-all">
        <svg v-if="!isMaximized" width="11" height="11" viewBox="0 0 11 11"><rect x="0.5" y="0.5" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
        <svg v-else width="11" height="11" viewBox="0 0 11 11"><rect x="2" y="0" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none" /><rect x="0.5" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="white" /></svg>
      </button>
      <button @click="close" class="w-7 h-6 rounded-md flex items-center justify-center text-on-surface-variant/50 hover:bg-[#FF5F57]/10 hover:text-[#FF5F57] transition-all">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
      </button>
    </div>
  </header>
</template>
