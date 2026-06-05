<script setup lang="ts">
import { renderSVG } from 'uqr'

const props = defineProps<{
  value: string
  /** Total rendered size in px. Default: 240 */
  size?: number
}>()

const colorMode = useColorMode()

// Tailwind-consistent palette that matches NuxtUI card backgrounds:
//   Light: zinc-900 modules on white
//   Dark:  zinc-50 modules on gray-900 (same as UCard dark bg)
const COLORS = {
  light: { fg: '#18181b', bg: '#ffffff' },
  dark:  { fg: '#fafafa', bg: '#18181b' },
}

const svg = computed(() => {
  const { fg, bg } = colorMode.value === 'dark' ? COLORS.dark : COLORS.light
  return renderSVG(props.value, {
    blackColor: fg,
    whiteColor: bg,
    // ecc M gives a good balance of density vs. error correction
    ecc: 'M',
  })
})

// uqr renders a fixed viewBox; we scale via width/height attrs on the wrapper
const displaySize = computed(() => props.size ?? 240)
const fullscreenOpen = ref(false)

function closeFullscreen() {
  fullscreenOpen.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeFullscreen()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <button
    type="button"
    :style="{ width: `${displaySize}px`, height: `${displaySize}px` }"
    class="overflow-hidden inline-block cursor-zoom-in align-top focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    aria-label="QR-Code im Vollbild anzeigen"
    @click="fullscreenOpen = true"
    v-html="svg"
  />

  <Teleport to="body">
    <div
      v-if="fullscreenOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 p-5"
      role="dialog"
      aria-modal="true"
      aria-label="QR-Code Vollbild"
      @click.self="closeFullscreen"
    >
      <button
        type="button"
        class="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label="Vollbild schließen"
        @click="closeFullscreen"
      >
        <UIcon name="heroicons:x-mark" class="h-5 w-5" />
      </button>

      <div class="bg-white p-4 dark:bg-gray-900">
        <div
          class="h-[min(82vw,82vh)] w-[min(82vw,82vh)] overflow-hidden"
          v-html="svg"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Make the inner SVG fill the wrapper completely */
:deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
