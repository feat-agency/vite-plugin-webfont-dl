import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import webfontDownload from 'vite-plugin-webfont-dl';

// React Router renders the html itself, so the plugin has no html file to inject into.
// With `fontDefinitionsInCss` the font definitions of app/app.css stay in that css file, self-hosted.
export default defineConfig({
	plugins: [
		reactRouter(),
		webfontDownload([], {
			fontDefinitionsInCss: true,
		}),
	],
});
