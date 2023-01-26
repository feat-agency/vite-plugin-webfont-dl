import { ServerResponse } from 'http';
import { stdout, env } from 'process';
import { OutputAsset, OutputBundle, PluginContext } from 'rollup';
import type { ViteDevServer, Connect, ResolvedConfig, Plugin, IndexHtmlTransformContext } from 'vite';
import colors from 'picocolors';
import type { FontsCollection, Options } from './types';
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


	let fonts: FontsCollection = {};
	const cssFilename = 'webfonts.css';

	const fontUrlsDevMap: Map<string, string> = new Map();

	const indexHtmlProcessor = new IndexHtmlProcessor();
	const cssLoader = new CssLoader(options);
	const cssParser = new CssParser();
	const cssTransformer = new CssTransformer();
	const fontLoader = new FontLoader();
	const cssInjector = new CssInjector(options);

	let viteDevServer: ViteDevServer;
	let pluginContext: PluginContext;
	let resolvedConfig: ResolvedConfig;

	let base: string;
	let assetsDir: string;

	let indexHtmlContent: string;
	let indexHtmlPath: string;

	let cssContent = '';
	let cssPath: string;


	const collectFontsFromIndexHtml = (indexHtml: string): void => {
		webfontUrlsIndex.clear();

		for (const webfontUrl of indexHtmlProcessor.parse(indexHtml)) {
			webfontUrlsIndex.add(webfontUrl);
		}
	};

	const loadCssAndFonts = async (): Promise<void> => {
		const allWebfontUrls = new Set([
			...webfontUrls,
			...webfontUrlsIndex,
		]);

		writeLine(`[webfont-dl] ${colors.gray(Array.from(allWebfontUrls).join(','))}`);

		cssContent = await cssLoader.loadAll(allWebfontUrls, !!viteDevServer);

		if (!viteDevServer) {
			logInfo(`${colors.green(`✓`)} [webfont-dl] ${allWebfontUrls.size} css downloaded.`);
		}

		fonts = cssParser.parse(cssContent, base, assetsDir);
	};

	const replaceFontUrls = () => {
		cssContent = cssTransformer.transform(cssContent, fonts);
	};

	const downloadFonts = async (): Promise<void> => {
		for (const fontFileName in fonts) {
			const font = fonts[fontFileName];

			writeLine(`[webfont-dl] ${colors.gray(font.url)}`);

			const fontBinary = await fontLoader.load(font.url);

			font.localPath = base + saveFile(
				fontFileName,
				fontBinary
			);
		}

		logInfo(`${colors.green(`✓`)} [webfont-dl] ${Object.values(fonts).length} fonts downloaded.`);
	};

	const downloadFont = async (url: string): Promise<Buffer> => {
		writeLine(`[webfont-dl] ${colors.gray(url)}`);

		const font = fontLoader.load(url);

		clearLine();

		return font;
	};

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

	const injectToHtml = (html: string, cssContent?: string): string => {
		if (viteDevServer || options.injectAsStyleTag === false) {
			return cssInjector.injectAsStylesheet(html, base, cssPath);
		}

		return cssInjector.injectAsStyleTag(html, cssContent as string);
	};

	const isTty = () => {
		return stdout.isTTY && !env.CI;
	};

	const logInfo = (output: string) => {
		clearLine();

		resolvedConfig.logger.info(output);
	};

	const clearLine = () => {
		if (isTty()) {
			stdout.clearLine(0);
			stdout.cursorTo(0);
		}
	};

	const writeLine = (output: string) => {
		if (isTty()) {
			clearLine();

			if (output.length < stdout.columns) {
				stdout.write(output);
			} else {
				stdout.write(output.substring(0, stdout.columns - 1));
			}
		} else {
			logInfo(output);
		}
	};



	/**
	 * A, Build:
	 *    1. [hook] configResolved
	 *    2. [hook] transformIndexHtml
	 *    3.   ↳ collectFontsFromIndexHtml()
	 *    4. [hook] generateBundle
	 *    5.   ↳ loadCssAndFonts()
	 *    6.   ↳ downloadFonts()
	 *    7.   ↳ replaceFontUrls()
	 *    8.   ↳ [optional] saveCss()
	 *    9.   ↳ removeTags()
	 *    10.  ↳ injectToHtml()
	 *
	 * B, Dev server:
	 *    1. [hook] configResolved
	 *    2. [hook] configureServer: middleware init
	 *    4. [hook] transformIndexHtml
	 *    5.   ↳ collectFontsFromIndexHtml()
	 *    6.   ↳ removeTags()
	 *    7.   ↳ injectToHtml()
	 *    8. [middleware]
	 *    9.   ↳ webfonts.css
	 *    10.    ↳ loadCssAndFonts()
	 *    11.    ↳ replaceFontUrls()
	 *    12.  ↳ *.(woff2?|eot|ttf|otf|svg)
	 *    13.    ↳ downloadFont()
	 */

	return {
		name: 'vite-plugin-webfont-dl',

		enforce: 'post',

		configResolved(_resolvedConfig: ResolvedConfig) {
			resolvedConfig = _resolvedConfig;

			base = resolvedConfig.base;
			assetsDir = resolvedConfig.build.assetsDir;
			cssPath = assetsDir + '/' + cssFilename;

			if (resolvedConfig.build.minify === false && _options?.minifyCss !== true) {
				options.minifyCss = false;
			}
		},

		configureServer(_viteDevServer: ViteDevServer) {
			viteDevServer = _viteDevServer;

			assetsDir = '@webfonts';
			cssPath = assetsDir + '/' + cssFilename;

			const handleDevServerWebfontsCss = (
				req: Connect.IncomingMessage,
				res: ServerResponse,
			) => {
				void (async () => {
					try {
						await loadAndPrepareDevFonts();
						res.end(cssContent);
					} catch (error) {
						console.error('[webfont-dl]', (error as Error).message);

						res.statusCode = 502;
						res.setHeader('X-Error', (error as Error).message.replace(/^Error: /, ''));
						res.end();
					}
				})();
			};

			const handleDevServerWebfont = (
				req: Connect.IncomingMessage,
				res: ServerResponse,
			) => {
				void (async () => {
					const url = req.originalUrl?.replace(/[?#].*$/, '');

					res.setHeader('Access-Control-Allow-Origin', '*');

					res.end(
						await downloadFont(
							// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
							fontUrlsDevMap.get(url!)!
						)
					);
				})();
			};

			viteDevServer.middlewares.use(
				base + cssPath, // /@webfonts/webfonts.css
				handleDevServerWebfontsCss
			);

			viteDevServer.middlewares.use(
				base + cssFilename, // /webfonts.css (Laravel Vite Plugin)
				handleDevServerWebfontsCss
			);

			viteDevServer.middlewares.use((
				req: Connect.IncomingMessage,
				res: ServerResponse,
				next: Connect.NextFunction
			) => {
				const url = req.originalUrl?.replace(/[?#].*$/, '');

				if (!url) {
					return next();
				}

				if ( // /assets/xxx.woff2
					url.match(/\.(?:woff2?|eot|ttf|otf|svg)$/) &&
					fontUrlsDevMap.has(url)
				) {
					handleDevServerWebfont(req, res);
				} else {
					next();
				}
			});
		},

		transformIndexHtml(html: string, ctx: IndexHtmlTransformContext) {
			indexHtmlContent = html;
			indexHtmlPath = ctx.path.replace(/^\//, '');

			if (viteDevServer) {
				collectFontsFromIndexHtml(html);
				html = indexHtmlProcessor.removeTags(html);
				html = injectToHtml(html);
			}

			return html;
		},

		async generateBundle(_options, bundle: OutputBundle) {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			pluginContext = this;

			if (indexHtmlContent !== undefined) {
				collectFontsFromIndexHtml(indexHtmlContent);
			}

			await loadCssAndFonts();
			await downloadFonts();
			replaceFontUrls();

			if (options.injectAsStyleTag === false || indexHtmlContent === undefined) {
				saveCss();
			}

			if (bundle[indexHtmlPath] !== undefined) {
				indexHtmlContent = indexHtmlProcessor.removeTags(indexHtmlContent);
				indexHtmlContent = injectToHtml(indexHtmlContent, cssContent);

				(bundle[indexHtmlPath] as OutputAsset).source = indexHtmlContent;
			}
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
