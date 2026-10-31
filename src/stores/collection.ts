import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { WallpaperData } from '@/types/wallhaven'

const STORAGE_KEY = 'wallhaven-collections'

export const useCollectionStore = defineStore('collection', () => {
  const items = ref<WallpaperData[]>(loadFromStorage())

  function loadFromStorage(): WallpaperData[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
  }

  function isCollected(id: string): boolean {
    return items.value.some(item => item.id === id)
  }

  function add(item: WallpaperData) {
    if (!isCollected(item.id)) {
      items.value.unshift(item)
      persist()
    }
  }

  function remove(id: string) {
    const index = items.value.findIndex(item => item.id === id)
    if (index !== -1) {
      items.value.splice(index, 1)
      persist()
    }
  }

  function toggle(item: WallpaperData) {
    if (isCollected(item.id)) {
      remove(item.id)
    } else {
      add(item)
    }
  }

  return { items, isCollected, add, remove, toggle }
})
