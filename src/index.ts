import { ClientRequest, ServerResponse } from 'node:http';
import { NormalizedOutputOptions, OutputAsset, OutputBundle, PluginContext } from 'rollup';
import type { Connect, IndexHtmlTransformContext, Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import colors from 'picocolors';
import type { Font, FontCollection, Options } from './types';
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
	const webfontUrlsHtml = new Set<string>([]);
	const webfontUrlsCss = new Set<string>([]);
	const options = getOptionsWithDefaults(_options);


	const fonts: FontCollection = new Map();
	const cssFilename = 'webfonts.css';

	const fontUrlsDevMap = new Map<string, string>();

	const logger = new Logger();
	const downloader = new Downloader(options, logger);
	const fileCache = new FileCache(options);
	const cssLoader = new CssLoader(options, logger, downloader, fileCache);
	const cssParser = new CssParser();
	const cssTransformer = new CssTransformer(options);
	const cssInjector = new CssInjector(options);
	const fontLoader = new FontLoader(logger, downloader, fileCache);
	const indexHtmlProcessor = new IndexHtmlProcessor();

	let viteDevServer: ViteDevServer;
	let pluginContext: PluginContext;
	let resolvedConfig: ResolvedConfig;

	let base: string;
	let assetsDir: string;

	let cssContent = '';
	let cssPath: string;

	const htmlFiles: Map<string, string> = new Map<string, string>();

	const collectWebfontsFromHtml = (html: string): void => {
		for (const webfontUrl of indexHtmlProcessor.parse(html)) {
			webfontUrlsHtml.add(webfontUrl);
		}
	};

	const collectWebfontsFromHtmlFiles = (): void => {
		webfontUrlsHtml.clear();

		htmlFiles.forEach((html) => {
			collectWebfontsFromHtml(html);
		});
	};

	const collectWebfontsFromBundleCss = (bundle: OutputBundle): void => {
		webfontUrlsCss.clear();

		for (const path in bundle) {
			if (/\.css$/.exec(path)) {
				let bundleCssContent = (bundle[path] as OutputAsset).source.toString();

				const parsedBundleCss = cssParser.parseBundleCss(
					bundleCssContent,
					base,
					assetsDir,
				);

				if (parsedBundleCss.matchedCssParts.length) {
					// parsed fonts
					parsedBundleCss.fonts.forEach((font: Font) => {
						fonts.set(font.filename, font);
					});

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
		cssContent = '';

		const started = Date.now();

		const allWebfontUrls = new Set([
			...webfontUrls,
			...webfontUrlsHtml,
			...webfontUrlsCss,
		]);

		if (allWebfontUrls.size) {
			cssContent += await cssLoader.loadAll(allWebfontUrls, !!viteDevServer);
		}

		if (!viteDevServer) {
			logger.info(
				colors.green('✓') + ' ' +
				allWebfontUrls.size.toString() + ' webfont css downloaded. ' +
				colors.dim('(' +
					colors.bold(toDuration(started)) + ', ' +
					(options.cache !== false ?
						`cache hit: ${colors.bold(toPercent(fileCache.hits.css, allWebfontUrls.size))}` :
						'cache disabled'
					) +
				')'),
				false
			);
		}

		return cssContent;
	};

	const parseFonts = (cssContent: string): void => {
		const parsedFonts = cssParser.parse(cssContent, base, assetsDir);

		parsedFonts.forEach((font: Font) => {
			fonts.set(font.filename, font);
		});
	};

	const replaceFontUrls = () => {
		cssContent = cssTransformer.transform(cssContent, fonts);
	};

	const downloadFonts = async (): Promise<void> => {
		const started = Date.now();

		for (const [, font] of fonts) {
			const binary = await fontLoader.load(font.url);

			saveFont(font, binary);
		}

		logger.info(
			colors.green('✓') + ' ' +
			fonts.size + ' webfonts downloaded. ' +
			colors.dim('(' +
				colors.bold(toDuration(started)) + ', ' +
				(options.cache !== false ?
					`cache hit: ${colors.bold(toPercent(fileCache.hits.font, fonts.size))}` :
					'cache disabled'
				) +
			')'),
			false
		);
	};

	const downloadFont = async (url: string): Promise<Buffer> => {
		const font = fontLoader.load(url);

		logger.clearLine();

		return font;
	};

	const saveFont = (font: Font, binary: Buffer) => {
		if (!options.embedFonts) {
			let subfolder = options.fontsSubfolder;
			if (subfolder.startsWith('/')) subfolder = subfolder.slice(1);
			if (!subfolder.endsWith('/')) subfolder = subfolder + '/';
			font.localPath = base + saveFile(
				subfolder + font.filename,
				binary
			);
		} else {
			font.binary = binary;
		}
	};

	const loadAndPrepareDevFonts = async () => {
		parseFonts(await downloadWebfontCss());
		replaceFontUrls();

		// create fonts map
		fontUrlsDevMap.clear();

		fonts.forEach((font: Font) => {
			fontUrlsDevMap.set(font.localPath, font.url);
		});
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

		return cssInjector.injectAsStyleTag(html, cssContent!);
	};

	const toDuration = (started: number): string => {
		return (Date.now() - started).toLocaleString() + ' ms';
	};

	const toPercent = (value: number, total: number): string => {
		return (Math.round(value / total * 100 * 100) / 100).toFixed(2) + '%';
	};



	/**
	 * A, Build:
	 *    1. [hook] configResolved
	 *    2. [hook] transformIndexHtml (sets htmlFiles)
	 *    3. [hook] generateBundle
	 *    4.   ↳ collectWebfontsFromHtmlFiles()
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
	 *    5.   ↳ collectWebfontsFromHtmlFiles()
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
					try {
						await loadAndPrepareDevFonts();

						res.setHeader('Access-Control-Allow-Origin', '*');
						res.setHeader('Content-Type', 'text/css');

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
					res.setHeader('Content-Type', 'font/' + (url?.replace(/^.*\./, '') || 'woff2'));

					res.end(
						await downloadFont(
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
					/\.(?:woff2?|eot|ttf|otf|svg)$/.exec(url) &&
					fontUrlsDevMap.has(url)
				) {
					handleDevServerWebfont(req, res);
				} else {
					next();
				}
			});
		},

		transformIndexHtml(html: string, ctx: IndexHtmlTransformContext) {
			htmlFiles.set(
				ctx.path.replace(/^\//, ''),
				html,
			);

			if (viteDevServer) {
				webfontUrlsHtml.clear();
				collectWebfontsFromHtml(html);

				html = indexHtmlProcessor.removeTags(html);
				html = injectToHtml(html);
			}

			return html;
		},

		async generateBundle(_options: NormalizedOutputOptions, bundle: OutputBundle) {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			pluginContext = this;

			collectWebfontsFromHtmlFiles();
			collectWebfontsFromBundleCss(bundle);

			try {
				const webfontsCss = await downloadWebfontCss();

				if (webfontsCss) {
					parseFonts(webfontsCss);
					await downloadFonts();
					replaceFontUrls();

					if (options.injectAsStyleTag === false || !htmlFiles.size) {
						saveCss();
					}

					htmlFiles.forEach((html, htmlPath) => {
						const asset = bundle[htmlPath] as OutputAsset;

						if (asset !== undefined) {
							asset.source = indexHtmlProcessor.removeTags(asset.source as string);
							asset.source = injectToHtml(asset.source, cssContent);

							htmlFiles.set(htmlPath, asset.source);
						}
					});
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
