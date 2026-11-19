import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: 'client',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fromRoot('./client/src'),
      '@shared': fromRoot('./shared'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Variáveis e mixins disponíveis em todo arquivo .scss, sem precisar importar
        additionalData: '@use "@/styles/abstracts" as *;\n',
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
