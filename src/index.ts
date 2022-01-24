import type { ViteDevServer, Connect, ResolvedConfig, Plugin } from 'vite';
import { PluginContext } from 'rollup';
import type { Font } from './types';
import * as http from 'http';
import { CssLoader } from './css-loader';
import { CssParser } from './css-parser';
import { CssInjector } from './css-injector';
import { CssTransformer } from './css-transformer';
import { FontLoader } from './font-loader';

export function ViteWebfontDownload(webfontUrls: string | string[]): Plugin {
	if (!Array.isArray(webfontUrls)) {
		webfontUrls = [webfontUrls];
	}

	let base: string;
	let assetsDir: string;

	const cssLoader = new CssLoader();
	const cssParser = new CssParser();
	const cssTransformer = new CssTransformer();
	const fontLoader = new FontLoader();

	let fonts: {[key: string]: Font} = {};

	const cssFilename = 'webfonts.css';
	let cssContent = '';
	let cssPath: string;

	const saveFile = (
		pluginContext: PluginContext,
		fileName: string,
		source: string | Buffer
	): string => {
		const ref = pluginContext.emitFile({
			name: fileName,
			type: 'asset',
			source: source,
		});

		return pluginContext.getFileName(ref);
	};

	return {
		name: 'vite-plugin-webfont-dl',

		configResolved(resolvedConfig: ResolvedConfig) {
			base = resolvedConfig.base;
			assetsDir = resolvedConfig.build.assetsDir;

			cssPath = assetsDir + '/' + cssFilename;
		},

		async configureServer(server: ViteDevServer) {
			cssContent = await cssLoader.loadAll(webfontUrls as string[]);
			fonts = cssParser.parse(cssContent, base, assetsDir);
			cssContent = cssTransformer.transform(cssContent, fonts);

			const fontUrls: Map<string, string> = new Map();
			for (const fontFileName in fonts) {
				const font = fonts[fontFileName];
				fontUrls.set(font.localPath, font.url);
			}

			server.middlewares.use((
				req: Connect.IncomingMessage,
				res: http.ServerResponse,
				next: Connect.NextFunction
			) => {
				void (async () => {
					const url = req.originalUrl as string;

					if (url === base + cssPath) {
						res.end(cssContent);
					} else if (fontUrls.has(url)) {
						res.end(await fontLoader.load(fontUrls.get(url) as string));
					} else {
						next();
					}
				})();
			});
		},

		async generateBundle() {
			cssContent = await cssLoader.loadAll(webfontUrls as string[]);
			fonts = cssParser.parse(cssContent, base, assetsDir);

			for (const fontFileName in fonts) {
				const font = fonts[fontFileName];
				const fontBinary = await fontLoader.load(font.url);

				font.localPath = base + saveFile(
					this,
					fontFileName,
					fontBinary
				);
			}

			cssContent = cssTransformer.transform(cssContent, fonts);
			cssPath = saveFile(
				this,
				cssFilename,
				cssContent
			);
		},

		transformIndexHtml(html: string) {
			return (new CssInjector).inject(html, base, cssPath);
		},
	};
}

