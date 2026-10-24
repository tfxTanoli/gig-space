import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Names the built page shell app.html instead of index.html (GIG-77). On
 * Vercel a static index.html is served for "/" before vercel.json's rewrites
 * run, and "/" has to reach the server renderer (api/page.ts) like every
 * other public page. The functions read the shell from /app.html, and every
 * other path that isn't a file is rewritten to it. The dev server still
 * serves index.html as usual.
 */
function shellAsAppHtml(): Plugin {
  return {
    name: 'gigspace:shell-as-app-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const shell = bundle['index.html']
      if (!shell || shell.type !== 'asset') return
      delete bundle['index.html']
      this.emitFile({ type: 'asset', fileName: 'app.html', source: shell.source })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), shellAsAppHtml()],

  resolve: {
    dedupe: ['react', 'react-dom', 'react-dom/client'],
  },

  optimizeDeps: {
    force: true,
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
