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
</script>

<template>
  <div
    :style="{ width: `${displaySize}px`, height: `${displaySize}px` }"
    class="rounded-xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 inline-block"
    v-html="svg"
  />
</template>

<style scoped>
/* Make the inner SVG fill the wrapper completely */
:deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
