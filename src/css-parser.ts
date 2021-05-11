export class CssParser {
	private fontSrcRegex = /(?:https?:)?\/\/.+?\.(?:woff2?|eot|ttf|otf|svg)(?:[\?#=]+\w*)?/gi;
	private fontFileRegex = /[^\/]+$/;

	public parse(cssContent: string) {
		const fontUrls: any = {};
		const fontSrcMatches = cssContent.matchAll(this.fontSrcRegex);

		if (fontSrcMatches) {
			for (const fontSrcMatch of fontSrcMatches) {
				const fontFileMatch = fontSrcMatch.toString().match(this.fontFileRegex);

				if (fontFileMatch) {
					fontUrls[fontFileMatch.toString()] = fontSrcMatch.toString();
				}
			}
		}

		return fontUrls;
	};
}

