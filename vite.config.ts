import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '0.0.0.0', port: 5180 },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
