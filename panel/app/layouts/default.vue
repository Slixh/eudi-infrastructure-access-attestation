<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()

const navItems = [
  { to: '/', label: 'Zugänge', icon: 'heroicons:key' },
  { to: '/locations', label: 'Standorte', icon: 'heroicons:map-pin' },
]

const isDarkMode = computed(() => colorMode.value === 'dark')
const colorModeLabel = computed(() => isDarkMode.value ? 'Helles Farbschema aktivieren' : 'Dunkles Farbschema aktivieren')
const colorModeIcon = computed(() => isDarkMode.value ? 'heroicons:sun' : 'heroicons:moon')

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

function toggleColorMode() {
  colorMode.preference = isDarkMode.value ? 'light' : 'dark'
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
    <header class="border-b border-blue-800/40 bg-blue-900/95 dark:bg-gray-900/95 backdrop-blur">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <AppLogo class="w-7 h-7 shrink-0" />
          <span class="font-semibold text-white whitespace-nowrap">Infrastructure Access Attestation</span>
        </NuxtLink>

        <div class="flex items-center gap-2">
          <nav class="flex items-center gap-1">
            <UButton
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              variant="ghost"
              color="neutral"
              :icon="item.icon"
              :class="[
                'relative rounded-lg',
                isActive(item.to)
                  ? 'bg-white text-blue-800 hover:bg-white hover:text-blue-800 dark:bg-cyan-950/30 dark:text-cyan-300 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-200 after:absolute after:inset-x-3 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-cyan-400'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'
              ]"
            >
              {{ item.label }}
            </UButton>
          </nav>

          <UTooltip :text="colorModeLabel">
            <UButton
              :icon="colorModeIcon"
              variant="ghost"
              color="neutral"
              square
              :aria-label="colorModeLabel"
              class="text-blue-100 hover:bg-white/10 hover:text-white dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
              @click="toggleColorMode"
            />
          </UTooltip>
        </div>
      </div>
    </header>

    <main class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
