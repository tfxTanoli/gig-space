import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    dedupe: ['react', 'react-dom', 'react-dom/client'],
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/database',
      'firebase/storage',
    ],
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Raise the warning threshold — the Firebase SDK is large by nature
    chunkSizeWarningLimit: 800,
    sourcemap: false,
    rollupOptions: {
      output: {
        // rolldown (Vite 8) requires manualChunks to be a function
        manualChunks(id: string) {
          if (id.includes('node_modules/firebase')) {
            if (id.includes('firebase/auth')) return 'firebase-auth';
            if (id.includes('firebase/database')) return 'firebase-db';
            if (id.includes('firebase/storage')) return 'firebase-storage';
            return 'firebase-app';
          }
          if (id.includes('node_modules/framer-motion')) return 'framer-motion';
          if (id.includes('node_modules/lucide-react')) return 'lucide';
          if (id.includes('node_modules/@stripe')) return 'stripe';
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-router')) return 'router';
          if (id.includes('node_modules/react-dom')) return 'react-dom-vendor';
          if (id.includes('node_modules/react/')) return 'react-vendor';
        },
      },
    },
  },
})
