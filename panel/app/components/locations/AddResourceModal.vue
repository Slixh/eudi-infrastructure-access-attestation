<script setup lang="ts">
import type { Resource } from '~/types/location'

const props = defineProps<{ open: boolean; locationId: string }>()
const emit  = defineEmits<{
  'update:open': [value: boolean]
  created: [resource: Resource]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const { createResource } = useResources()

const form = ref({ name: '', identifier: '', description: '' })
const submitting = ref(false)
const error      = ref<string | null>(null)

async function submit() {
  submitting.value = true
  error.value = null
  try {
    const resource = await createResource({
      name:        form.value.name,
      identifier:  form.value.identifier,
      description: form.value.description.trim() || undefined,
      locationId:  props.locationId,
    })
    emit('created', resource)
    emit('update:open', false)
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Fehler beim Erstellen der Ressource'
  } finally {
    submitting.value = false
  }
}

function onAfterLeave() {
  form.value = { name: '', identifier: '', description: '' }
  error.value = null
}
</script>

<template>
  <UModal v-model:open="modalOpen" title="Ressource hinzufügen" @after:leave="onAfterLeave">
    <template #body>
      <form id="add-resource-form" class="space-y-4" @submit.prevent="submit">
        <UFormField label="Bezeichnung" required>
          <UInput v-model="form.name" placeholder="Serverraum EG" class="w-full" autofocus />
        </UFormField>

        <UFormField label="Technische ID" required hint="Eindeutige ID für den EAA-Credential-Claim">
          <UInput
            v-model="form.identifier"
            placeholder="door:building-a:floor-0:server"
            class="w-full font-mono text-sm"
          />
        </UFormField>

        <UFormField label="Beschreibung">
          <UTextarea v-model="form.description" placeholder="Optionale Beschreibung der Ressource" class="w-full" />
        </UFormField>

        <UAlert v-if="error" color="error" variant="soft" :description="error" />
      </form>
    </template>

    <template #footer="{ close }">
      <div class="flex justify-end gap-2">
        <UButton variant="outline" color="neutral" @click="close">Abbrechen</UButton>
        <UButton
          form="add-resource-form"
          type="submit"
          :loading="submitting"
          :disabled="!form.name || !form.identifier"
          icon="heroicons:plus"
        >
          Hinzufügen
        </UButton>
      </div>
    </template>
  </UModal>
</template>
