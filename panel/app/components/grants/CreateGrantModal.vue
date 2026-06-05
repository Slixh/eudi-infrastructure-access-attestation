<script setup lang="ts">
import { reactive } from 'vue'
import type { Grant } from '~/types/grant'
import type { Location, Resource } from '~/types/location'

const props = defineProps<{ open: boolean }>()
const emit  = defineEmits<{
  'update:open': [value: boolean]
  created: [grant: Grant]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const config          = useRuntimeConfig()
const { createGrant } = useGrants()
const { locations }   = await useLocations()

// ── Row model ────────────────────────────────────────────────────────────────
interface Row {
  locationId: string
  resourceId: string
  resources:  Resource[]
  loading:    boolean
}

function makeRow(): Row {
  const row = reactive<Row>({ locationId: '', resourceId: '', resources: [], loading: false })

  watch(() => row.locationId, async (id) => {
    row.resourceId = ''
    row.resources  = []
    if (!id) return
    row.loading = true
    try {
      const loc = await $fetch<Location>(`/locations/${id}`, { baseURL: config.public.apiBase })
      row.resources = loc.resources ?? []
    } finally {
      row.loading = false
    }
  })

  return row
}

const rows = ref<Row[]>([makeRow()])

function addRow()       { rows.value.push(makeRow()) }
function removeRow(i: number) { rows.value.splice(i, 1) }

// ── Location / Resource select items ─────────────────────────────────────────
const locationItems = computed(() =>
  (locations.value ?? []).map(l => ({ label: `${l.name} — ${l.city}`, value: l.id }))
)

function resourceItems(row: Row) {
  return row.resources.map(r => ({ label: r.name, value: r.id }))
}

function selectedResource(row: Row): Resource | undefined {
  return row.resources.find(r => r.id === row.resourceId)
}

// ── Form state ────────────────────────────────────────────────────────────────
const form = ref({ label: '', pidFirstName: '', pidFamilyName: '', pidBirthdate: '' })
const submitting    = ref(false)
const createdGrant  = ref<Grant | null>(null)
const labelTouched  = ref(false)

// ── Auto-label ────────────────────────────────────────────────────────────────
// Strategy:
//  • Use location.city (short) instead of location.name (long)
//  • Group resources by location → "City – Res A, Res B"
//  • Multiple locations → groups joined with " | "
//  • Nothing selected → empty (placeholder takes over)
const autoLabel = computed(() => {
  const completed = rows.value.filter(r => r.locationId && r.resourceId)
  if (completed.length === 0) return ''

  // Build a map: locationId → { city, resourceNames[] }
  const groups = new Map<string, { city: string; names: string[] }>()
  for (const row of completed) {
    const loc = (locations.value ?? []).find(l => l.id === row.locationId)
    const res = selectedResource(row)
    if (!loc || !res) continue
    if (!groups.has(row.locationId))
      groups.set(row.locationId, { city: loc.city, names: [] })
    groups.get(row.locationId)!.names.push(res.name)
  }

  return [...groups.values()]
    .map(({ city, names }) => `${city} – ${names.join(', ')}`)
    .join(' | ')
})

watch(autoLabel, (val) => { if (!labelTouched.value) form.value.label = val })

function onLabelInput(e: Event) {
  const typed = (e.target as HTMLInputElement).value
  labelTouched.value = typed !== autoLabel.value
  form.value.label   = typed
}
function onLabelBlur() {
  if (!form.value.label.trim()) {
    labelTouched.value = false
    form.value.label   = autoLabel.value
  }
}

// ── Derived ───────────────────────────────────────────────────────────────────
const canSubmit = computed(() =>
  !!form.value.label &&
  rows.value.length > 0 &&
  rows.value.every(r => !!r.resourceId)
)

const inviteUrl = computed(() =>
  createdGrant.value ? `/grants/${createdGrant.value.id}/invite` : null,
)
const inviteAbsoluteUrl = computed(() => {
  if (!createdGrant.value || typeof window === 'undefined') return ''
  return `${window.location.origin}/panel/grants/${createdGrant.value.id}/invite`
})

// ── Submit / Reset ────────────────────────────────────────────────────────────
async function submit() {
  submitting.value = true
  try {
    const grant = await createGrant({
      label:             form.value.label,
      resourceEntityIds: rows.value.map(r => r.resourceId).filter(Boolean),
      pidFirstName:      form.value.pidFirstName  || undefined,
      pidFamilyName:     form.value.pidFamilyName || undefined,
      pidBirthdate:      form.value.pidBirthdate  || undefined,
    })
    createdGrant.value = grant
    emit('created', grant)
  } finally {
    submitting.value = false
  }
}

function onAfterLeave() {
  form.value         = { label: '', pidFirstName: '', pidFamilyName: '', pidBirthdate: '' }
  rows.value         = [makeRow()]
  createdGrant.value = null
  labelTouched.value = false
}
</script>

<template>
  <UModal
    v-model:open="modalOpen"
    :title="createdGrant ? 'Zugang erstellt' : 'Neuen Zugang erstellen'"
    :ui="{ content: 'max-w-4xl w-full' }"
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
      <form id="create-grant-form" class="space-y-5" @submit.prevent="submit">

        <!-- Bezeichnung -->
        <UFormField label="Bezeichnung" required>
          <UInput
            :model-value="form.label"
            :placeholder="autoLabel || 'Wird automatisch generiert …'"
            class="w-full"
            autofocus
            @input="onLabelInput"
            @blur="onLabelBlur"
          >
            <template v-if="labelTouched" #trailing>
              <UTooltip text="Automatisch generieren">
                <UButton
                  icon="heroicons:arrow-path"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  @click="labelTouched = false; form.label = autoLabel"
                />
              </UTooltip>
            </template>
          </UInput>
        </UFormField>

        <!-- Resource rows -->
        <div class="space-y-3">
          <div
            v-for="(row, i) in rows"
            :key="i"
            class="flex gap-2 items-start"
          >
            <!-- Location -->
            <UFormField :label="i === 0 ? 'Standort' : ''" class="flex-1 min-w-0">
              <USelect
                v-model="row.locationId"
                :items="locationItems"
                placeholder="Standort …"
                class="w-full"
              />
            </UFormField>

            <!-- Resource -->
            <UFormField :label="i === 0 ? 'Ressource' : ''" class="flex-1 min-w-0">
              <div>
                <USelect
                  v-model="row.resourceId"
                  :items="resourceItems(row)"
                  :disabled="!row.locationId || row.loading || resourceItems(row).length === 0"
                  :placeholder="row.loading ? 'Laden …' : !row.locationId ? '← Standort wählen' : resourceItems(row).length === 0 ? 'Keine Ressourcen' : 'Ressource …'"
                  class="w-full"
                />
                <p v-if="selectedResource(row)" class="mt-1 text-xs font-mono text-gray-400 dark:text-gray-500 truncate">
                  {{ selectedResource(row)?.identifier }}
                </p>
              </div>
            </UFormField>

            <!-- Remove -->
            <div :class="i === 0 ? 'mt-6' : 'mt-0.5'">
              <UButton
                icon="heroicons:x-mark"
                variant="ghost"
                color="neutral"
                size="sm"
                :disabled="rows.length === 1"
                @click="removeRow(i)"
              />
            </div>
          </div>

          <!-- Add row -->
          <UButton
            icon="heroicons:plus"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="addRow"
          >
            Weitere Ressource
          </UButton>
        </div>

        <!-- PID binding -->
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
          :disabled="!canSubmit"
          icon="heroicons:plus"
        >
          Erstellen
        </UButton>
      </div>
    </template>
  </UModal>
</template>
