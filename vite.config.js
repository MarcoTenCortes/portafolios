import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 2048,
    cssCodeSplit: false,
    sourcemap: false
  },
  server: {
    port: 5173,
    open: false
  }
});
