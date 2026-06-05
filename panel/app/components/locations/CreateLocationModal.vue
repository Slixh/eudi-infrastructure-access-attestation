<script setup lang="ts">
import type { Location } from '~/types/location'

const props = defineProps<{ open: boolean }>()
const emit  = defineEmits<{
  'update:open': [value: boolean]
  created: [location: Location]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const { createLocation } = useLocations()

const form = ref({ name: '', street: '', postalCode: '', city: '', country: 'DE', notes: '' })
const submitting  = ref(false)
const created = ref<Location | null>(null)

async function submit() {
  submitting.value = true
  try {
    const location = await createLocation({
      name:       form.value.name,
      street:     form.value.street,
      postalCode: form.value.postalCode,
      city:       form.value.city,
      country:    form.value.country || 'DE',
      notes:      form.value.notes.trim() || undefined,
    })
    created.value = location
    emit('created', location)
  } finally {
    submitting.value = false
  }
}

function onAfterLeave() {
  form.value = { name: '', street: '', postalCode: '', city: '', country: 'DE', notes: '' }
  created.value = null
}
</script>

<template>
  <UModal
    v-model:open="modalOpen"
    :title="created ? 'Standort erstellt' : 'Neuer Standort'"
    @after:leave="onAfterLeave"
  >
    <!-- Success -->
    <template v-if="created" #body>
      <div class="flex items-center gap-2 text-green-600 dark:text-green-400">
        <UIcon name="heroicons:check-circle" class="w-5 h-5 shrink-0" />
        <span class="font-medium">{{ created.name }} wurde erstellt.</span>
      </div>
    </template>
    <template v-if="created" #footer="{ close }">
      <div class="flex justify-end gap-2">
        <UButton variant="outline" color="neutral" @click="close">Schließen</UButton>
        <UButton :to="`/locations/${created.id}`" icon="heroicons:arrow-right" @click="close">
          Zum Standort
        </UButton>
      </div>
    </template>

    <!-- Form -->
    <template v-if="!created" #body>
      <form id="create-location-form" class="space-y-4" @submit.prevent="submit">
        <UFormField label="Name" required>
          <UInput v-model="form.name" placeholder="TU Berlin – Hauptgebäude" class="w-full" autofocus />
        </UFormField>

        <UFormField label="Straße + Hausnummer" required>
          <UInput v-model="form.street" placeholder="Straße des 17. Juni 135" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-3 gap-3">
          <UFormField label="PLZ" required>
            <UInput v-model="form.postalCode" placeholder="10623" class="w-full" />
          </UFormField>
          <UFormField label="Stadt" required class="col-span-2">
            <UInput v-model="form.city" placeholder="Berlin" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Land">
          <UInput v-model="form.country" placeholder="DE" class="w-full" />
        </UFormField>

        <UFormField label="Notizen">
          <UTextarea v-model="form.notes" placeholder="Optionale Anmerkungen zum Standort" class="w-full" />
        </UFormField>
      </form>
    </template>
    <template v-if="!created" #footer="{ close }">
      <div class="flex justify-end gap-2">
        <UButton variant="outline" color="neutral" @click="close">Abbrechen</UButton>
        <UButton
          form="create-location-form"
          type="submit"
          :loading="submitting"
          :disabled="!form.name || !form.street || !form.postalCode || !form.city"
          icon="heroicons:plus"
        >
          Erstellen
        </UButton>
      </div>
    </template>
  </UModal>
</template>
