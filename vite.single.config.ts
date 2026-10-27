import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Сборка в один HTML (JS, CSS и шрифты внутри) — для публикации превью
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist-single', assetsInlineLimit: 100_000_000, target: 'es2020' },
});
