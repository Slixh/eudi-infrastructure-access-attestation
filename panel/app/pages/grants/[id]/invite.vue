<script setup lang="ts">
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

const qrUrl = computed(() =>
  data.value
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(data.value.deepLink)}`
    : null,
)
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6">
    <UCard class="max-w-md w-full text-center">
      <template v-if="error">
        <UIcon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p class="text-gray-600 dark:text-gray-400">Grant nicht gefunden.</p>
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

        <img
          :src="qrUrl!"
          width="240"
          height="240"
          alt="Einladungs-QR-Code"
          class="mx-auto rounded-xl border border-gray-200 dark:border-gray-700 mb-6"
        >

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
