import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.test.ts'],
    exclude: ['src/tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/utils/**', 'src/config/**'],
      exclude: ['src/**/*.test.js'],
    },
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      // Proje kökünden import için
    },
  },
});
