<script setup lang="ts">
defineProps<{ offerUri: string }>()
</script>

<template>
  <div class="text-center">
    <UIcon name="heroicons:check-circle" class="w-12 h-12 text-green-500 mx-auto mb-3" />
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Identität verifiziert</h1>
    <p class="text-sm text-gray-500 mb-6">
      Öffne den Link in deiner EUDI Wallet um dein
      <strong>Zugangs-Credential</strong> abzurufen.
    </p>

    <AppQrCode :value="offerUri" :size="240" class="mx-auto mb-6" />

    <UButton :to="offerUri" size="lg" block>In EUDI Wallet öffnen</UButton>

    <p class="text-sm text-gray-400 mt-4">
      Gleiches Gerät? Button tippen.<br>
      Anderes Gerät? QR-Code scannen.
    </p>
  </div>
</template>
