import axios from 'axios';

export class CssLoader {
	public async loadAll(urls: string[]): Promise<string> {
		let cssContent = '';

		for (const url of urls) {
			cssContent += await this.load(url) + '\n';
		}

		return cssContent;
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

