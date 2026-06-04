<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const config = useRuntimeConfig()

const { data, error } = await useFetch(`/grants/${route.params.id}/invite`, {
  baseURL: config.public.apiBase,
})

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  ACTIVE:  'success',
  PENDING: 'warning',
  REVOKED: 'error',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:  'Aktiv',
  PENDING: 'Ausstehend',
  REVOKED: 'Widerrufen',
}

</script>

<template>
  <div class="min-h-dvh bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12">
    <UCard class="w-full max-w-md text-center">
      <template v-if="error">
        <UIcon
          :name="error.statusCode === 404 ? 'heroicons:lock-closed' : 'heroicons:exclamation-triangle'"
          class="w-10 h-10 mx-auto mb-3"
          :class="error.statusCode === 404 ? 'text-gray-400' : 'text-red-500'"
        />
        <p class="font-semibold text-gray-800 dark:text-gray-200 mb-1">
          {{ error.statusCode === 404 ? 'Einladung nicht verfügbar' : 'Fehler' }}
        </p>
        <p class="text-sm text-gray-500">
          {{ error.statusCode === 404
            ? 'Dieser Zugang wurde bereits ausgestellt oder existiert nicht.'
            : error.message }}
        </p>
      </template>

      <template v-else-if="data">
        <UBadge
          :color="STATUS_COLOR[data.grant.status] ?? 'neutral'"
          variant="subtle"
          class="mb-3"
        >
          {{ STATUS_LABEL[data.grant.status] ?? data.grant.status }}
        </UBadge>

        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-1">
          {{ data.grant.label }}
        </h1>
        <p class="text-sm text-gray-500 mb-6">
          Ressource: <strong>{{ data.grant.resourceId }}</strong>
        </p>

        <AppQrCode :value="data.deepLink" :size="240" class="mx-auto mb-6" />

        <UButton :to="data.deepLink" size="lg" block class="mb-4">
          In EUDI Wallet öffnen
        </UButton>

        <p class="text-sm text-gray-400 mb-4">
          Gleiche Geräte? Button tippen.<br>
          Anderes Gerät? QR-Code scannen.
        </p>

        <UCard class="text-left" variant="soft">
          <p class="text-xs text-gray-400 mb-1">Deep-Link</p>
          <p class="font-mono text-xs text-gray-600 dark:text-gray-300 break-all">
            {{ data.deepLink }}
          </p>
        </UCard>
      </template>
    </UCard>
  </div>
</template>
