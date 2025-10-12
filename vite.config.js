import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  // Note: SvelteKit automatically serves files from static/ directory
  // so no need to configure publicDir - it handles static files for us
});
