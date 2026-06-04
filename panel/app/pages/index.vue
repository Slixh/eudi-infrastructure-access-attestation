<script setup lang="ts">
const { data: grants, refresh } = await useFetch('/api/grants', {
  baseURL: useRuntimeConfig().public.apiBase,
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Grants</h1>
      <UButton icon="heroicons:plus" @click="refresh">
        Neu
      </UButton>
    </div>

    <UCard>
      <UTable
        :rows="grants ?? []"
        :columns="[
          { key: 'label',      label: 'Bezeichnung' },
          { key: 'resourceId', label: 'Ressource'   },
          { key: 'status',     label: 'Status'      },
          { key: 'createdAt',  label: 'Erstellt'    },
          { key: 'actions',    label: ''            },
        ]"
      >
        <template #status-data="{ row }">
          <UBadge
            :color="row.status === 'ACTIVE' ? 'success' : row.status === 'REVOKED' ? 'error' : 'neutral'"
            variant="subtle"
          >
            {{ row.status }}
          </UBadge>
        </template>

        <template #createdAt-data="{ row }">
          {{ new Date(row.createdAt).toLocaleDateString('de-DE') }}
        </template>

        <template #actions-data="{ row }">
          <div class="flex gap-2 justify-end">
            <UButton
              :to="`${useRuntimeConfig().public.apiBase}/grants/${row.id}/invite`"
              target="_blank"
              variant="ghost"
              color="neutral"
              icon="heroicons:qr-code"
              size="sm"
            />
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
