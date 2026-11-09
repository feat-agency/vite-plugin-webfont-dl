import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import webfontDownload from 'vite-plugin-webfont-dl';

// simple config: the webfont css urls are passed to the plugin
export default defineConfig({
	plugins: [
		vue(),
		webfontDownload([
			'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
		]),
	],
});
