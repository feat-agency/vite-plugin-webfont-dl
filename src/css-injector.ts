export class CssInjector {
	public inject(html: string, base: string, path: string): string {
		return html.replace(
			/([ \t]*)<\/head>/,
			`$1<link rel="preload" as="style" href="${base}${path}">\n$1<link rel="stylesheet" media="print" onload="this.onload=null;this.removeAttribute('media');" href="${base}${path}">\n</head>`
		);
	}
}

