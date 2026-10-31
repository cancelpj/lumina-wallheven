import { ref, onMounted, onUnmounted } from 'vue'

export function useMouseGlow() {
  const glowX = ref(0)
  const glowY = ref(0)

  function onMouseMove(e: MouseEvent) {
    glowX.value = e.clientX
    glowY.value = e.clientY
  }

  onMounted(() => {
    window.addEventListener('mousemove', onMouseMove, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('mousemove', onMouseMove)
  })

  return { glowX, glowY }
}
