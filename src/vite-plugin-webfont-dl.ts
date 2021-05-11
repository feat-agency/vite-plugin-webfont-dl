import type { ViteDevServer, Connect, ResolvedConfig } from 'vite';
import * as http from 'http';
import { CssLoader } from './css-loader';
import { CssParser } from './css-parser';
import { CssInjector } from './css-injector';
import { FontLoader } from './font-loader';
import { OutputOptions } from 'rollup';

export const ViteWebfontDownload = (webfontUrls: string[]) => {
	let base: string;
	let assetsDir: string;

	const cssLoader = new CssLoader();
	const cssParser = new CssParser();
	const fontLoader = new FontLoader();

	let cssContent: string = '';
	let fontUrls: {[key: string]: string} = {};

	return {
		name: 'vite-plugin-webfont-dl',

		async configResolved(resolvedConfig: ResolvedConfig) {
			base = resolvedConfig.base;
			assetsDir = resolvedConfig.build.assetsDir;

			cssContent = await cssLoader.loadAll(webfontUrls);

			fontUrls = cssParser.parse(cssContent);
		},

		configureServer(server: ViteDevServer) {
			const fontReplaceRegex = new RegExp('^' + base + assetsDir + '/');

			server.middlewares.use(async (
				req: Connect.IncomingMessage,
				res: http.ServerResponse,
				next: Connect.NextFunction
			) => {
				const url = req.originalUrl as string;

				if (url.match(fontReplaceRegex)) {
					const fontUrl = fontUrls[url.replace(fontReplaceRegex, '')];

					res.end(await fontLoader.load(fontUrl));
				} else {
					next();
				}
			});
		},

		async generateBundle(options: OutputOptions, bundle: any) {
			for (const fontFile in fontUrls) {
				const fontUrl = fontUrls[fontFile];
				const fontBinary = await fontLoader.load(fontUrl);

				const bundleItem = {
					fileName: assetsDir + '/' + fontFile,
					name: undefined,
					isAsset: true,
					source: fontBinary,
					type: 'asset'
				};

				bundle[bundleItem.fileName] = bundleItem;
			}
		},

		async transformIndexHtml(html: string) {
			let cssContentLocal = cssContent;

			for (const fontFile in fontUrls) {
				const fontUrl = fontUrls[fontFile];

				cssContentLocal = cssContentLocal.replace(fontUrl, base + assetsDir + '/' + fontFile);
			}

			return (new CssInjector).inject(html, cssContentLocal);
		},
	};
}

