import { ClientRequest, ServerResponse } from 'http';
import { NormalizedOutputOptions, OutputAsset, OutputBundle, PluginContext } from 'rollup';
import type { Connect, IndexHtmlTransformContext, Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import colors from 'picocolors';
import type { FontsCollection, Options } from './types';
import { CssLoader } from './css-loader';
import { CssParser } from './css-parser';
import { CssInjector } from './css-injector';
import { CssTransformer } from './css-transformer';
import { Downloader } from './downloader';
import { FontLoader } from './font-loader';
import { FileCache } from './file-cache';
import { IndexHtmlProcessor } from './index-html-processor';
import { Logger } from './logger';
import { getOptionsWithDefaults } from './default-options';
import { AxiosError } from 'axios';



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
	const webfontUrlsCss = new Set<string>([]);
	const options: Options = getOptionsWithDefaults(_options);


	let fonts: FontsCollection = {};
	const cssFilename = 'webfonts.css';

	const fontUrlsDevMap: Map<string, string> = new Map();

	const logger = new Logger();
	const downloader = new Downloader(options, logger);
	const fileCache = new FileCache(options);
	const cssLoader = new CssLoader(options, logger, downloader, fileCache);
	const cssParser = new CssParser();
	const cssTransformer = new CssTransformer();
	const cssInjector = new CssInjector(options);
	const fontLoader = new FontLoader(logger, downloader, fileCache);
	const indexHtmlProcessor = new IndexHtmlProcessor();

	let viteDevServer: ViteDevServer;
	let pluginContext: PluginContext;
	let resolvedConfig: ResolvedConfig;

	let base: string;
	let assetsDir: string;

	let indexHtmlContent: string;
	let indexHtmlPath: string;

	let cssContent = '';
	let cssPath: string;


	const collectWebfontsFromIndexHtml = (indexHtml: string): void => {
		webfontUrlsIndex.clear();

		for (const webfontUrl of indexHtmlProcessor.parse(indexHtml)) {
			webfontUrlsIndex.add(webfontUrl);
		}
	};

	const collectWebfontsFromBundleCss = (bundle: OutputBundle): void => {
		webfontUrlsCss.clear();

		for (const path in bundle) {
			if (path.match(/\.css$/)) {
				let bundleCssContent = (bundle[path] as OutputAsset).source.toString();

				const parsedBundleCss = cssParser.parseBundleCss(
					bundleCssContent,
					base,
					assetsDir,
				);

				if (parsedBundleCss.matchedCssParts.length) {
					// parsed fonts
					fonts = {
						...fonts,
						...parsedBundleCss.fonts,
					};

					// @import webfont css urls
					parsedBundleCss.webfontUrlsCss.forEach((url) => {
						webfontUrlsCss.add(url);
					});

					// @font-face definitions
					parsedBundleCss.matchedCssParts.forEach((cssPart) => {
						bundleCssContent = bundleCssContent.replaceAll(cssPart, '');
						cssContent += cssPart + '\n';
					});

					(bundle[path] as OutputAsset).source = bundleCssContent;

					cssContent = cssLoader.formatCss(
						cssContent,
						!!viteDevServer
					);
				}
			}
		}
	};

	const downloadWebfontCss = async (): Promise<string> => {
		const allWebfontUrls = new Set([
			...webfontUrls,
			...webfontUrlsIndex,
			...webfontUrlsCss,
		]);

		if (allWebfontUrls.size) {
			cssContent += await cssLoader.loadAll(allWebfontUrls, !!viteDevServer);
		}

		if (!viteDevServer) {
			logger.info(
				colors.green('✓') + ' ' +
				allWebfontUrls.size.toString() + ' css downloaded. ' +
				colors.dim(
					options.cache !== false ?
						`(cache hit: ${fileCache.hits.css}/${fileCache.count.css})` :
						'(cache disabled)'
				)
			);
		}

		return cssContent;
	};

	const parseFonts = (cssContent: string): void => {
		fonts = {
			...fonts,
			...cssParser.parse(cssContent, base, assetsDir),
		};
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

		logger.info(
			colors.green('✓') + ' ' +
			Object.keys(fonts).length.toString() + ' fonts downloaded. ' +
			colors.dim(
				options.cache !== false ?
					`(cache hit: ${fileCache.hits.font}/${fileCache.count.font})` :
					'(cache disabled)'
			)
		);
	};

	const downloadFont = async (url: string): Promise<Buffer> => {
		const font = fontLoader.load(url);

		logger.clearLine();

		return font;
	};

	const loadAndPrepareDevFonts = async () => {
		parseFonts(await downloadWebfontCss());
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



	/**
	 * A, Build:
	 *    1. [hook] configResolved
	 *    2. [hook] transformIndexHtml (set indexHtmlPath)
	 *    3. [hook] generateBundle
	 *    4.   ↳ collectWebfontsFromIndexHtml()
	 *    5.   ↳ collectWebfontsFromBundleCss()
	 *    6.   ↳ downloadWebfontCss()
	 *    7.   ↳ parseFonts()
	 *    8.   ↳ downloadFonts()
	 *    9.   ↳ replaceFontUrls()
	 *    10.  ↳ [optional] saveCss()
	 *    11.  ↳ removeTags()
	 *    12.  ↳ injectToHtml()
	 *
	 * B, Dev server:
	 *    1. [hook] configResolved
	 *    2. [hook] configureServer: middleware init
	 *    4. [hook] transformIndexHtml
	 *    5.   ↳ collectWebfontsFromIndexHtml()
	 *    6.   ↳ removeTags()
	 *    7.   ↳ injectToHtml()
	 *    8. [middleware]
	 *    9.   ↳ webfonts.css
	 *    10.    ↳ downloadWebfontCss()
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

			logger.setResolvedLogger(resolvedConfig.logger);
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
					res.setHeader('Content-Type', 'text/css');

					try {
						await loadAndPrepareDevFonts();
						res.end(cssContent);
					} catch (error) {
						logger.error(
							colors.red((error as Error).message)
						);

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
				collectWebfontsFromIndexHtml(html);
				html = indexHtmlProcessor.removeTags(html);
				html = injectToHtml(html);
			}

			return html;
		},

		async generateBundle(_options: NormalizedOutputOptions, bundle: OutputBundle) {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			pluginContext = this;

			if (indexHtmlContent !== undefined) {
				collectWebfontsFromIndexHtml(indexHtmlContent);
			}

			collectWebfontsFromBundleCss(bundle);

			try {
				parseFonts(await downloadWebfontCss());
				await downloadFonts();
				replaceFontUrls();

				if (options.injectAsStyleTag === false || indexHtmlContent === undefined) {
					saveCss();
				}

				const asset = bundle[indexHtmlPath] as OutputAsset;

				if (asset !== undefined) {
					indexHtmlContent = indexHtmlProcessor.removeTags(asset.source as string);
					indexHtmlContent = injectToHtml(indexHtmlContent, cssContent);

					asset.source = indexHtmlContent;
				}
			} catch (error) {
				logger.error(
					colors.red((error as Error).message)
				);

				if (error instanceof AxiosError) {
					if (error.request instanceof ClientRequest) {
						logger.error(
							colors.red(`${error.request.method} ${error.request.protocol}//${error.request.host}${error.request.path}`)
						);
					}
				}
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
