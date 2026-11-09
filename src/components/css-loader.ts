import { URL } from 'node:url';
import { FileCache } from './file-cache';
import { Downloader } from './downloader';
import { Logger } from './logger';
import { mapPool } from './pool';

export interface LoadedCss {
	css: Map<string, string>;
	failed: Set<string>;
}

export class CssLoader {
	private fontUrlRegex = /[-a-z0-9@:%_+.~#?&/=]+\.(?:woff2?|eot|ttf|otf|svg)/gi;

	constructor(
		private logger: Logger,
		private downloader: Downloader,
		private fileCache: FileCache
	) {}

	/**
	 * Downloads the css of every url (in parallel), the result keeps the order of the urls.
	 *
	 * With `isolateRefused` an url the server refuses (4xx) doesn't fail the others,
	 * it is reported in `failed`. Network and server errors always reject.
	 */
	public async loadEach(urls: Iterable<string>, isolateRefused = false, concurrency = 6): Promise<LoadedCss> {
		const css = new Map<string, string>();
		const failed = new Set<string>();
		const urlList = [...urls];

		const results = await mapPool(urlList, concurrency, async (url) => {
			try {
				return this.normalizeUrls((await this.load(url)).trim(), url);
			} catch (error) {
				if (isolateRefused && Downloader.isRefused(error)) {
					return undefined;
				}

				throw error;
			}
		});

		urlList.forEach((url, index) => {
			const result = results[index];

			if (result === undefined) {
				failed.add(url);
			} else {
				css.set(url, result);
			}
		});

		return { css, failed };
	}

	public async loadAll(urls: Iterable<string>): Promise<string> {
		const { css } = await this.loadEach(urls);

		return [...css.values()].join('\n').trim();
	}

	public normalizeUrls(cssContent: string, cssUrl: string) {
		cssContent = cssContent.replaceAll(this.fontUrlRegex, (match) => {
			// fully-qualified url
			if (match.startsWith('http://') || match.startsWith('https://')) {
				return match;
			}

			// protocol relative url
			if (match.startsWith('//')) {
				return 'https:' + match;
			}

			return new URL(match, cssUrl).href;
		});

		return cssContent;
	}

	private async load(url: string) {
		this.logger.flashLine(url);

		const cachedFile = this.fileCache.get('css', url);

		if (cachedFile !== undefined) {
			return cachedFile;
		}

		const response = await this.downloader.download(url, 'text');

		this.fileCache.save('css', url, response.data as string);

		return response.data as string;
	}
}

