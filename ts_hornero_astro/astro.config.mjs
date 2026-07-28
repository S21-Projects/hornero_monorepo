// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  // Routes are Spanish, matching /organizaciones and /necesidades. These two
  // shipped in English and the site is already live, so the old paths keep
  // working permanently instead of turning into 404s for anything that linked
  // or indexed them.
  redirects: {
    '/about-us': { status: 301, destination: '/nosotros' },
    '/contact-devs': { status: 301, destination: '/contacto' },
  },
  adapter: node({ mode: 'standalone' }),
  output: 'server',
  vite: {
    plugins: [tailwindcss()],
  },
});
