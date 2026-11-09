import { ServerResponse } from 'http';
import { posix } from 'node:path';
import {
	getResolvedOptions,
	Logger,
	Downloader,
	FileCache,
	CssLoader,
	CssParser,
	CssTransformer,
	CssInjector,
	FontLoader,
	IndexHtmlProcessor,
	getFontMime,
	mapPool,
} from './components';
import { BundleCssFile, EmitFile, EmittedAsset, Font, FontCollection, Options, OutputAsset, OutputBundle } from './types';
import { Connect, Logger as ViteLogger } from 'vite';
import colors from 'picocolors';

export class WebfontDownload {
	private webfontUrls: Set<string>;
	private webfontUrlsHtml: Set<string>;
	private webfontUrlsCss: Set<string>;
	private options: Required<Options>;

	private logger: Logger;
	private downloader: Downloader;
	private fileCache: FileCache;
	private cssLoader: CssLoader;
	private cssParser: CssParser;
	private cssTransformer: CssTransformer;
	private cssInjector: CssInjector;
	private fontLoader: FontLoader;
	private indexHtmlProcessor: IndexHtmlProcessor;

	private emitFile: EmitFile = (emittedFile: EmittedAsset) => emittedFile.name || 'ref';
	private getFileName: (fileReferenceId: string) => string = (fileReferenceId) => fileReferenceId;

	private cssFilename = 'webfonts.css';
	private base = '/';
	private assetsDir = '';
	private cssPath = this.cssFilename;
	private cssPathSaved?: string;

	private isDevServer = false;

	private fonts: FontCollection;
	private fontUrlsDevMap: Map<string, string>;

	private cssContent = '';
	private cssContentBundle = ''; // @font-face rules moved out of the bundled css
	private minifyCssExplicit: boolean;

	private bundleCssFiles: BundleCssFile[] = []; // bundled css files with webfont @import / @font-face
	private cssByUrl = new Map<string, string>(); // webfont css of the bundled @import urls (`fontDefinitionsInCss`)
	private failedWebfontUrls = new Set<string>(); // webfont css urls the provider refused, they stay remote
	private downloadConcurrency = 6;



	constructor(
		webfontUrls?: string | string[],
		options?: Options
	) {
		if (!Array.isArray(webfontUrls) && typeof webfontUrls !== 'string') {
			webfontUrls = [];
		}

		if (typeof webfontUrls === 'string' && webfontUrls !== '') {
			webfontUrls = [webfontUrls];
		}

		this.webfontUrls = new Set<string>(webfontUrls || []);
		this.webfontUrlsHtml = new Set<string>([]);
		this.webfontUrlsCss = new Set<string>([]);
		this.options = getResolvedOptions(options);
		this.minifyCssExplicit = options?.minifyCss !== undefined;

		this.logger = new Logger();
		this.downloader = new Downloader(this.options, this.logger);
		this.fileCache = new FileCache(this.options);
		this.cssLoader = new CssLoader(this.logger, this.downloader, this.fileCache);
		this.cssParser = new CssParser(this.options);
		this.cssTransformer = new CssTransformer(this.options);
		this.cssInjector = new CssInjector(this.options);
		this.fontLoader = new FontLoader(this.logger, this.downloader, this.fileCache);
		this.indexHtmlProcessor = new IndexHtmlProcessor();

		this.fonts = new Map<string, Font>();
		this.fontUrlsDevMap = new Map<string, string>();
	}

	getOptions() {
		return this.options;
	}

	setBase(base: string) {
		this.base = base;
	}

	getBase() {
		return this.base;
	}

	setAssetsDir(assetsDir: string) {
		this.assetsDir = assetsDir;
		this.cssPath = assetsDir + '/' + this.cssFilename;
	}

	setCacheDir(cacheDir: string) {
		this.fileCache.setCacheDir(cacheDir);
	}

	getCssPath() {
		return this.cssPath;
	}

