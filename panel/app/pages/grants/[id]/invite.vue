<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { data, error } = await useGrantInvite(route.params.id as string)

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

      <VerifierCompleteError
        v-if="error"
        :code="error.statusCode === 404 ? 'grant_not_found' : 'session_expired'"
        :description="error.statusCode === 404
          ? 'Dieser Zugang wurde bereits ausgestellt oder existiert nicht.'
          : error.message"
      />

      <template v-else-if="data">
        <UBadge :color="STATUS_COLOR[data.grant.status] ?? 'neutral'" variant="subtle" class="mb-3">
          {{ STATUS_LABEL[data.grant.status] ?? data.grant.status }}
        </UBadge>

        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-1">{{ data.grant.label }}</h1>
        <div class="text-sm text-gray-500 mb-6 space-y-1">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Ressourcen</p>
          <p
            v-for="id in data.grant.resourceId.split(',').map(s => s.trim()).filter(Boolean)"
            :key="id"
            class="font-mono text-sm text-gray-700 dark:text-gray-300"
          >
            {{ id }}
          </p>
        </div>

        <AppQrCode :value="data.deepLink" :size="240" class="mx-auto mb-6" />

        <UButton :to="data.deepLink" size="lg" block class="mb-4">In EUDI Wallet öffnen</UButton>

        <p class="text-sm text-gray-400 mb-4">
          Gleiche Geräte? Button tippen.<br>
          Anderes Gerät? QR-Code scannen.
        </p>

        <UCollapsible class="text-left">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            trailing-icon="heroicons:chevron-down"
            class="w-full justify-between text-gray-400"
            :ui="{ trailingIcon: 'transition-transform ui-open:rotate-180' }"
          >
            Deep-Link anzeigen
          </UButton>
          <template #content>
            <div class="mt-2 rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
              <p class="font-mono text-xs text-gray-600 dark:text-gray-300 break-all">{{ data.deepLink }}</p>
            </div>
          </template>
        </UCollapsible>
      </template>

    </UCard>
  </div>
</template>

