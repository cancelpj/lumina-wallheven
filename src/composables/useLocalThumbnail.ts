import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'

/**
 * Local thumbnail resolution.
 *
 * The webview decodes whatever it renders, so pointing an `<img>` at a full
 * resolution 4K wallpaper costs ~33 MB of bitmap memory per image. The Rust
 * side generates a bounded thumbnail instead; this caches the resolved URLs so
 * scrolling back and forth does not re-invoke the backend.
 */

const resolved = new Map<string, string>()
const inFlight = new Map<string, Promise<string>>()

async function resolveThumbnail(path: string): Promise<string> {
  const cached = resolved.get(path)
  if (cached) return cached

  let pending = inFlight.get(path)
  if (!pending) {
    pending = invoke<string>('fetch_wallpaper_thumbnail', { path })
      .then((localPath) => {
        const url = convertFileSrc(localPath)
        resolved.set(path, url)
        inFlight.delete(path)
        return url
      })
      .catch(() => {
        inFlight.delete(path)
        return ''
      })
    inFlight.set(path, pending)
  }

  return pending
}

/**
 * Resolve a local image path to a thumbnail URL.
 *
 * Returns an empty string while the thumbnail is still being generated and if
 * generation failed, so callers can fall back to something else.
 */
export function useLocalThumbnail(path: MaybeRefOrGetter<string | undefined | null>) {
  const src = ref('')

  watch(
    () => toValue(path),
    async (value) => {
      if (!value) {
        src.value = ''
        return
      }

      const url = await resolveThumbnail(value)
      // A newer request may have won the race while this one was in flight.
      if (toValue(path) === value) {
        src.value = url
      }
    },
    { immediate: true },
  )

  return { src }
}
