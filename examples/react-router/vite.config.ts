import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import webfontDownload from 'vite-plugin-webfont-dl';

// React Router renders the html itself, so the plugin has no html file to inject into.
// With `cssInPlace` the webfonts imported in app/app.css are self-hosted inside that css file.
export default defineConfig({
	plugins: [
		reactRouter(),
		webfontDownload([], {
			cssInPlace: true,
		}),
	],
});