	getCssFilename() {
		return this.cssFilename;
	}

	setMinifyCss(minifyCss: boolean) {
		this.options.minifyCss = minifyCss;
	}

	/**
	 * `minifyCss` defaults to Vite's own minify setting,
	 * an explicitly set plugin option always wins.
	 */
	setMinifyCssDefault(minifyCss: boolean) {
		if (!this.minifyCssExplicit) {
			this.options.minifyCss = minifyCss;
		}
	}

	clearFonts() {
		this.fonts.clear();
	}

	setResolvedLogger(resolvedLogger: ViteLogger) {
		this.logger.setResolvedLogger(resolvedLogger);
	}

	setIsDevServer(isDevServer: boolean) {
		this.isDevServer = isDevServer;
	}

	getIsDevServer(): boolean {
		return this.isDevServer;
	}

	setEmitFileFunction(emitFile: EmitFile) {
		this.emitFile = emitFile;
	}

	setGetFilenameFunction(getFileName: (fileReferenceId: string) => string) {
		this.getFileName = getFileName;
	}

	collectWebfontsFromHtml(html: string) {
		const webfontUrls = this.indexHtmlProcessor.parse(html);

		for (const webfontUrl of webfontUrls) {
			this.webfontUrlsHtml.add(webfontUrl);
		}
	}

	/**
	 * Finds the webfont `@import` statements and `@font-face` rules of the bundled css.
	 * The css itself is only changed later, by `applyBundleCss()`, after everything is downloaded.
	 */
	collectWebfontsFromBundleCss(bundle: OutputBundle) {
		this.webfontUrlsCss.clear();
		this.cssContentBundle = '';
		this.bundleCssFiles = [];

		for (const path in bundle) {
			if (/\.css$/.exec(path)) {
				const parsedBundleCss = this.cssParser.parseBundleCss(
					this.getAssetSource(bundle[path] as OutputAsset),
					this.base,
					this.assetsDir,
				);

				if (parsedBundleCss.matchedCssParts.length) {
					// parsed fonts
					parsedBundleCss.fonts.forEach((font: Font) => {
						this.fonts.set(font.filename, font);
					});

					// @import webfont css urls
					parsedBundleCss.webfontUrlsCss.forEach((url) => {
						this.webfontUrlsCss.add(url);
					});

					// @font-face definitions are moved to the webfont css (unless they stay in place)
					if (!this.options.fontDefinitionsInCss) {
						parsedBundleCss.fontFaces.forEach((fontFace) => {
							this.cssContentBundle += fontFace + '\n';
						});
					}

					this.bundleCssFiles.push({
						path,
						imports: parsedBundleCss.imports,
						fontFaces: parsedBundleCss.fontFaces,
					});
				}
			}
		}
	}

	/**
	 * Applies the changes to the bundled css:
	 *  - default: the webfont `@import` statements and `@font-face` rules are removed,
	 *    they are part of the injected webfont css
	 *  - `fontDefinitionsInCss`: they are replaced with their self-hosted version, inside the same file
	 *
	 * A webfont css which could not be downloaded keeps its `@import`.
	 */
	applyBundleCss(bundle: OutputBundle) {
		for (const file of this.bundleCssFiles) {
			const asset = bundle[file.path] as OutputAsset | undefined;

			if (asset === undefined) {
				continue;
			}

			let css = this.getAssetSource(asset);

			if (this.options.fontDefinitionsInCss) {
				const fonts = this.getFontsForCssFile(file.path);
				const appended = new Map<string, string>();

				file.fontFaces.forEach((fontFace) => {
					const selfHosted = this.cssTransformer.transform(fontFace, fonts);

					// a function, so `$` in the css is never read as a replacement pattern
					css = css.replaceAll(fontFace, () => selfHosted);
				});

				file.imports.forEach(({ url, statement }) => {
					const webfontCss = this.cssByUrl.get(url);

					if (webfontCss !== undefined) {
						css = css.replaceAll(statement, '');

						appended.set(
							url,
							this.cssTransformer.formatCss(this.cssTransformer.transform(webfontCss, fonts))
						);
					}
				});

				// @font-face rules work anywhere in the file, an `@import` only at the top:
				// appending keeps the remaining `@import` statements valid
				if (appended.size) {
					const separator = this.options.minifyCss ? '' : '\n';

					css = css.trimEnd() + separator + [...appended.values()].join(separator) + separator;
				}
			} else {
				file.fontFaces.forEach((fontFace) => {
					css = css.replaceAll(fontFace, '');
				});

				file.imports.forEach(({ url, statement }) => {
					if (!this.failedWebfontUrls.has(url)) {
						css = css.replaceAll(statement, '');
					}
				});
			}

			asset.source = css;
		}
	}

