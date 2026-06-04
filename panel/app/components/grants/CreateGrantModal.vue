<script setup lang="ts">
import type { Grant } from '~/types/grant'

const props = defineProps<{ open: boolean }>()
const emit  = defineEmits<{
  'update:open': [value: boolean]
  created: [grant: Grant]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const { createGrant } = useGrants()

const form = ref({
  label:         '',
  resourceId:    '',
  pidFirstName:  '',
  pidFamilyName: '',
  pidBirthdate:  '',
})
const submitting  = ref(false)
const createdGrant = ref<Grant | null>(null)

const inviteUrl = computed(() =>
  createdGrant.value ? `/grants/${createdGrant.value.id}/invite` : null,
)
const inviteAbsoluteUrl = computed(() => {
  if (!createdGrant.value || typeof window === 'undefined') return ''
  return `${window.location.origin}/panel/grants/${createdGrant.value.id}/invite`
})

async function submit() {
  submitting.value = true
  try {
    const grant = await createGrant(form.value)
    createdGrant.value = grant
    emit('created', grant)
  } finally {
    submitting.value = false
  }
}

function onAfterLeave() {
  form.value = { label: '', resourceId: '', pidFirstName: '', pidFamilyName: '', pidBirthdate: '' }
  createdGrant.value = null
}
</script>

<template>
  <UModal
    v-model:open="modalOpen"
    :title="createdGrant ? 'Zugang erstellt' : 'Neuen Zugang erstellen'"
    @after:leave="onAfterLeave"
  >
    <!-- ── Success ──────────────────────────────────────────────────────────── -->
    <template v-if="createdGrant" #body>
      <div class="space-y-4">
        <div class="flex items-center gap-2 text-green-600 dark:text-green-400">
          <UIcon name="heroicons:check-circle" class="w-5 h-5 shrink-0" />
          <span class="font-medium">{{ createdGrant.label }} wurde erstellt.</span>
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Link zur Einladungsseite:</p>
          <UInput
            :model-value="inviteAbsoluteUrl"
            readonly
            @click="($event.target as HTMLInputElement).select()"
          >
            <template #trailing>
              <UButton
                :to="inviteUrl!"
                icon="heroicons:arrow-top-right-on-square"
                variant="ghost"
                color="neutral"
                size="sm"
              />
            </template>
          </UInput>
        </div>
      </div>
    </template>
    <template v-if="createdGrant" #footer="{ close }">
      <div class="flex justify-end">
        <UButton color="neutral" variant="outline" @click="close">Schließen</UButton>
      </div>
    </template>

    <!-- ── Form ────────────────────────────────────────────────────────────── -->
    <template v-if="!createdGrant" #body>
      <form id="create-grant-form" class="space-y-4" @submit.prevent="submit">
        <UFormField label="Bezeichnung" required>
          <UInput v-model="form.label" placeholder="z.B. Serverraum EG" class="w-full" autofocus />
        </UFormField>

        <UFormField label="Ressource" required>
          <UInput v-model="form.resourceId" placeholder="z.B. door:building-a:floor-0:server" class="w-full" />
        </UFormField>

        <USeparator label="PID-Bindung (optional)" />
        <p class="text-xs text-gray-400 -mt-1">
          Wenn angegeben, wird der Grant nur an diese Person ausgestellt.
        </p>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Vorname">
            <UInput v-model="form.pidFirstName" placeholder="Max" class="w-full" />
          </UFormField>
          <UFormField label="Nachname">
            <UInput v-model="form.pidFamilyName" placeholder="Mustermann" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Geburtsdatum">
          <UInput v-model="form.pidBirthdate" placeholder="1990-01-15" class="w-full" />
        </UFormField>
      </form>
    </template>
    <template v-if="!createdGrant" #footer="{ close }">
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="close">Abbrechen</UButton>
        <UButton
          form="create-grant-form"
          type="submit"
          :loading="submitting"
          :disabled="!form.label || !form.resourceId"
          icon="heroicons:plus"
        >
          Erstellen
        </UButton>
      </div>
    </template>
  </UModal>
</template>
