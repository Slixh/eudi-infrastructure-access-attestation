<script setup lang="ts">
import type { Location } from '~/types/location'

const props = defineProps<{ open: boolean; location: Location }>()
const emit  = defineEmits<{
  'update:open': [value: boolean]
  updated: [location: Location]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const { updateLocation } = useLocations()

const form = ref({ ...props.location, notes: props.location.notes ?? '' })
watch(() => props.location, (l) => { form.value = { ...l, notes: l.notes ?? '' } })

const submitting = ref(false)

async function submit() {
  submitting.value = true
  try {
    const updated = await updateLocation(props.location.id, {
      name:       form.value.name,
      street:     form.value.street,
      postalCode: form.value.postalCode,
      city:       form.value.city,
      country:    form.value.country,
      notes:      form.value.notes.trim() || undefined,
    })
    emit('updated', updated)
    emit('update:open', false)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="modalOpen" title="Standort bearbeiten">
    <template #body>
      <form id="edit-location-form" class="space-y-4" @submit.prevent="submit">
        <UFormField label="Name" required>
          <UInput v-model="form.name" class="w-full" />
        </UFormField>

        <UFormField label="Straße + Hausnummer" required>
          <UInput v-model="form.street" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-3 gap-3">
          <UFormField label="PLZ" required>
            <UInput v-model="form.postalCode" class="w-full" />
          </UFormField>
          <UFormField label="Stadt" required class="col-span-2">
            <UInput v-model="form.city" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Land">
          <UInput v-model="form.country" class="w-full" />
        </UFormField>

        <UFormField label="Notizen">
          <UTextarea v-model="form.notes" class="w-full" />
        </UFormField>
      </form>
    </template>

    <template #footer="{ close }">
      <div class="flex justify-end gap-2">
        <UButton variant="outline" color="neutral" @click="close">Abbrechen</UButton>
        <UButton
          form="edit-location-form"
          type="submit"
          :loading="submitting"
          icon="heroicons:check"
        >
          Speichern
        </UButton>
      </div>
    </template>
  </UModal>
</template>