	/**
	 * `true` when there is webfont css to inject into the html / save as a css file.
	 */
	hasCss(): boolean {
		return this.cssContent.length > 0;
	}

	clearWebfontUrlsHtml() {
		this.webfontUrlsHtml.clear();
	}

	async downloadWebfontCss(): Promise<boolean> {
		this.cssContent = '';
		this.cssByUrl.clear();
		this.failedWebfontUrls.clear();
		this.fileCache.resetHits('css');

		const started = Date.now();
		const fontDefinitionsInCss = this.options.fontDefinitionsInCss && !this.isDevServer;

		// the css of these urls is injected into the html / saved as a css file
		const sharedWebfontUrls = new Set([
			...this.webfontUrls,
			...this.webfontUrlsHtml,
			...(fontDefinitionsInCss ? [] : this.webfontUrlsCss),
		]);

		const allWebfontUrls = new Set([
			...sharedWebfontUrls,
			...this.webfontUrlsCss,
		]);

		if (allWebfontUrls.size) {
			const { css, failed } = await this.cssLoader.loadEach(
				allWebfontUrls,
				this.isolateRefused(),
				this.downloadConcurrency
			);

			this.failedWebfontUrls = failed;

			this.cssContent = [...sharedWebfontUrls]
				.map((url) => css.get(url))
				.filter((webfontCss) => webfontCss !== undefined)
				.join('\n')
				.trim();

			if (fontDefinitionsInCss) {
				this.webfontUrlsCss.forEach((url) => {
					const webfontCss = css.get(url);

					if (webfontCss !== undefined) {
						this.cssByUrl.set(url, webfontCss);
					}
				});
			}
		}

		if (!this.isDevServer) {
			this.logger.info(
				colors.green('✓') + ' ' +
				(allWebfontUrls.size - this.failedWebfontUrls.size).toString() + ' webfont css downloaded. ' +
				colors.dim('(' +
					colors.bold(this.toDuration(started)) +
					(allWebfontUrls.size ? (
						', ' + (
							this.options.cache !== false ?
								`cache hit: ${colors.bold(this.toPercent(this.fileCache.hits.css, allWebfontUrls.size))}` :
								'cache disabled'
							)
						) : ''
					) +
				')'),
				false
			);

			if (this.failedWebfontUrls.size) {
				this.logger.error(
					colors.red(`✗ ${this.failedWebfontUrls.size} webfont css could not be downloaded, it stays on the webfont provider.`)
				);
			}
		}

		return this.cssContent.length > 0 ||
			this.cssContentBundle.length > 0 ||
			this.cssByUrl.size > 0 ||
			(fontDefinitionsInCss && this.bundleCssFiles.some((file) => file.fontFaces.length > 0));
	}

