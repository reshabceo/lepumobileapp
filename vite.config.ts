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
  },
}));

