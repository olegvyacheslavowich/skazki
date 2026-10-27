import { defineConfig } from 'vite';

// base: './' — относительные пути, чтобы сборка работала внутри Capacitor WebView (file/capacitor://)
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