	parseFontDefinitions = (): void => {
		const parseResult = this.cssParser.parse(
			this.cssContent,
			this.base,
			this.assetsDir
		);

		// the @font-face rules of the bundled css are appended after parsing,
		// so subset filtering (`subsetsAllowed`) can't drop them
		this.cssContent = [parseResult.cssContent, this.cssContentBundle.trim()]
			.filter((css) => css.length > 0)
			.join('\n');

		parseResult.fonts.forEach((font: Font) => {
			this.fonts.set(font.filename, font);
		});

		// `fontDefinitionsInCss`: the webfont css of every bundled @import is kept separately
		this.cssByUrl.forEach((css, url) => {
			const parseResultInPlace = this.cssParser.parse(css, this.base, this.assetsDir);

			this.cssByUrl.set(url, parseResultInPlace.cssContent);

			parseResultInPlace.fonts.forEach((font: Font) => {
				this.fonts.set(font.filename, font);
			});
		});
	};

	async downloadFont(url: string): Promise<Buffer> {
		const font = await this.fontLoader.load(url);

		this.logger.clearLine();

		return font;
	}

	async downloadFonts() {
		const started = Date.now();
		const fonts = [...this.fonts.values()];
		const isolateRefused = this.isolateRefused();

		this.fileCache.resetHits('font');

		const binaries = await mapPool(fonts, this.downloadConcurrency, async (font) => {
			try {
				return await this.fontLoader.load(font.url);
			} catch (error) {
				// a font the provider refused keeps its remote url
				if (isolateRefused && Downloader.isRefused(error)) {
					return undefined;
				}

				throw error;
			}
		});

		// the files are saved in the original order, so the output doesn't depend on the download order
		fonts.forEach((font, index) => {
			const binary = binaries[index];

			if (binary !== undefined) {
				this.saveFont(font, binary);
			} else {
				this.fonts.delete(font.filename);
			}
		});

		this.logger.info(
			colors.green('✓') + ' ' +
			this.fonts.size + ' webfonts downloaded. ' +
			colors.dim('(' +
				colors.bold(this.toDuration(started)) +
				(fonts.length ? (
					', ' +
						(this.options.cache !== false ?
							`cache hit: ${colors.bold(this.toPercent(this.fileCache.hits.font, fonts.length))}` :
							'cache disabled'
						)
					) : ''
				) +
			')'),
			false
		);

		if (this.fonts.size < fonts.length) {
			this.logger.error(
				colors.red(`✗ ${fonts.length - this.fonts.size} webfonts could not be downloaded, they stay on the webfont provider.`)
			);
		}
	}

	saveFont = (font: Font, binary: Buffer) => {
		if (!this.options.embedFonts) {
			let assetsSubfolder = this.options.assetsSubfolder
				.trim()
				.replace(/^\/+/, '') // remove starting "/"
				.replace(/\/+$/, '') // remove ending "/"
				.trim();

			// security "foo/../../bar"
			if (assetsSubfolder.includes('../')) {
				assetsSubfolder = '';
			}

			const savedPath = this.saveFile(
				(assetsSubfolder ? `${assetsSubfolder}/` : '') + font.filename,
				binary
			);

			font.savedPath = savedPath;

			if (this.options.injectAsStyleTag) {
				font.localPath = this.base + savedPath;
			} else {
				const assetsDirPrefix = this.assetsDir + '/';

				font.localPath = savedPath;

				if (font.localPath.startsWith(assetsDirPrefix)) {
					font.localPath = font.localPath.substring(assetsDirPrefix.length);
				}
			}
		} else {
			font.binary = binary;
		}
	};

	saveCss() {
		this.cssPathSaved = this.saveFile(
			this.cssFilename,
			this.cssContent
		);

		return this.cssPathSaved;
	}

	saveFile(fileName: string, source: string | Buffer): string {
		const ref = this.emitFile({
			name: fileName,
			originalFileName: fileName,
			type: 'asset',
			source: source,
		});

		return this.getFileName(ref);
	}

	replaceFontUrls = () => {
		this.cssContent = this.cssTransformer.transform(this.cssContent, this.fonts);
	};

	formatCss = () => {
		this.cssContent = this.cssTransformer.formatCss(this.cssContent, this.isDevServer);
	};

