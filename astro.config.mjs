import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  vite: {
    server: {
      allowedHosts: true,
    },
    plugins: [tailwindcss()],
  },
  server: {
    host: '0.0.0.0',
    port: 4321,
    allowedHosts: true,
  },
});