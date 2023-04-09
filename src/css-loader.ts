import { URL } from 'url';
import CleanCss from 'clean-css';
import { Options } from './types';
import { FileCache } from './file-cache';
import { Downloader } from './downloader';
import { Logger } from './logger';

export class CssLoader {
	private isRelativeUrlRegex = /\.\.?\/[-a-z0-9@:%_+.~#?&/=]+\.(?:woff2?|eot|ttf|otf|svg)/gi;
	private protocolRelativeUrlRegex = /(?<!https?:)\/\/[-a-z0-9@:%_+.~#?&/=]+\.(?:woff2?|eot|ttf|otf|svg)/gi;

	constructor(
		private options: Options,
		private logger: Logger,
		private downloader: Downloader,
		private fileCache: FileCache
	) {}

	public async loadAll(urls: Set<string>, isDevServer?: boolean): Promise<string> {
		let cssContent = '';

		for (const url of urls) {
			const css = await this.load(url);
			const cssNormalized = this.normalizeUrls(css.trim(), url);

			cssContent += cssNormalized + '\n';
		}

		return this.formatCss(cssContent, isDevServer);
	}

	public formatCss(cssContent: string, isDevServer?: boolean): string {
		if (!isDevServer && this.options.minifyCss) {
			return this.minify(cssContent);
		}

		return cssContent.trim();
	}

	public minify(cssContent: string) {
		return new CleanCss().minify(cssContent).styles;
	}

	public normalizeUrls(cssContent: string, cssUrl: string) {
		cssContent = cssContent.replaceAll(this.isRelativeUrlRegex, (match) => {
			const urlObject = new URL(match, cssUrl);

			return urlObject.href;
		});

		cssContent = cssContent.replaceAll(this.protocolRelativeUrlRegex, (match) => {
			return 'https:' + match;
		});

		return cssContent;
	}

	private async load(url: string) {
		this.logger.flashLine(url);

		const cachedFile = this.fileCache.get('css', url);

		if (cachedFile) {
			return cachedFile as string;
		}

		const response = await this.downloader.download(url, 'text');

		this.fileCache.save('css', url, response.data as string);

		return response.data as string;
	}
}

