import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		host: '0.0.0.0',
		proxy: {
			'/api': {
				target: 'http://localhost:8788',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, '')
			},
			'/search': 'http://localhost:8788',
			'/assets': 'http://localhost:8788',
			'/listings': 'http://localhost:8788',
			'/lineage': 'http://localhost:8788',
			'/policies': 'http://localhost:8788',
			'/upload': 'http://localhost:8788',
			'/health': 'http://localhost:8788'
		}
	},
	build: {
		outDir: 'build'
	}
});