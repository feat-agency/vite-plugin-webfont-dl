import { Options } from './types';

export class CssInjector {

	constructor(private options: Options) { }

	public injectAsStylesheet(html: string, base: string, path: string): string {
		if (this.options.async) {
			return this.injectAsync(html, base, path);
		} else {
			return this.injectSync(html, base, path);
		}
	}

	public injectAsStyleTag(html: string, cssContent: string): string {
		if (this.options.minifyCss) {
			return html.replace(
				/([ \t]*)<\/head>/,
				`$1$1<style>${cssContent}</style>\n$1</head>`
			);
		}

		return html.replace(
			/([ \t]*)<\/head>/,
			`$1$1<style>\n${cssContent.replace(/^/gm, '$1$1$1')}\n$1$1</style>\n$1</head>`
		);
	}


	private injectAsync(html: string, base: string, path: string): string {
		return html.replace(
			/([ \t]*)<\/head>/,
			`$1$1<link rel="preload" as="style" href="${base}${path}">\n$1$1<link rel="stylesheet" media="print" onload="this.onload=null;this.removeAttribute('media');" href="${base}${path}">\n$1</head>`
		);
	}

	private injectSync(html: string, base: string, path: string): string {
		return html.replace(
			/([ \t]*)<\/head>/,
			`$1$1<link rel="preload" as="style" href="${base}${path}">\n$1$1<link rel="stylesheet" href="${base}${path}">\n$1</head>`
		);
	}
}

