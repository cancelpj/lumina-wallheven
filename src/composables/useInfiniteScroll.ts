import { ref, unref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import type { MaybeRef } from 'vue'

export function useInfiniteScroll(
  onIntersect: () => void,
  options?: { threshold?: number; enabled?: MaybeRef<boolean> },
) {
  const target = ref<HTMLElement | null>(null)
  const isExecuting = ref(false)

  const { stop } = useIntersectionObserver(
    target,
    ([{ isIntersecting }]) => {
      if (isIntersecting && !isExecuting.value && (unref(options?.enabled) ?? true)) {
        isExecuting.value = true
        onIntersect()
        setTimeout(() => { isExecuting.value = false }, 300)
      }
    },
    { threshold: options?.threshold ?? 0 },
  )

  return { target, stop }
}
