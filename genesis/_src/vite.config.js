import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project site for Lucent-Financial-Group/Zeta, served as a
// subfolder of the existing Jekyll Pages site at /Zeta/genesis/.
export default defineConfig({
  base: "/Zeta/genesis/",
  plugins: [react()],
});
