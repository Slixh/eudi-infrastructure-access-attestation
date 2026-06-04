// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',

  devtools: { enabled: true },

  // All source files (pages, layouts, components, assets, …) live in app/.
  // Config files (nuxt.config.ts, package.json, …) stay at the panel root.
  srcDir: 'app',

  // Served at /panel/ — Nuxt router and asset paths are adjusted accordingly.
  // Traefik forwards PathPrefix(`/panel`) without stripping, so Nuxt sees the
  // full path and routes correctly.
  app: {
    baseURL: '/panel/',
  },

  modules: [
    '@nuxt/ui',
    '@nuxt/fonts',
    '@nuxt/icon',
  ],

  // @nuxt/ui v3 bundles Tailwind CSS v4 automatically.
  // No separate tailwindcss module needed.
  css: ['~/assets/css/main.css'],

  fonts: {
    families: [
      { name: 'Inter', provider: 'google' },
    ],
    defaults: {
      weights: [400, 500, 600, 700],
    },
  },

  icon: {
    // Uses Iconify under the hood — any icon set from iconify.design works.
    // Example usage: <Icon name="heroicons:check-circle" />
    serverBundle: {
      collections: ['heroicons', 'lucide'],
    },
  },

  runtimeConfig: {
    public: {
      // API base URL — override with NUXT_PUBLIC_API_BASE in .env
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:3000',
    },
  },
})
