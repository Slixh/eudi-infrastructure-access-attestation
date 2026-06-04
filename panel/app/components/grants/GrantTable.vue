<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Grant } from '~/types/grant'

defineProps<{ grants: Grant[] }>()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon   = resolveComponent('UIcon')

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:  'success',
  REVOKED: 'error',
  PENDING: 'neutral',
}

const columns: TableColumn<Grant>[] = [
  {
    accessorKey: 'label',
    header: 'Bezeichnung',
    cell: ({ row }) => {
      const { label, pidFirstName, pidFamilyName, pidBirthdate } = row.original
      const hasPid = pidFirstName || pidFamilyName || pidBirthdate
      if (!hasPid) return h('span', label)

      const nameParts = [pidFirstName, pidFamilyName].filter(Boolean).join(' ')
      const pidLine   = [nameParts, pidBirthdate].filter(Boolean).join(' · ')

      return h('div', { class: 'flex flex-col gap-0.5' }, [
        h('span', label),
        h('span', { class: 'flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500' }, [
          h(UIcon, { name: 'heroicons:user', class: 'w-3 h-3 shrink-0' }),
          h('span', pidLine),
        ]),
      ])
    },
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
      return h(UBadge, { color: STATUS_COLOR[status] ?? 'neutral', variant: 'subtle' }, () => status)
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
        to:      `/grants/${row.original.id}/invite`,
        variant: 'ghost',
        color:   'neutral',
        icon:    'heroicons:qr-code',
        size:    'sm',
      })
    },
  },
]
</script>

<template>
  <UTable :data="grants" :columns="columns" />
</template>
