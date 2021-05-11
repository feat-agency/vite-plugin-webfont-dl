export class CssInjector {
	public inject(html: string, cssContent: string) {
		return html.replace('</head>', '\n<style>\n' + cssContent + '\n</style>\n</head>');
	};
}

