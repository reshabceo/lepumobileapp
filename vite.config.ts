import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  // ── Polyfills required by @aws-sdk in browser / Capacitor WebView ──────────
  define: {
    global: 'globalThis',
    'process.env': '{}',
    'process.browser': true,
  },
  optimizeDeps: {
    include: [
      'jspdf',
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@radix-ui/react-tooltip',
      '@aws-sdk/client-s3',
      '@aws-sdk/lib-storage',
    ],
    esbuildOptions: {
      // Provide Node.js globals for packages that expect them
      define: {
        global: 'globalThis',
      },
      resolveExtensions: ['.jsx', '.js', '.ts', '.tsx'],
    },
  },
  build: {
    target: 'es2022',
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    chunkSizeWarningLimit: 1000,
    // Don't preload heavy lazy-only vendor chunks on first paint —
    // they'll load when their dynamic import actually fires.
    modulePreload: {
      polyfill: false,
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (d) =>
            !d.includes('vendor-pdf') &&
            !d.includes('vendor-aws') &&
            !d.includes('vendor-charts') &&
            !d.includes('vendor-icons') &&
            !d.includes('vendor-capacitor')
        ),
    },
    rollupOptions: {
      output: {
        // Split heavy vendor libraries into separate, cacheable chunks so they
        // are only downloaded/parsed when a page that needs them is opened.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@aws-sdk')) return 'vendor-aws';
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) return 'vendor-pdf';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('@capacitor')) return 'vendor-capacitor';
          if (id.includes('date-fns')) return 'vendor-date';
          if (id.includes('socket.io')) return 'vendor-socket';
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
}));

