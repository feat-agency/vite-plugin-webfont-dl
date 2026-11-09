import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import webfontDownload from 'vite-plugin-webfont-dl';

// zero config + options: the fonts are saved as an external, asynchronously loaded stylesheet
export default defineConfig({
	plugins: [
		svelte(),
		webfontDownload([], {
			injectAsStyleTag: false,
			subsetsAllowed: ['latin', 'latin-ext'],
		}),
	],
});
