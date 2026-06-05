<script setup lang="ts">
defineProps<{ offerUri: string }>()
</script>

<template>
  <div class="text-center">
    <div class="flex items-center justify-center gap-2 mb-5">
      <AppLogo class="w-7 h-7" />
      <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Infrastructure Access</span>
    </div>

    <UIcon name="heroicons:check-circle" class="w-12 h-12 text-green-500 mx-auto mb-3" />
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Identität verifiziert</h1>
    <p class="text-sm text-gray-500 mb-6">
      Öffne den Link in deiner EUDI Wallet, um dein
      <strong>Zugangs-Credential</strong> abzurufen.
    </p>

    <div class="iaa-qr-frame inline-block mb-2">
      <AppQrCode :value="offerUri" :size="240" />
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-5">Mit der EUDI Wallet scannen</p>

    <UButton :to="offerUri" size="lg" block class="iaa-primary-button">In EUDI Wallet öffnen</UButton>

    <p class="text-sm text-gray-400 mt-4 mb-6">
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
        Credential-Offer-URI anzeigen
      </UButton>
      <template #content>
        <div class="mt-2 rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
          <p class="font-mono text-xs text-gray-600 dark:text-gray-300 break-all">{{ offerUri }}</p>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
