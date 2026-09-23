import { defineConfig } from 'vite';

// Aligera el HTML de producción: sangría, comentarios y líneas vacías fuera. El documento debe caber en la
// primera ventana de TCP (~14 KB gzip) para que el hero pinte en la primera ida y vuelta.
const minifyHtml = () => ({
  name: 'mtc-minify-html',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html
      .replace(/<!--(?!\[)[\s\S]*?-->/g, '')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{2,}/g, '\n'),
  },
});

export default defineConfig({
  plugins: [minifyHtml()],
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