	removeTagsFromHtml(html: string) {
		return this.indexHtmlProcessor.removeTags(html, this.failedWebfontUrls);
	}

	injectToHtml(html: string): string {
		if (this.isDevServer || this.options.injectAsStyleTag === false) {
			return this.cssInjector.injectAsStylesheet(html, this.base, this.cssPathSaved || this.cssPath);
		}

		return this.cssInjector.injectAsStyleTag(html, this.cssContent);
	}

	async loadDevServerFonts() {
		await this.downloadWebfontCss();
		this.parseFontDefinitions();
		this.replaceFontUrls();
		this.formatCss();

		// create fonts map
		this.fontUrlsDevMap.clear();

		this.fonts.forEach((font: Font) => {
			this.fontUrlsDevMap.set(font.localPath, font.url);
		});
	}

	async getDevServerMiddlewareCss(response: ServerResponse) {
		try {
			await this.loadDevServerFonts();

			response.setHeader('Access-Control-Allow-Origin', '*');
			response.setHeader('Content-Type', 'text/css');

			response.end(this.cssContent);
		} catch (error) {
			this.logger.error(
				colors.red((error as Error).message)
			);

			response.statusCode = 502;
			response.setHeader('X-Error', this.toHeaderValue(error));
			response.end();
		}
	}

	async getDevServerMiddlewareGeneral(
		request: Connect.IncomingMessage,
		response: ServerResponse,
		next: Connect.NextFunction
	) {
		const url = request.originalUrl?.replace(/[?#].*$/, '');

		if (url && this.fontUrlsDevMap.has(url)) {
			try {
				const font = await this.downloadFont(
					this.fontUrlsDevMap.get(url)!
				);

				response.setHeader('Access-Control-Allow-Origin', '*');
				response.setHeader('Content-Type', getFontMime(url));
				response.end(font);
			} catch (error) {
				// a failed download must not take down the dev server (unhandled rejection)
				this.logger.error(
					colors.red((error as Error).message)
				);

				response.statusCode = 502;
				response.setHeader('X-Error', this.toHeaderValue(error));
				response.end();
			}
		} else {
			next();
		}
	}

	logError(output: string) {
		this.logger.error(output);
	}

	/**
	 * Build: a file the webfont provider refuses (4xx) doesn't fail the others, it stays remote.
	 * Network / server errors, the dev server and `throwError` keep the all-or-nothing behaviour.
	 */
	private isolateRefused(): boolean {
		return !this.isDevServer && !this.options.throwError;
	}

	private getAssetSource(asset: OutputAsset): string {
		return typeof asset.source === 'string' ? asset.source : Buffer.from(asset.source).toString('utf8');
	}

	/**
	 * Fonts with the path a bundled css file has to use (`fontDefinitionsInCss`).
	 * Follows Vite's own logic: absolute urls, unless the `base` is relative.
	 */
	private getFontsForCssFile(cssPath: string): FontCollection {
		const isRelativeBase = this.base === '' || this.base.startsWith('.');
		const fonts: FontCollection = new Map<string, Font>();

		this.fonts.forEach((font, filename) => {
			let localPath = font.localPath;

			if (font.savedPath !== undefined) {
				localPath = isRelativeBase ?
					posix.relative(posix.dirname(cssPath), font.savedPath) :
					this.base + font.savedPath;
			}

			fonts.set(filename, { ...font, localPath });
		});

		return fonts;
	}

	// header values must not contain control or non-ASCII characters (`setHeader` would throw)
	private toHeaderValue(error: unknown): string {
		return (error instanceof Error ? error.message : String(error))
			.replace(/^Error: /, '')
			.replace(/[^\x20-\x7E]+/g, ' ')
			.trim();
	}

	private toDuration(started: number): string {
		return (Date.now() - started).toLocaleString() + ' ms';
	}

	private toPercent(value: number, total: number): string {
		return (Math.round(value / total * 100 * 100) / 100).toFixed(2) + '%';
	}
}
