import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			// Allow serving files from the project root (including config.yaml)
			allow: ['..']
		}
	},
	// Copy config.yaml to public directory in development
	publicDir: 'static'
});
