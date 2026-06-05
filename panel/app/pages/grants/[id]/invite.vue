<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { data, error } = await useGrantInvite(route.params.id as string)
</script>

<template>
  <div class="min-h-dvh bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12">
    <UCard class="iaa-card w-full max-w-md overflow-hidden text-center" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="h-1.5 bg-[linear-gradient(120deg,#0162cb,#00c7ff)]" />
      <div class="p-6 sm:p-8">
        <VerifierCompleteError
          v-if="error"
          :code="error.statusCode === 404 ? 'grant_not_found' : 'session_expired'"
          :description="error.statusCode === 404
            ? 'Dieser Zugang wurde bereits ausgestellt oder existiert nicht.'
            : error.message"
        />

        <template v-else-if="data">
          <div class="flex items-center justify-center gap-2 mb-5">
            <AppLogo class="w-7 h-7" />
            <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Infrastructure Access</span>
          </div>

          <AppStatusBadge :status="data.grant.status" />

          <h1 class="text-xl font-bold text-gray-900 dark:text-white mt-4 mb-1">{{ data.grant.label }}</h1>
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

          <div class="iaa-qr-frame inline-block mb-2">
            <AppQrCode :value="data.deepLink" :size="240" />
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-5">Mit der EUDI Wallet scannen</p>

          <UButton :to="data.deepLink" size="lg" block class="iaa-primary-button mb-4">In EUDI Wallet öffnen</UButton>

          <p class="text-sm text-gray-400 mb-4">
            Gleiches Gerät? Button tippen.<br>
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
      </div>
    </UCard>
  </div>
</template>
