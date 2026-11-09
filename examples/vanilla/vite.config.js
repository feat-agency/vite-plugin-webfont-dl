import { defineConfig } from 'vite';
import webfontDownload from 'vite-plugin-webfont-dl';

// zero config: the plugin finds the webfont <link> tags of index.html
export default defineConfig({
	plugins: [
		webfontDownload(),
	],
});
