import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode standalone` genera una versión que se abre con doble clic (file://):
// código y fuentes dentro de index.html, imágenes en carpetas relativas.
export default defineConfig(({ mode }) => {
  const local = mode === 'standalone';
  return {
    base: local ? './' : '/',
    plugins: [react(), ...(local ? [viteSingleFile()] : [])],
    server: { port: 5174, strictPort: true },
    build: local ? { outDir: '../Final Girl (jugar sin servidor)', emptyOutDir: true } : {},
    test: {
      include: ['src/**/*.test.ts'],
    },
  };
});
