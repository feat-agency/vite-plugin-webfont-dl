export class CssInjector {
	public inject(html: string, base: string, path: string): string {
		return html.replace(
			'</head>',
			`<link rel="stylesheet" media="print" onload="this.onload=null;this.removeAttribute('media');" href="${base}${path}">\n</head>`
		);
	}
}

