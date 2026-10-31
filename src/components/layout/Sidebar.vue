<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const navGroups = [
  {
    label: '在线壁纸',
    items: [
      { id: 'hot', label: '热门推荐', path: '/hot', icon: 'local_fire_department' },
      { id: 'acg', label: '动漫精选', path: '/acg', icon: 'auto_awesome' },
      { id: 'people', label: '人物精选', path: '/people', icon: 'groups' },
    ],
  },
  {
    label: '我的壁纸',
    items: [
      { id: 'collection', label: '我的收藏', path: '/collection', icon: 'favorite' },
      { id: 'download', label: '下载中心', path: '/download', icon: 'download' },
    ],
  },
  {
    label: '其他',
    items: [
      { id: 'settings', label: '设置', path: '/settings', icon: 'settings' },
      { id: 'about', label: '关于', path: '/about', icon: 'info' },
    ],
  },
]

const activePath = computed(() => route.path)

function isActive(path: string): boolean {
  return activePath.value === path
}

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <aside class="w-sidebar_width h-screen sticky left-0 top-0 z-20 flex flex-col p-6 shadow-xl m-4 rounded-2xl border border-black/5 bg-white/40 backdrop-blur-[40px]">
    <div class="mb-10 px-2">
      <h1 class="text-headline-xl text-primary leading-tight">Lumina</h1>
      <p class="text-body-sm text-on-surface-variant font-medium">4K Creative Gallery</p>
    </div>
    <nav class="flex-1 space-y-8">
      <section v-for="group in navGroups" :key="group.label" class="space-y-2">
        <div class="px-4 text-label-caps text-on-surface-variant/70">{{ group.label }}</div>
        <a
          v-for="item in group.items"
          :key="item.id"
          class="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300"
          :class="isActive(item.path)
            ? 'bg-primary text-on-primary font-semibold border border-primary/20 shadow-lg shadow-primary/20'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-black/5'"
          href="#"
          @click.prevent="navigate(item.path)"
        >
          <span class="material-symbols-outlined">{{ item.icon }}</span>
          <span class="text-body-md">{{ item.label }}</span>
        </a>
      </section>
    </nav>
    <div class="mt-auto pt-6 border-t border-black/5">
      <div class="flex items-center gap-3 px-4 py-3 bg-surface-container-low rounded-2xl border border-black/5">
        <div class="w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0" :class="userStore.apiKey ? 'border-green-400/40' : 'border-primary/20'">
          <div class="w-full h-full bg-gradient-to-br from-primary to-primary-fixed-dim flex items-center justify-center">
            <span class="text-on-primary text-sm font-bold">{{ userStore.username.charAt(0) }}</span>
          </div>
        </div>
        <div class="flex flex-col">
          <span class="text-body-sm font-bold text-on-surface">{{ userStore.username }}</span>
          <span class="text-label-caps text-[10px] text-primary/70 uppercase tracking-widest">{{ userStore.statusLabel }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
aside {
  margin: 1rem;
  width: 280px;
  height: calc(100vh - 2rem);
}
</style>
