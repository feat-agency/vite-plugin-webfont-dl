import { Options } from './types';

export class CssInjector {

	constructor(private options: Required<Options>) { }

	public injectAsStylesheet(html: string, base: string, cssPath: string): string {
		if (this.options.async) {
			return this.injectAsync(html, base, cssPath);
		} else {
			return this.injectSync(html, base, cssPath);
		}
	}

	public injectAsStyleTag(html: string, cssContent: string): string {
		if (this.options.minifyCss) {
			return html.replace(
				/(\n?)([ \t]*)<\/head>/,
				`$1$2$2<style>${cssContent}</style>$1$2</head>`
			);
		}

		return html.replace(
			/([ \t]*)<\/head>/,
			`$1$1<style>\n${cssContent.replace(/^/gm, '$1$1$1')}\n$1$1</style>\n$1</head>`
		);
	}


	private injectAsync(html: string, base: string, cssPath: string): string {
		return html.replace(
			/([ \t]*)<\/head>/,
			`$1$1<link rel="preload" as="style" href="${base}${cssPath}">\n$1$1<link rel="stylesheet" media="print" onload="this.onload=null;this.removeAttribute('media');" href="${base}${cssPath}">\n$1</head>`
		);
	}

	private injectSync(html: string, base: string, cssPath: string): string {
		return html.replace(
			/([ \t]*)<\/head>/,
			`$1$1<link rel="preload" as="style" href="${base}${cssPath}">\n$1$1<link rel="stylesheet" href="${base}${cssPath}">\n$1</head>`
		);
	}
}

