import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Unit tests run in node; the ones that mount the app ask for a DOM
    // with a `@vitest-environment` comment at the top of the file.
    environment: 'node',
  },
})
