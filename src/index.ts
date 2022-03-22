import { ServerResponse } from 'http';
import type { ViteDevServer, Connect, ResolvedConfig, Plugin } from 'vite';
import { PluginContext } from 'rollup';
import type { Font } from './types';
import { CssLoader } from './css-loader';
import { CssParser } from './css-parser';
import { CssInjector } from './css-injector';
import { CssTransformer } from './css-transformer';
import { FontLoader } from './font-loader';
import { IndexHtmlProcessor } from './index-html-processor';


export function ViteWebfontDownload(_webfontUrls?: string | string[]): Plugin {
	if (typeof _webfontUrls === 'string') {
		_webfontUrls = [_webfontUrls];
	}

	const webfontUrls = new Set<string>(_webfontUrls || []);


	let fontsLoaded = false;
	let fonts: { [key: string]: Font } = {};
	const cssFilename = 'webfonts.css';


	const indexHtmlProcessor = new IndexHtmlProcessor();
	const cssLoader = new CssLoader();
	const cssParser = new CssParser();
	const cssTransformer = new CssTransformer();
	const fontLoader = new FontLoader();
	const cssInjector = new CssInjector();

	let viteDevServer: ViteDevServer;
	let pluginContext: PluginContext;

	let base: string;
	let assetsDir: string;
	let cssContent = '';
	let cssPath: string;


	const collectFontsFromIndexHtml = (indexHtml: string): void => {
		for (const webfontUrl of indexHtmlProcessor.parse(indexHtml)) {
			webfontUrls.add(webfontUrl);
		}
	};

	const loadCssAndFonts = async (): Promise<void> => {
		cssContent = await cssLoader.loadAll(webfontUrls);
		fonts = cssParser.parse(cssContent, base, assetsDir);

		fontsLoaded = true;
	};

	const replaceFontUrls = () => {
		cssContent = cssTransformer.transform(cssContent, fonts);
	};

	const downloadFonts = async (): Promise<void> => {
		for (const fontFileName in fonts) {
			const font = fonts[fontFileName];
			const fontBinary = await fontLoader.load(font.url);

			font.localPath = base + saveFile(
				fontFileName,
				fontBinary
			);
		}
	};

	const saveCss = (): void => {
		cssPath = saveFile(
			cssFilename,
			cssContent
		);
	};

	const saveFile = (fileName: string, source: string | Buffer): string => {
		const ref = pluginContext.emitFile({
			name: fileName,
			type: 'asset',
			source: source,
		});

		return pluginContext.getFileName(ref);
	};


	/**
	 * A, Build:
	 *    1. [hook] configResolved
	 *    2. [hook] generateBundle
	 *    3. [hook] transformIndexHtml
	 *    4. collectFontsFromIndexHtml()
	 *    5. loadCssAndFonts()
	 *    6. downloadFonts()
	 *    7. replaceFontUrls()
	 *    8. saveCss()
	 *
	 * B, Dev server:
	 *    1. [hook] configResolved
	 *    2. [hook] configureServer: middleware init
	 *    3. configureServer: middleware index.html
	 *    4. transformIndexHtml()
	 *    5. collectFontsFromIndexHtml()
	 *    6. loadCssAndFonts()
	 *    7. replaceFontUrls()
	 */

	return {
		name: 'vite-plugin-webfont-dl',

		configResolved(resolvedConfig: ResolvedConfig) {
			base = resolvedConfig.base;
			assetsDir = resolvedConfig.build.assetsDir;
			cssPath = assetsDir + '/' + cssFilename;
		},

		configureServer(_viteDevServer: ViteDevServer) {
			viteDevServer = _viteDevServer;

			let fontUrlsMapped = false;
			const fontUrls: Map<string, string> = new Map();

			viteDevServer.middlewares.use((
				req: Connect.IncomingMessage,
				res: ServerResponse,
				next: Connect.NextFunction
			) => {
				void (async () => {
					// create fonts map
					if (fontsLoaded && !fontUrlsMapped) {
						for (const fontFileName in fonts) {
							const font = fonts[fontFileName];
							fontUrls.set(font.localPath, font.url);
						}

						fontUrlsMapped = true;
					}

					const url = req.originalUrl as string;

					// /assets/webfonts.css
					if (url === base + cssPath) {
						res.end(cssContent);

					// /assets/xxx.woff2
					} else if (fontUrls.has(url)) {
						res.end(await fontLoader.load(fontUrls.get(url) as string));

					} else {
						next();
					}
				})();
			});
		},

		generateBundle() {
			pluginContext = this;
		},

		async transformIndexHtml(html: string) {
			collectFontsFromIndexHtml(html);
			await loadCssAndFonts();

			if (viteDevServer) {
				replaceFontUrls();
			} else {
				await downloadFonts();
				replaceFontUrls();
				saveCss();
			}

			html = indexHtmlProcessor.removeTags(html);
			html = cssInjector.inject(html, base, cssPath);

			return html;
		},
	};
}
