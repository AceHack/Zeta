/**
 * vite.config.pages.ts — GitHub Pages build config for identity-dla-site.
 *
 * Differences from vite.config.ts:
 * 1. Strips Manus-specific plugins (vite-plugin-manus-runtime, debug-collector, storage-proxy)
 *    which require the Manus runtime environment and are not available on GitHub Pages.
 * 2. Sets base = "/Zeta/demo/identity-dla-site/" so all asset URLs are correct
 *    when served from https://lucent-financial-group.github.io/Zeta/demo/identity-dla-site/
 * 3. Outputs to dist/pages/ (separate from the Manus dist/public/).
 * 4. Defines VITE_ANALYTICS_ENDPOINT and VITE_ANALYTICS_WEBSITE_ID as empty strings
 *    so the analytics script tag is a no-op (not an error).
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/Zeta/demo/identity-dla-site/",
  define: {
    // Stub out Manus runtime env vars so the build doesn't fail on missing env
    "import.meta.env.VITE_ANALYTICS_ENDPOINT": JSON.stringify(""),
    "import.meta.env.VITE_ANALYTICS_WEBSITE_ID": JSON.stringify(""),
    "import.meta.env.VITE_APP_ID": JSON.stringify("identity-dla"),
    "import.meta.env.VITE_APP_TITLE": JSON.stringify("Identity Space Boundary — Multi-Oracle DLA"),
    "import.meta.env.VITE_APP_LOGO": JSON.stringify(""),
    "import.meta.env.VITE_FRONTEND_FORGE_API_KEY": JSON.stringify(""),
    "import.meta.env.VITE_FRONTEND_FORGE_API_URL": JSON.stringify(""),
    "import.meta.env.VITE_OAUTH_PORTAL_URL": JSON.stringify(""),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "..", "..", "shared"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/pages"),
    emptyOutDir: true,
  },
});
