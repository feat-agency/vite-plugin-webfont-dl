import type { Font } from "./types";

export class CssParser {
	private fontSrcRegex = /(?:https?:)?\/\/.+?\.(?:woff2?|eot|ttf|otf|svg)/gi;
	private googleFontsKitSrcRegex = /https:\/\/fonts.gstatic.com\/l\/font\?kit=[a-z0-9&=]+/gi;

	private fontFilenameRegex = /[^/]+\.(?:woff2?|eot|ttf|otf|svg)/i;
	private googleFontsFileRegex = /\?kit=([a-z0-9]+)/i;

	public parse(cssContent: string, base: string, assetsDir: string): {[key: string]: Font} {
		const fonts: {[key: string]: Font} = {};

		const fontSrcMatches = cssContent.matchAll(this.fontSrcRegex);
		const googleFontsKitSrcMatches = cssContent.matchAll(this.googleFontsKitSrcRegex);

		if (fontSrcMatches) {
			for (const fontSrcMatch of fontSrcMatches) {
				const url = fontSrcMatch.toString();
				const filenameMatch = url.match(this.fontFilenameRegex);

				if (filenameMatch) {
					const filename = filenameMatch[0];

					fonts[filename] = {
						url,
						localPath: base + (assetsDir ? assetsDir + '/' : '') + filename,
					};
				}
			}
		}

		if (googleFontsKitSrcMatches) {
			for (const googleFontsKitSrcMatch of googleFontsKitSrcMatches) {
				const url = googleFontsKitSrcMatch.toString();
				const filename = url.match(this.googleFontsFileRegex)?.[1]?.toString();

				if (filename) {
					fonts[filename + '.woff2'] = {
						url,
						localPath: base + (assetsDir ? assetsDir + '/' : '') + filename + '.woff2',
					};
				}
			}
		}

		return fonts;
	}
}

