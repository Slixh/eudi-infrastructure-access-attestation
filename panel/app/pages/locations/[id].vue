<script setup lang="ts">
import type { Location, Resource } from '~/types/location'

const route = useRoute()
const { data: location, refresh } = await useLocation(route.params.id as string)

const editOpen       = ref(false)
const addResourceOpen = ref(false)

function onLocationUpdated(updated: Location) {
  if (location.value) Object.assign(location.value, updated)
}

function onResourceCreated(resource: Resource) {
  if (!location.value) return
  if (!location.value.resources) location.value.resources = []
  location.value.resources.unshift(resource as any)
}
</script>

<template>
  <div v-if="location">
    <!-- Back + actions -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <NuxtLink to="/locations" class="hover:text-blue-600 dark:hover:text-cyan-300 transition-colors">Standorte</NuxtLink>
          <UIcon name="heroicons:chevron-right" class="w-4 h-4" />
          <span class="text-gray-700 dark:text-gray-200">{{ location.name }}</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ location.name }}</h1>
      </div>
      <UButton
        variant="outline"
        color="neutral"
        icon="heroicons:pencil-square"
        @click="editOpen = true"
      >
        Bearbeiten
      </UButton>
    </div>

    <!-- Location info -->
    <UCard class="iaa-card mb-8">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Adresse</p>
          <p class="text-gray-900 dark:text-white">{{ location.street }}</p>
        </div>
        <div>
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">PLZ / Stadt</p>
          <p class="text-gray-900 dark:text-white">{{ location.postalCode }} {{ location.city }}</p>
        </div>
        <div>
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Land</p>
          <p class="text-gray-900 dark:text-white">{{ location.country }}</p>
        </div>
        <div v-if="location.notes" class="sm:col-span-2 lg:col-span-3">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Notizen</p>
          <p class="text-gray-600 dark:text-gray-300 text-sm">{{ location.notes }}</p>
        </div>
      </div>
    </UCard>

    <!-- Resources section -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        Ressourcen
        <UBadge
          :color="(location.resources?.length ?? 0) > 0 ? 'primary' : 'neutral'"
          variant="subtle"
          class="ml-2 ring-1 ring-inset ring-blue-100 dark:ring-blue-900"
        >
          {{ location.resources?.length ?? 0 }}
        </UBadge>
      </h2>
      <UButton icon="heroicons:plus" size="sm" class="iaa-primary-button" @click="addResourceOpen = true">
        Ressource hinzufügen
      </UButton>
    </div>

    <UCard class="iaa-card">
      <template v-if="location.resources?.length">
        <LocationsLocationResourcesList :resources="location.resources" />
      </template>
      <div v-else class="py-12 text-center">
        <UIcon name="heroicons:server" class="w-11 h-11 mx-auto mb-3 text-cyan-500" />
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Noch keine Ressourcen</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">Füge die erste Ressource für diesen Standort hinzu.</p>
        <UButton icon="heroicons:plus" size="sm" class="iaa-primary-button" @click="addResourceOpen = true">
          Erste Ressource hinzufügen
        </UButton>
      </div>
    </UCard>

    <!-- Modals -->
    <LocationsEditLocationModal
      v-model:open="editOpen"
      :location="location"
      @updated="onLocationUpdated"
    />

    <LocationsAddResourceModal
      v-model:open="addResourceOpen"
      :location-id="location.id"
      @created="onResourceCreated"
    />
  </div>
</template>
