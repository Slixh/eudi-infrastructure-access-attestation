<script setup lang="ts">
const props = defineProps<{ status: string }>()

const STATUS: Record<string, { label: string; classes: string; dot: string }> = {
  ACTIVE: {
    label: 'Aktiv',
    classes: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/35 dark:text-green-300 dark:ring-green-800',
    dot: 'bg-green-500',
  },
  PENDING: {
    label: 'Ausstehend',
    classes: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-800',
    dot: 'bg-amber-500',
  },
  REVOKED: {
    label: 'Widerrufen',
    classes: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/35 dark:text-rose-300 dark:ring-rose-800',
    dot: 'bg-rose-500',
  },
}

const config = computed(() => STATUS[props.status] ?? {
  label: props.status,
  classes: 'bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700',
  dot: 'bg-gray-400',
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
    :class="config.classes"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="config.dot" />
    {{ config.label }}
  </span>
</template>
