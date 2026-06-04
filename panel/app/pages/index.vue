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
const form = ref({ label: '', resourceId: '' })
const submitting = ref(false)
const createdGrant = ref<Grant | null>(null)

const inviteUrl = computed(() =>
  createdGrant.value ? `/panel/grants/${createdGrant.value.id}/invite` : null,
)

async function createGrant() {
  submitting.value = true
  try {
    const grant = await $fetch<Grant>('/grants', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: form.value,
    })
    createdGrant.value = grant
    await refresh()
  } finally {
    submitting.value = false
  }
}

function closeModal() {
  modalOpen.value = false
  // reset after transition
  setTimeout(() => {
    form.value = { label: '', resourceId: '' }
    createdGrant.value = null
  }, 200)
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
    cell: ({ row }) =>
      h(UButton, {
        to: `/panel/grants/${row.original.id}/invite`,
        variant: 'ghost',
        color: 'neutral',
        icon: 'heroicons:qr-code',
        size: 'sm',
      }),
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
    <UModal v-model:open="modalOpen" title="Neuen Zugang erstellen" @close="closeModal">
      <!-- After creation: show invite link -->
      <template v-if="createdGrant">
        <div class="space-y-4">
          <div class="flex items-center gap-2 text-green-600 dark:text-green-400">
            <UIcon name="heroicons:check-circle" class="w-5 h-5 shrink-0" />
            <span class="font-medium">Zugang erstellt</span>
          </div>

          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Teile diesen Link um den Einladungs-QR-Code anzuzeigen:
            </p>
            <UInput
              :model-value="`${$config.public.apiBase.replace('/api', '')}/panel/grants/${createdGrant.id}/invite`"
              readonly
              @click="($event.target as HTMLInputElement).select()"
            >
              <template #trailing>
                <UButton
                  icon="heroicons:arrow-top-right-on-square"
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  :to="inviteUrl!"
                />
              </template>
            </UInput>
          </div>

          <div class="flex justify-end">
            <UButton variant="outline" color="neutral" @click="closeModal">Schließen</UButton>
          </div>
        </div>
      </template>

      <!-- Form -->
      <template v-else>
        <form class="space-y-4" @submit.prevent="createGrant">
          <UFormField label="Bezeichnung" required>
            <UInput
              v-model="form.label"
              placeholder="z.B. Serverraum EG"
              autofocus
              required
            />
          </UFormField>

          <UFormField label="Ressource" required>
            <UInput
              v-model="form.resourceId"
              placeholder="z.B. door:building-a:floor-0:server"
              required
            />
          </UFormField>

          <div class="flex justify-end gap-2 pt-1">
            <UButton variant="outline" color="neutral" type="button" @click="closeModal">
              Abbrechen
            </UButton>
            <UButton type="submit" :loading="submitting" icon="heroicons:plus">
              Erstellen
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
