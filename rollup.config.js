import typescript from '@rollup/plugin-typescript';


export default {
	input: 'src/vite-plugin-webfont-dl.ts',
	output: {
		file: 'dist/vite-plugin-webfont-dl.js',
		format: 'cjs',
	},
	plugins: [
		typescript(),
	],
	external: [
		'axios',
	],
  };
