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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@fhevm/mock-utils"],
  },
  build: {
    rollupOptions: {
      external: (id) => {
        // Exclude @fhevm/mock-utils from production bundle
        // It's only used in mock mode for local development and is in devDependencies
        if (id === "@fhevm/mock-utils" || id.includes("@fhevm/mock-utils")) {
          return true;
        }
        return false;
      },
      onwarn(warning, warn) {
        // Suppress warnings about @fhevm/mock-utils since it's only for development
        if (
          (warning.code === "UNRESOLVED_IMPORT" || warning.code === "MODULE_LEVEL_DIRECTIVE") &&
          warning.id?.includes("@fhevm/mock-utils")
        ) {
          return;
        }
        // Suppress other common warnings that don't affect functionality
        if (warning.code === "CIRCULAR_DEPENDENCY") {
          return;
        }
        warn(warning);
      },
    },
  },
}));

