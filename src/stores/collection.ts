import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { WallpaperData } from '@/types/wallhaven'

const STORAGE_KEY = 'wallhaven-collections'

/**
 * The subset of a wallpaper that is worth keeping around.
 *
 * `tags` and `uploader` are dropped: they are the bulk of the payload and
 * nothing in the UI reads them back. Everything the grid and the detail view
 * need is kept, so a slimmed record is still a valid `WallpaperData`.
 */
type CollectionItem = Pick<
  WallpaperData,
  | 'id'
  | 'url'
  | 'short_url'
  | 'views'
  | 'favorites'
  | 'source'
  | 'purity'
  | 'category'
  | 'dimension_x'
  | 'dimension_y'
  | 'resolution'
  | 'ratio'
  | 'file_size'
  | 'file_type'
  | 'created_at'
  | 'colors'
  | 'path'
  | 'thumbs'
>

function toCollectionItem(item: WallpaperData): CollectionItem {
  return {
    id: item.id,
    url: item.url,
    short_url: item.short_url,
    views: item.views,
    favorites: item.favorites,
    source: item.source,
    purity: item.purity,
    category: item.category,
    dimension_x: item.dimension_x,
    dimension_y: item.dimension_y,
    resolution: item.resolution,
    ratio: item.ratio,
    file_size: item.file_size,
    file_type: item.file_type,
    created_at: item.created_at,
    colors: item.colors ?? [],
    path: item.path,
    thumbs: item.thumbs,
  }
}

export const useCollectionStore = defineStore('collection', () => {
  const items = ref<WallpaperData[]>(loadFromStorage())

  function loadFromStorage(): WallpaperData[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []

      // Slim on read too, so records written by an older build do not keep
      // their tags in memory forever.
      return parsed.map(toCollectionItem)
    } catch {
      return []
    }
  }

  function persist() {
    const snapshot = items.value.slice()

    while (snapshot.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
        // Keep memory in step with what actually made it to disk.
        if (snapshot.length !== items.value.length) {
          items.value = snapshot
        }
        return
      } catch {
        // localStorage is full — drop the oldest entry and try again.
        snapshot.pop()
      }
    }

    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing else we can do.
    }
    items.value = []
  }

  function isCollected(id: string): boolean {
    return items.value.some(item => item.id === id)
  }

  function add(item: WallpaperData) {
    if (!isCollected(item.id)) {
      items.value.unshift(toCollectionItem(item))
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
