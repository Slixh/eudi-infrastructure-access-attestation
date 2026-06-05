<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <AppLogo class="w-7 h-7 shrink-0" />
          <span class="font-semibold text-gray-900 dark:text-white whitespace-nowrap">Infrastructure Access Attestation</span>
        </NuxtLink>

        <nav class="flex items-center gap-1">
          <UButton to="/" variant="ghost" color="neutral">Grants</UButton>
          <UButton to="/locations" variant="ghost" color="neutral">Standorte</UButton>
        </nav>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>

    <footer class="border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
        <p class="text-xs text-gray-400 dark:text-gray-600">
          Gebaut von
          <a href="https://github.com/jan-hecker" target="_blank" rel="noopener noreferrer" class="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Jan</a>
          &amp;
          <a href="https://github.com/ivi-kiwi" target="_blank" rel="noopener noreferrer" class="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Iven</a>
          im Rahmen des deutschen EUDI Wallet Hackathons
        </p>
        <a
          href="https://www.sprind.org/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
        >
          sprind.org
        </a>
      </div>
    </footer>
  </div>
</template>
