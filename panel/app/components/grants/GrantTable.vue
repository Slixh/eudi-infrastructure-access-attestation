<script setup lang="ts">
import { h, resolveComponent, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Grant } from '~/types/grant'

defineProps<{ grants: Grant[] }>()
const emit = defineEmits<{ revoked: [id: string] }>()

const UButton  = resolveComponent('UButton')
const UIcon    = resolveComponent('UIcon')
const UTooltip = resolveComponent('UTooltip')
const AppStatusBadge = resolveComponent('AppStatusBadge')

const { revokeGrant } = useGrants()
const revoking = ref<string | null>(null)

async function handleRevoke(id: string) {
  if (revoking.value) return
  revoking.value = id
  try {
    await revokeGrant(id)
    emit('revoked', id)
  } finally {
    revoking.value = null
  }
}

const columns: TableColumn<Grant>[] = [
  {
    accessorKey: 'label',
    header: 'Bezeichnung',
    cell: ({ row }) => {
      const { label, pidFirstName, pidFamilyName, pidBirthdate } = row.original
      const hasPid = pidFirstName || pidFamilyName || pidBirthdate
      if (!hasPid) return h('span', { class: 'font-medium text-gray-900 dark:text-white break-words whitespace-normal' }, label)

      const nameParts = [pidFirstName, pidFamilyName].filter(Boolean).join(' ')
      const pidLine   = [nameParts, pidBirthdate].filter(Boolean).join(' · ')

      return h('div', { class: 'flex flex-col gap-0.5' }, [
        h('span', { class: 'font-medium text-gray-900 dark:text-white break-words whitespace-normal' }, label),
        h('span', { class: 'flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500' }, [
          h(UIcon, { name: 'heroicons:user', class: 'w-3 h-3 shrink-0' }),
          h('span', pidLine),
        ]),
      ])
    },
  },
  {
    accessorKey: 'resourceId',
    header: 'Ressourcen',
    cell: ({ row }) => {
      const ids = (row.getValue<string>('resourceId') ?? '').split(',').map(s => s.trim()).filter(Boolean)
      return h('div', { class: 'flex flex-col gap-1' },
        ids.map(id => h('span', { class: 'font-mono text-xs text-gray-500 dark:text-gray-400' }, id))
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue<string>('status')
      return h(AppStatusBadge, { status })
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
      const { id, status } = row.original
      const isRevoked = status === 'REVOKED'
      const isRevoking = revoking.value === id

      return h('div', { class: 'flex items-center justify-end gap-1' }, [
        // QR / Invite button — only for non-active grants
        status !== 'ACTIVE' && !isRevoked
          ? h(UTooltip, { text: 'Einladungsseite' }, () =>
              h(UButton, {
                to:      `/grants/${id}/invite`,
                variant: 'ghost',
                color:   'neutral',
                icon:    'heroicons:qr-code',
                size:    'sm',
              })
            )
          : null,

        // Revoke button — only for non-revoked grants
        !isRevoked
          ? h(UTooltip, { text: 'Zugang widerrufen' }, () =>
              h(UButton, {
                variant: 'ghost',
                color:   'error',
                icon:    isRevoking ? 'heroicons:arrow-path' : 'heroicons:x-circle',
                size:    'sm',
                loading: isRevoking,
                onClick: () => handleRevoke(id),
              })
            )
          : null,
      ])
    },
  },
]
</script>

<template>
  <UTable :data="grants" :columns="columns" class="iaa-table" />
</template>
