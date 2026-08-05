import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ mode }) => {
  // For GitHub Pages, use /data_car/ as base path
  const base = mode === 'production' && process.env.VITE_BASE_PATH 
    ? process.env.VITE_BASE_PATH 
    : '/';
  
  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? { usePolling: false } : undefined,
    },
    // Optimize chunks for large dependencies like pdfjs-dist
    build: {
      chunkSizeWarningLimit: 1000,
    },
  };
});