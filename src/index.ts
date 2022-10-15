import { ServerResponse } from 'http';
import { PluginContext } from 'rollup';
import type { ViteDevServer, Connect, ResolvedConfig, Plugin } from 'vite';
import type { Font, Options } from './types';
import { CssLoader } from './css-loader';
import { CssParser } from './css-parser';
import { CssInjector } from './css-injector';
import { CssTransformer } from './css-transformer';
import { FontLoader } from './font-loader';
import { IndexHtmlProcessor } from './index-html-processor';
import { getOptionsWithDefaults } from './default-options';


function viteWebfontDownload(
	_webfontUrls?: string | string[],
	_options?: Options
): Plugin {
	if (!Array.isArray(_webfontUrls) && typeof _webfontUrls !== 'string') {
		_webfontUrls = [];
	}

	if (typeof _webfontUrls === 'string' && _webfontUrls !== '') {
		_webfontUrls = [_webfontUrls];
	}

	const webfontUrls = new Set<string>(_webfontUrls || []);
	const webfontUrlsIndex = new Set<string>([]);
	const options: Options = getOptionsWithDefaults(_options);


	let fonts: { [key: string]: Font } = {};
	const cssFilename = 'webfonts.css';


	const indexHtmlProcessor = new IndexHtmlProcessor();
	const cssLoader = new CssLoader(options);
	const cssParser = new CssParser();
	const cssTransformer = new CssTransformer();
	const fontLoader = new FontLoader();
	const cssInjector = new CssInjector(options);

	let viteDevServer: ViteDevServer;
	let pluginContext: PluginContext;

	let base: string;
	let assetsDir: string;
	let cssContent = '';
	let cssPath: string;


	const collectFontsFromIndexHtml = (indexHtml: string): void => {
		webfontUrlsIndex.clear();

		for (const webfontUrl of indexHtmlProcessor.parse(indexHtml)) {
			webfontUrlsIndex.add(webfontUrl);
		}
	};

	const loadCssAndFonts = async (): Promise<void> => {
		cssContent = await cssLoader.loadAll(
			new Set([...webfontUrls, ...webfontUrlsIndex])
		);

		fonts = cssParser.parse(cssContent, base, assetsDir);
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

	const injectToHtml = (html: string, cssContent: string, base: string, cssPath: string): string => {
		if (viteDevServer || options.injectAsStyleTag === false) {
			return cssInjector.injectAsStylesheet(html, base, cssPath);
		}

		return cssInjector.injectAsStyleTag(html, cssContent);
	}


	/**
	 * A, Build:
	 *    1. [hook] configResolved
	 *    2. [hook] generateBundle
	 *    3. [hook] transformIndexHtml
	 *    4. collectFontsFromIndexHtml()
	 *    5. loadCssAndFonts()
	 *    6. downloadFonts()
	 *    7. replaceFontUrls()
	 *    8. [optional] saveCss()
	 *    9. injectToHtml()
	 *
	 * B, Dev server:
	 *    1. [hook] configResolved
	 *    2. [hook] configureServer: middleware init
	 *    3. configureServer: middleware index.html
	 *    4. [hook] transformIndexHtml
	 *    5. collectFontsFromIndexHtml()
	 *    6. loadCssAndFonts()
	 *    7. replaceFontUrls()
	 *    8. injectToHtml()
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

			const fontUrlsDevMap: Map<string, string> = new Map();

			const loadAndPrepareDevFonts = async () => {
				await loadCssAndFonts();
				replaceFontUrls();

				// create fonts map
				fontUrlsDevMap.clear();

				for (const fontFileName in fonts) {
					const font = fonts[fontFileName];

					fontUrlsDevMap.set(font.localPath, font.url);
				}
			};

			viteDevServer.middlewares.use((
				req: Connect.IncomingMessage,
				res: ServerResponse,
				next: Connect.NextFunction
			) => {
				void (async () => {
					const url = req.originalUrl?.replace(/[?#].*$/, '');

					if (url && url === base + cssPath) { // /assets/webfonts.css
						try {
							await loadAndPrepareDevFonts();
							res.end(cssContent);
						} catch (error) {
							console.error('[webfont-dl]', (error as Error).message);

							res.statusCode = 502;
							res.setHeader('X-Error', (error as Error).message.replace(/^Error: /, ''));
							res.end();
						}

					} else if (url && fontUrlsDevMap.has(url)) { // /assets/xxx.woff2
						res.end(
							await fontLoader.load(
								// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
								fontUrlsDevMap.get(url)!
							)
						);

					} else {
						next();
					}
				})();
			});
		},

		generateBundle() {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			pluginContext = this;
		},

		async transformIndexHtml(html: string) {
			collectFontsFromIndexHtml(html);

			if (!viteDevServer) {
				await loadCssAndFonts();
				await downloadFonts();
				replaceFontUrls();

				if (options.injectAsStyleTag === false) {
					saveCss();
				}
			}

			html = indexHtmlProcessor.removeTags(html);
			html = injectToHtml(html, cssContent, base, cssPath);

			return html;
		},
	};
}

export {
	viteWebfontDownload as default,
	viteWebfontDownload as webfontDl,
	viteWebfontDownload as webfontDownload,
	viteWebfontDownload as viteWebfontDl,
	viteWebfontDownload as ViteWebfontDownload,
	viteWebfontDownload,
};
