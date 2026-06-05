<script setup lang="ts">
const ERROR_CONFIG: Record<string, { icon: string; iconClass: string; title: string }> = {
  pid_mismatch: {
    icon:      'heroicons:user-minus',
    iconClass: 'text-red-500',
    title:     'Identität stimmt nicht überein',
  },
  grant_already_active: {
    icon:      'heroicons:lock-closed',
    iconClass: 'text-gray-400',
    title:     'Zugang bereits vergeben',
  },
  session_expired: {
    icon:      'heroicons:exclamation-triangle',
    iconClass: 'text-amber-500',
    title:     'Sitzung abgelaufen',
  },
}

const props = defineProps<{
  /** Error code from ?error= query param or 'session_expired' for fetch errors */
  code: string
  description?: string
}>()

const config = computed(
  () => ERROR_CONFIG[props.code] ?? { icon: 'heroicons:exclamation-triangle', iconClass: 'text-amber-500', title: 'Fehler' },
)

const fallbackDescription: Record<string, string> = {
  session_expired: 'Das Credential Angebot ist nicht mehr gültig oder wurde bereits abgerufen.',
}
</script>

<template>
  <div class="text-center">
    <UIcon :name="config.icon" class="w-12 h-12 mx-auto mb-3" :class="config.iconClass" />
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ config.title }}</h2>
    <p class="text-sm text-gray-500">
      {{ description ?? fallbackDescription[code] }}
    </p>
  </div>
</template>
