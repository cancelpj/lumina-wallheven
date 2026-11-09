<script setup lang="ts">
import { computed } from 'vue'
import { useLocalThumbnail } from '@/composables/useLocalThumbnail'

/**
 * Renders a local image through its bounded thumbnail.
 *
 * Falls back to `fallback` (typically a remote CDN thumbnail) while the local
 * thumbnail is being generated, or if generation failed.
 */
const props = withDefaults(
  defineProps<{
    path?: string | null
    fallback?: string | null
    alt?: string
  }>(),
  {
    path: null,
    fallback: null,
    alt: '',
  },
)

const { src } = useLocalThumbnail(() => props.path)
const resolved = computed(() => src.value || props.fallback || '')
</script>

<template>
  <img
    :src="resolved"
    :alt="props.alt"
    loading="lazy"
    decoding="async"
    draggable="false"
    referrerpolicy="no-referrer"
  />
</template>
