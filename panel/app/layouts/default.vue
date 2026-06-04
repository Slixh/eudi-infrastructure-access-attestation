<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Header with brand gradient matching the logo -->
    <header
      class="border-b border-blue-800/30"
      style="background: linear-gradient(135deg, #0162CB 0%, #00C7FF 100%)"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <!-- Logo + title -->
        <NuxtLink to="/" class="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <img src="/logo.svg" alt="EUDI IAA" class="w-9 h-9" />
          <div class="flex flex-col leading-tight">
            <span class="font-bold text-white text-sm tracking-wide">EUDI Access</span>
            <span class="text-blue-100 text-xs">Infrastructure Access Management</span>
          </div>
        </NuxtLink>

        <nav class="flex items-center gap-1">
          <UButton to="/" variant="ghost" color="white">Grants</UButton>
        </nav>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>
