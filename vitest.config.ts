import { defineConfig } from 'vitest/config';
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
