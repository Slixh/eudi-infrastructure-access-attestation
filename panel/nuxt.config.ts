// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',

  devtools: { enabled: true },

  // All source files (pages, layouts, components, assets, …) live in app/.
  // Config files (nuxt.config.ts, package.json, …) stay at the panel root.
  srcDir: 'app',

  // Admin panel — no need for SSR. Avoids Docker-internal fetch issues where
  // the panel container can't reach the public API domain during server render.
  ssr: false,

  app: {
    baseURL: '/panel/',
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/panel/favicon.svg' },
      ],
      titleTemplate: '%s · Infrastructure Access Attestation',
    },
  },

  modules: [
    '@nuxt/ui',
    '@nuxt/fonts',
    '@nuxt/icon',
  ],

  ui: {
    // Use 'blue' as the base for primary — closest preset to the logo #0162CB.
    // The exact shade is then overridden via CSS custom properties in main.css.
    colors: {
      primary: 'blue',
    },
  },

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
