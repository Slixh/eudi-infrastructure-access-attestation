<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Resource } from '~/types/location'

defineProps<{ resources: Resource[] }>()

const UBadge  = resolveComponent('UBadge')

const columns: TableColumn<Resource>[] = [
  {
    accessorKey: 'name',
    header: 'Bezeichnung',
    cell: ({ row }) =>
      h('span', { class: 'font-medium text-gray-900 dark:text-white' }, row.original.name),
  },
  {
    accessorKey: 'identifier',
    header: 'Technische ID',
    cell: ({ row }) =>
      h('span', { class: 'font-mono text-xs text-gray-500 dark:text-gray-400' }, row.original.identifier),
  },
  {
    accessorKey: 'description',
    header: 'Beschreibung',
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-gray-500 dark:text-gray-400' },
        row.original.description ?? '—'),
  },
  {
    id: 'grants',
    header: 'Zugänge',
    cell: ({ row }) => {
      const count = row.original._count?.grants ?? 0
      return h(UBadge, { color: count > 0 ? 'success' : 'neutral', variant: 'subtle' }, () => String(count))
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Erstellt',
    cell: ({ row }) => new Date(row.getValue<string>('createdAt')).toLocaleDateString('de-DE'),
  },
]
</script>

<template>
  <UTable :data="resources" :columns="columns" class="iaa-table" />
</template>
