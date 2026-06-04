<script setup lang="ts">
import { h, resolveComponent } from 'vue'
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
        to: `${config.public.apiBase}/grants/${row.original.id}/invite`,
        target: '_blank',
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
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Grants</h1>
      <UButton icon="heroicons:arrow-path" variant="ghost" color="neutral" @click="refresh" />
    </div>

    <UCard>
      <UTable :data="grants ?? []" :columns="columns" />
    </UCard>
  </div>
</template>
