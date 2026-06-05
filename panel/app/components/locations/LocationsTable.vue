<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Location } from '~/types/location'

defineProps<{ locations: Location[] }>()

const UButton = resolveComponent('UButton')
const UBadge  = resolveComponent('UBadge')

const columns: TableColumn<Location>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) =>
      h('span', { class: 'font-medium text-gray-900 dark:text-white' }, row.original.name),
  },
  {
    id: 'address',
    header: 'Adresse',
    cell: ({ row }) => {
      const { street, postalCode, city } = row.original
      return h('span', { class: 'text-gray-600 dark:text-gray-400' }, `${street}, ${postalCode} ${city}`)
    },
  },
  {
    id: 'resources',
    header: 'Ressourcen',
    cell: ({ row }) => {
      const count = row.original._count?.resources ?? 0
      return h(UBadge, { color: count > 0 ? 'primary' : 'neutral', variant: 'subtle' }, () => String(count))
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Erstellt',
    cell: ({ row }) => new Date(row.getValue<string>('createdAt')).toLocaleDateString('de-DE'),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) =>
      h(UButton, {
        to:      `/locations/${row.original.id}`,
        variant: 'ghost',
        color:   'neutral',
        icon:    'heroicons:arrow-right',
        size:    'sm',
      }),
  },
]
</script>

<template>
  <UTable :data="locations" :columns="columns" />
</template>
