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
    <UCard class="max-w-md w-full">

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

    </UCard>
  </div>
</template>
