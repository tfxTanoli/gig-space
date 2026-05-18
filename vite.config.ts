import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  // basicSsl runs the dev server over HTTPS so signInWithRedirect can use
  // the dev origin as its authDomain (Firebase builds an https:// handler URL).
  plugins: [react(), tailwindcss(), basicSsl()],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy Firebase's auth handler so /__/auth/* is served same-origin with
      // the dev server — required for the signInWithRedirect flow to complete.
      '/__': {
        target: 'https://gigspace-208b4.firebaseapp.com',
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
