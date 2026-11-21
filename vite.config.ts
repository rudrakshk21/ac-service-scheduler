import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { precache } from './vite-plugins/precache.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precache()],
  test: {
    include: ['src/**/*.test.ts', 'vite-plugins/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/intake/**/*.ts', 'src/workspace/**/*.ts', 'src/screens/**/*.ts', 'src/share/**/*.ts', 'vite-plugins/**/*.ts'],
      exclude: [
        'vite-plugins/**/*.test.ts', 'src/share/**/*.test.ts',
        'src/engine/**/*.test.ts', 'src/engine/testing/**',
        'src/intake/**/*.test.ts', 'src/intake/**/testing/**',
        'src/workspace/**/*.test.ts', 'src/screens/**/*.test.ts',
        // Thin browser/React glue (downloads, hooks). Checked in a real browser, not in Node; all logic they call is covered above.
        'src/screens/files.ts', 'src/screens/plan/usePlan.ts', 'src/screens/setup/useAction.ts', 'src/workspace/useWorkspace.ts',
      ],
      thresholds: { statements: 90, lines: 90 },
    },
  },
})
