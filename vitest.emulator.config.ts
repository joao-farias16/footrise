import { defineConfig } from 'vitest/config';

// Testes que precisam do Firebase Emulator Suite (Auth + Firestore). Rode com: npm run test:cloud
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.emulator.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
