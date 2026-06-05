<script setup lang="ts">
const { grants, refresh } = await useGrants()
const modalOpen = ref(false)

function reloadGrants() {
  return refresh()
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-400 mb-1">Zugangsverwaltung</p>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Zugänge</h1>
      </div>
      <div class="flex gap-2">
        <UButton icon="heroicons:arrow-path" variant="soft" color="primary" @click="reloadGrants">Aktualisieren</UButton>
        <UButton icon="heroicons:plus" class="iaa-primary-button" @click="modalOpen = true">Neuer Zugang</UButton>
      </div>
    </div>

    <UCard class="iaa-card">
      <GrantsGrantTable
        v-if="grants?.length"
        :grants="grants"
        @revoked="reloadGrants"
      />
      <div v-else class="py-14 text-center">
        <UIcon name="heroicons:key" class="w-11 h-11 mx-auto mb-3 text-cyan-500" />
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Noch keine Zugänge</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">Erstelle den ersten Zugang für eine Ressource.</p>
        <UButton icon="heroicons:plus" class="iaa-primary-button" @click="modalOpen = true">Ersten Zugang erstellen</UButton>
      </div>
    </UCard>

    <GrantsCreateGrantModal v-model:open="modalOpen" @created="reloadGrants" />
  </div>
</template>
