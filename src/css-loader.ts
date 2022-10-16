import { URL } from 'url';
import axios from 'axios';
import CleanCss from 'clean-css';
import { Options } from './types';

export class CssLoader {
	private isRelativeUrlRegex = /..?\/.+?\.(?:woff2?|eot|ttf|otf|svg)/gi;

	constructor(private options: Options) { }

	public async loadAll(urls: Set<string>, isDevServer?: boolean): Promise<string> {
		let cssContent = '';

		for (const url of urls) {
			let singleCssContent = (await this.load(url)).trim();
			singleCssContent = this.normalizeUrls(singleCssContent, url);

			cssContent += singleCssContent + '\n';
		}

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
		const userAgentWoff2 = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36';

		const response = await axios.request({
			method: 'get',
			url: url,
			headers: {
				'User-Agent': userAgentWoff2,
			},
		});

		return response.data as string;
	}
}

