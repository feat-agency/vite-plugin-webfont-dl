import type { Font } from "./types";

export class CssParser {
	private fontSrcRegex = /(?:https?:)?\/\/.+?\.(?:woff2?|eot|ttf|otf|svg)(?:[?#=]+\w*)?/gi;
	private fontFileRegex = /[^/]+$/;

	public parse(cssContent: string, base: string, assetsDir: string): {[key: string]: Font} {
		const fonts: {[key: string]: Font} = {};
		const fontSrcMatches = cssContent.matchAll(this.fontSrcRegex);

		if (fontSrcMatches) {
			for (const fontSrcMatch of fontSrcMatches) {
				const fontFileName = fontSrcMatch.toString().match(this.fontFileRegex)?.toString();

				if (fontFileName) {
					fonts[fontFileName] = {
						url: fontSrcMatch.toString(),
						localPath: base + assetsDir + '/' + fontFileName,
					};
				}
			}
		}

		return fonts;
	}
}

