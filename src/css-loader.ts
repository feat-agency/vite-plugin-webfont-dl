import { URL } from 'url';
import axios from 'axios';
import CleanCss from 'clean-css';
import { Options } from './types';
import { FileCache } from './file-cache';

export class CssLoader {
	private isRelativeUrlRegex = /..?\/.+?\.(?:woff2?|eot|ttf|otf|svg)/gi;

	constructor(private options: Options, private fileCache: FileCache) {}

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
		return cssContent.replaceAll(this.isRelativeUrlRegex, (match) => {
			const urlObject = new URL(match, cssUrl);

			return urlObject.href;
		});
	}

	private async load(url: string) {
		const cachedFile = this.fileCache.get('css', url);

		if (cachedFile) {
			return cachedFile as string;
		}

		const userAgentWoff2 = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36';

		const response = await axios.request({
			method: 'get',
			url: url,
			headers: {
				'User-Agent': userAgentWoff2,
			},
		});

		this.fileCache.save('css', url, response.data as string);

		return response.data as string;
	}
}

