<script setup lang="ts">
const { baseURL } = useRuntimeConfig().app

useHead({
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` },
  ],
  titleTemplate: (title) =>
    title ? `${title} · Infrastructure Access Attestation` : 'Infrastructure Access Attestation',
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
