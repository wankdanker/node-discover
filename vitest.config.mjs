import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['dist/lib/**/*.js', 'dist/index.js'],
      exclude: ['examples/**', 'test/**', '**/*.test.js', '**/*.spec.js'],
      all: true,
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
