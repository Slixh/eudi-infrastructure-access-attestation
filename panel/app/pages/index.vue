<script setup lang="ts">
import { h, resolveComponent, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

interface Grant {
  id: string
  label: string
  resourceId: string
  status: 'PENDING' | 'ACTIVE' | 'REVOKED'
  createdAt: string
}

const config = useRuntimeConfig()
const { data: grants, refresh } = await useFetch<Grant[]>('/grants', {
  baseURL: config.public.apiBase,
})

// ── Create grant modal ────────────────────────────────────────────────────────
const modalOpen = ref(false)
const form = ref({
  label: '',
  resourceId: '',
  pidFirstName: '',
  pidFamilyName: '',
  pidBirthdate: '',
})
const submitting = ref(false)
const createdGrant = ref<Grant | null>(null)

// Vue Router with app.baseURL='/panel/' resolves paths relative to the base.
// Do NOT include /panel/ in :to props — the router adds it automatically.
const inviteUrl = computed(() =>
  createdGrant.value ? `/grants/${createdGrant.value.id}/invite` : null,
)

const inviteAbsoluteUrl = computed(() => {
  if (!createdGrant.value || typeof window === 'undefined') return ''
  return `${window.location.origin}/panel/grants/${createdGrant.value.id}/invite`
})

async function createGrant() {
  submitting.value = true
  try {
    const body: Record<string, string> = {
      label:      form.value.label,
      resourceId: form.value.resourceId,
    }
    if (form.value.pidFirstName.trim())  body.pidFirstName  = form.value.pidFirstName.trim()
    if (form.value.pidFamilyName.trim()) body.pidFamilyName = form.value.pidFamilyName.trim()
    if (form.value.pidBirthdate.trim())  body.pidBirthdate  = form.value.pidBirthdate.trim()

    const grant = await $fetch<Grant>('/grants', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body,
    })
    createdGrant.value = grant
    await refresh()
  } finally {
    submitting.value = false
  }
}

function onModalClose() {
  form.value = { label: '', resourceId: '', pidFirstName: '', pidFamilyName: '', pidBirthdate: '' }
  createdGrant.value = null
}

// ── Table columns ─────────────────────────────────────────────────────────────
const columns: TableColumn<Grant>[] = [
  {
    accessorKey: 'label',
    header: 'Bezeichnung',
  },
  {
    accessorKey: 'resourceId',
    header: 'Ressource',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue<string>('status')
      const color = status === 'ACTIVE' ? 'success' : status === 'REVOKED' ? 'error' : 'neutral'
      return h(UBadge, { color, variant: 'subtle' }, () => status)
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Erstellt',
    cell: ({ row }) =>
      new Date(row.getValue<string>('createdAt')).toLocaleDateString('de-DE'),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      if (row.original.status === 'ACTIVE') return null
      return h(UButton, {
        to: `/grants/${row.original.id}/invite`,
        variant: 'ghost',
        color: 'neutral',
        icon: 'heroicons:qr-code',
        size: 'sm',
      })
    },
  },
]
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Grants</h1>
      <div class="flex gap-2">
        <UButton icon="heroicons:arrow-path" variant="ghost" color="neutral" @click="refresh" />
        <UButton icon="heroicons:plus" @click="modalOpen = true">Neuer Zugang</UButton>
      </div>
    </div>

    <!-- Grants table -->
    <UCard>
      <UTable :data="grants ?? []" :columns="columns" />
    </UCard>

    <!-- Create grant modal -->
    <UModal
      v-model:open="modalOpen"
      :title="createdGrant ? 'Zugang erstellt' : 'Neuen Zugang erstellen'"
      @after:leave="onModalClose"
    >
      <!-- Success state -->
      <template v-if="createdGrant" #body>
        <div class="space-y-4">
          <div class="flex items-center gap-2 text-green-600 dark:text-green-400">
            <UIcon name="heroicons:check-circle" class="w-5 h-5 shrink-0" />
            <span class="font-medium">{{ createdGrant.label }} wurde erstellt.</span>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Link zur Einladungsseite:
            </p>
            <UInput :model-value="inviteAbsoluteUrl" readonly @click="($event.target as HTMLInputElement).select()">
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

      <!-- Form state -->
      <template v-if="!createdGrant" #body>
        <form id="create-grant-form" class="space-y-4" @submit.prevent="createGrant">
          <UFormField label="Bezeichnung" required>
            <UInput
              v-model="form.label"
              placeholder="z.B. Serverraum EG"
              class="w-full"
              autofocus
            />
          </UFormField>

          <UFormField label="Ressource" required>
            <UInput
              v-model="form.resourceId"
              placeholder="z.B. door:building-a:floor-0:server"
              class="w-full"
            />
          </UFormField>

          <USeparator label="PID-Bindung (optional)" />

          <p class="text-xs text-gray-400 -mt-1">
            Wenn angegeben, wird der Grant nur an diese Person ausgestellt.
          </p>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Vorname">
              <UInput
                v-model="form.pidFirstName"
                placeholder="Max"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Nachname">
              <UInput
                v-model="form.pidFamilyName"
                placeholder="Mustermann"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField label="Geburtsdatum">
            <UInput
              v-model="form.pidBirthdate"
              placeholder="1990-01-15"
              class="w-full"
            />
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
  </div>
</template>
