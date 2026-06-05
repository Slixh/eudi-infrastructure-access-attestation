<script setup lang="ts">
const { locations, refresh } = await useLocations()
const modalOpen = ref(false)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Standorte</h1>
      <div class="flex gap-2">
        <UButton icon="heroicons:arrow-path" variant="ghost" color="neutral" @click="refresh" />
        <UButton icon="heroicons:plus" @click="modalOpen = true">Neuer Standort</UButton>
      </div>
    </div>

    <UCard>
      <LocationsTable :locations="locations ?? []" />
    </UCard>

    <LocationsCreateLocationModal
      v-model:open="modalOpen"
      @created="refresh"
    />
  </div>
</template>
