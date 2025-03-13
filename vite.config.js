import preact from "@preact/preset-vite"
import { defineConfig } from "vite"
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Important: don't delete headless built files
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'index-nip.js',
        chunkFileNames: 'index-nip-chunk-[name].js',
        assetFileNames: 'index-nip-assets/[name].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      '@store': resolve(__dirname, 'src/modules/store.js'),
      '@components': resolve(__dirname, 'src/components')
    }
  }
})
