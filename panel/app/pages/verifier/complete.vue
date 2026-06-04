<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const config = useRuntimeConfig()

const state = route.query.state as string

const { data, error } = await useFetch<{ offerUri: string }>('/verifier/complete', {
  baseURL: config.public.apiBase,
  query: { state },
})

const qrUrl = computed(() =>
  data.value
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.value.offerUri)}`
    : null,
)
</script>

<template>
  <div class="min-h-dvh bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12">
    <UCard class="max-w-md w-full text-center">
      <template v-if="error">
        <UIcon name="heroicons:exclamation-triangle" class="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Session abgelaufen
        </h2>
        <p class="text-sm text-gray-500">
          Das Credential Angebot ist nicht mehr gültig oder wurde bereits abgerufen.
        </p>
      </template>

      <template v-else-if="data">
        <UIcon name="heroicons:check-circle" class="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Identität verifiziert
        </h1>
        <p class="text-sm text-gray-500 mb-6">
          Öffne den Link in deiner EUDI Wallet um dein
          <strong>Zugangs-Credential</strong> abzurufen.
        </p>

        <img
          :src="qrUrl!"
          width="240"
          height="240"
          alt="Credential Offer QR-Code"
          class="mx-auto rounded-xl border border-gray-200 dark:border-gray-700 mb-6"
        >

        <UButton :to="data.offerUri" size="lg" block>
          In EUDI Wallet öffnen
        </UButton>

        <p class="text-sm text-gray-400 mt-4">
          Gleiches Gerät? Button tippen.<br>
          Anderes Gerät? QR-Code scannen.
        </p>
      </template>
    </UCard>
  </div>
</template>
