import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		host: '0.0.0.0',
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, '')
			},
			'/search': 'http://localhost:3000',
			'/assets': 'http://localhost:3000',
			'/listings': 'http://localhost:3000',
			'/lineage': 'http://localhost:3000',
			'/policies': 'http://localhost:3000',
			'/upload': 'http://localhost:3000',
			'/health': 'http://localhost:3000',
			'/v1': 'http://localhost:3000',
			'/identity': 'http://localhost:3000',
			'/overlay': 'http://localhost:3000'
		}
	},
	build: {
		outDir: 'build'
	}
});