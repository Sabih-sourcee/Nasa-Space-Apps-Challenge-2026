
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: false },
  build: { chunkSizeWarningLimit: 1600 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
