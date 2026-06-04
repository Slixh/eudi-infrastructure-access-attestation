<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Icon name="heroicons:shield-check" class="w-7 h-7 text-primary-500" />
          <span class="font-semibold text-gray-900 dark:text-white">EUDI Access Management</span>
        </div>
        <nav class="flex items-center gap-1">
          <UButton to="/" variant="ghost" color="neutral">
            Grants
          </UButton>
        </nav>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>
