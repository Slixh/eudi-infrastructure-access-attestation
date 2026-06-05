<script setup lang="ts">
const { grants, refresh } = await useGrants()
const modalOpen = ref(false)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Grants</h1>
      <div class="flex gap-2">
        <UButton icon="heroicons:arrow-path" variant="ghost" color="neutral" @click="refresh" />
        <UButton icon="heroicons:plus" @click="modalOpen = true">Neuer Zugang</UButton>
      </div>
    </div>

    <UCard>
      <GrantsGrantTable :grants="grants ?? []" @revoked="refresh" />
    </UCard>

    <GrantsCreateGrantModal v-model:open="modalOpen" @created="refresh" />
  </div>
</template>
