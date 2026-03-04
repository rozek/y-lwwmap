import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry:    './src/LWWMap.ts',
      formats:  ['es'],
      fileName: 'LWWMap',
    },
    rollupOptions: {
      external: ['yjs', 'lib0/observable', 'blueimp-md5'],
    },
  },
  plugins: [
    dts({
      compilerOptions: { rootDir: './src' },
    }),
  ],
  test: {
    environment: 'node',
  },
})
