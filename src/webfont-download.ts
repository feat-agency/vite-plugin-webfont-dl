import { ServerResponse } from 'http';
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
} from './components';
import { Font, FontCollection, Options } from './types';
import { Connect, Logger as ViteLogger } from 'vite';
import colors from 'picocolors';
import { EmitFile, EmittedAsset, EmittedFile, OutputAsset, OutputBundle } from 'rollup';

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

	private emitFile: EmitFile = (emittedFile: EmittedFile) => (emittedFile as EmittedAsset).name || 'ref';
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

		this.logger = new Logger();
		this.downloader = new Downloader(this.options, this.logger);
		this.fileCache = new FileCache(this.options);
		this.cssLoader = new CssLoader(this.logger, this.downloader, this.fileCache);
		this.cssParser = new CssParser();
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

	getCssPath() {
		return this.cssPath;
	}

	getCssFilename() {
		return this.cssFilename;
	}

	setMinifyCss(minifyCss: boolean) {
		this.options.minifyCss = minifyCss;
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

	collectWebfontsFromBundleCss(bundle: OutputBundle) {
		this.webfontUrlsCss.clear();

		for (const path in bundle) {
			if (/\.css$/.exec(path)) {
				let bundleCssContent = (bundle[path] as OutputAsset).source.toString();

				const parsedBundleCss = this.cssParser.parseBundleCss(
					bundleCssContent,
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

					// @font-face definitions
					parsedBundleCss.matchedCssParts.forEach((cssPart) => {
						bundleCssContent = bundleCssContent.replaceAll(cssPart, '');
						this.cssContent += cssPart + '\n';
					});

					(bundle[path] as OutputAsset).source = bundleCssContent;
				}
			}
		}
	}

	clearWebfontUrlsHtml() {
		this.webfontUrlsHtml.clear();
	}

	async downloadWebfontCss(): Promise<boolean> {
		this.cssContent = '';

		const started = Date.now();

		const allWebfontUrls = new Set([
			...this.webfontUrls,
			...this.webfontUrlsHtml,
			...this.webfontUrlsCss,
		]);

		if (allWebfontUrls.size) {
			this.cssContent += await this.cssLoader.loadAll(allWebfontUrls);
		}

		if (!this.isDevServer) {
			this.logger.info(
				colors.green('✓') + ' ' +
				allWebfontUrls.size.toString() + ' webfont css downloaded. ' +
				colors.dim('(' +
					colors.bold(this.toDuration(started)) + ', ' +
					(this.options.cache !== false ?
						`cache hit: ${colors.bold(this.toPercent(this.fileCache.hits.css, allWebfontUrls.size))}` :
						'cache disabled'
					) +
				')'),
				false
			);
		}

		return this.cssContent.length > 0;
	}

	parseFontDefinitions = (): void => {
		const parseResult = this.cssParser.parse(
			this.cssContent,
			this.base,
			this.assetsDir
		);

		this.cssContent = parseResult.cssContent;

		parseResult.fonts.forEach((font: Font) => {
			this.fonts.set(font.filename, font);
		});
	};

	async downloadFont(url: string): Promise<Buffer> {
		const font = await this.fontLoader.load(url);

		this.logger.clearLine();

		return font;
	}

	async downloadFonts() {
		const started = Date.now();

		for (const [, font] of this.fonts) {
			const binary = await this.fontLoader.load(font.url);

			this.saveFont(font, binary);
		}

		this.logger.info(
			colors.green('✓') + ' ' +
			this.fonts.size + ' webfonts downloaded. ' +
			colors.dim('(' +
				colors.bold(this.toDuration(started)) + ', ' +
				(this.options.cache !== false ?
					`cache hit: ${colors.bold(this.toPercent(this.fileCache.hits.font, this.fonts.size))}` :
					'cache disabled'
				) +
			')'),
			false
		);
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
		return this.indexHtmlProcessor.removeTags(html);
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
			response.setHeader('X-Error', (error as Error).message.replace(/^Error: /, ''));
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
			const font = await this.downloadFont(
				this.fontUrlsDevMap.get(url)!
			);

			response.setHeader('Access-Control-Allow-Origin', '*');
			response.setHeader('Content-Type', 'font/' + (url?.replace(/^.*\./, '') || 'woff2'));
			response.end(font);
		} else {
			next();
		}
	}

	logError(output: string) {
		this.logger.error(output);
	}

	private toDuration(started: number): string {
		return (Date.now() - started).toLocaleString() + ' ms';
	}

	private toPercent(value: number, total: number): string {
		return (Math.round(value / total * 100 * 100) / 100).toFixed(2) + '%';
	}
}
