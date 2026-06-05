<script setup lang="ts">
const { locations, refresh } = await useLocations()
const modalOpen = ref(false)

function reloadLocations() {
  return refresh()
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-400 mb-1">Ressourcenstruktur</p>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Standorte</h1>
      </div>
      <div class="flex gap-2">
        <UButton icon="heroicons:arrow-path" variant="soft" color="primary" @click="reloadLocations">Aktualisieren</UButton>
        <UButton icon="heroicons:plus" class="iaa-primary-button" @click="modalOpen = true">Neuer Standort</UButton>
      </div>
    </div>

    <UCard class="iaa-card">
      <LocationsTable v-if="locations?.length" :locations="locations" />
      <div v-else class="py-14 text-center">
        <UIcon name="heroicons:map-pin" class="w-11 h-11 mx-auto mb-3 text-cyan-500" />
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Noch keine Standorte</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">Lege einen Standort an, um Ressourcen zu gruppieren.</p>
        <UButton icon="heroicons:plus" class="iaa-primary-button" @click="modalOpen = true">Ersten Standort erstellen</UButton>
      </div>
    </UCard>

    <LocationsCreateLocationModal
      v-model:open="modalOpen"
      @created="reloadLocations"
    />
  </div>
</template>
