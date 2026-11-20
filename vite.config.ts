import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/intake/**/*.ts'],
      exclude: [
        'src/engine/**/*.test.ts', 'src/engine/testing/**',
        'src/intake/**/*.test.ts', 'src/intake/**/testing/**',
      ],
      thresholds: { statements: 90, lines: 90 },
    },
  },
})
