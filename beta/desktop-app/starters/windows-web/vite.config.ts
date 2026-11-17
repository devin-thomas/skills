import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `vite build` writes dist/, which the Electron main process serves over app://.
export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
      cssTarget: 'chrome140',
      cssCodeSplit: false,
      reportCompressedSize: true,
      // One local bundle on purpose: the shell loads it from disk, not over a network.
      chunkSizeWarningLimit: 800,
    },
    server: { host: '127.0.0.1' },
  };
});
