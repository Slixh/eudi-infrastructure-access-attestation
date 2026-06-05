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
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <UButton
          to="/locations"
          variant="ghost"
          color="neutral"
          icon="heroicons:arrow-left"
          size="sm"
        />
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
    <UCard class="mb-8">
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
          class="ml-2"
        >
          {{ location.resources?.length ?? 0 }}
        </UBadge>
      </h2>
      <UButton icon="heroicons:plus" size="sm" @click="addResourceOpen = true">
        Ressource hinzufügen
      </UButton>
    </div>

    <UCard>
      <template v-if="location.resources?.length">
        <LocationsLocationResourcesList :resources="location.resources" />
      </template>
      <div v-else class="py-10 text-center text-gray-400 dark:text-gray-600">
        <UIcon name="heroicons:server" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p class="text-sm">Noch keine Ressourcen an diesem Standort</p>
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
