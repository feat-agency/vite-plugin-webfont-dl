/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	test: {
		dir: 'test',
	},
	resolve: {
		alias: {
			'src': resolve(__dirname, './src'),
		},
	},
});
