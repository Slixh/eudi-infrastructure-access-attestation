<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const state            = route.query.state as string
const errorCode        = route.query.error as string | undefined
const errorDescription = route.query.error_description as string | undefined

const { data, error: fetchError } = errorCode
  ? { data: ref(null), error: ref(null) }
  : await useVerifierComplete(state)
</script>

<template>
  <div class="min-h-dvh bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12">
    <UCard class="iaa-card max-w-md w-full overflow-hidden" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="h-1.5 bg-[linear-gradient(120deg,#0162cb,#00c7ff)]" />
      <div class="p-6 sm:p-8">

      <VerifierCompleteError
        v-if="errorCode"
        :code="errorCode"
        :description="errorDescription"
      />

      <VerifierCompleteError
        v-else-if="fetchError"
        code="session_expired"
      />

        <VerifierCompleteSuccess
          v-else-if="data"
          :offer-uri="data.offerUri"
        />

      </div>
    </UCard>
  </div>
</template>
