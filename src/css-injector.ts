import { Options } from './types';

export class CssInjector {

	constructor(private options: Options) {}

	public inject(html: string, base: string, path: string): string {
		if (this.options.async) {
			return this.injectAsync(html, base, path);
		} else {
			return this.injectSync(html, base, path);
		}
	}


	private injectAsync(html: string, base: string, path: string): string {
		return html.replace(
			/([ \t]*)<\/head>/,
			`$1<link rel="preload" as="style" href="${base}${path}">\n$1<link rel="stylesheet" media="print" onload="this.onload=null;this.removeAttribute('media');" href="${base}${path}">\n</head>`
		);
	}

	private injectSync(html: string, base: string, path: string): string {
		return html.replace(
			/([ \t]*)<\/head>/,
			`$1<link rel="preload" as="style" href="${base}${path}">\n$1<link rel="stylesheet" href="${base}${path}">\n</head>`
		);
	}
}

