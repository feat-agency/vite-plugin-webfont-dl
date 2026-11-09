import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webfontDownload from 'vite-plugin-webfont-dl';

// the plugin also finds the webfont `@import` statements of your css (see src/index.css)
export default defineConfig({
	plugins: [
		react(),
		webfontDownload(),
	],
});
