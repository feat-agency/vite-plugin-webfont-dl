import type { FontsCollection, ParsedBundleCss } from './types';

export class CssParser {
	private fontSrcRegex = /(?:https?:)?\/\/.+?\.(?:woff2?|eot|ttf|otf|svg)/gi;
	private googleFontsKitSrcRegex = /https:\/\/fonts\.gstatic\.com\/l\/font\?kit=[a-z0-9&=_-]+/gi;

	private fontFilenameRegex = /[^/]+\.(?:woff2?|eot|ttf|otf|svg)/i;
	private googleFontsFileRegex = /\?kit=([a-z0-9_-]+)/i;

	// @font-face { src: url('...'); }
	// @import url('...');
	private webfontProviders = [
		/https:\/\/fonts\.googleapis\.com\//i,
		/https:\/\/fonts\.gstatic\.com\//i,
		/https:\/\/fonts\.bunny\.net\//i,
		/https:\/\/api\.fontshare\.com\//i,
	];

	public parse(cssContent: string, base: string, assetsDir: string): FontsCollection {
		const fonts: FontsCollection = {};

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



	public parseBundleCss(cssContent: string, base: string, assetsDir: string): ParsedBundleCss {
		const fonts: FontsCollection = {};
		const webfontUrlsCss = new Set<string>([]);
		const matchedCssParts: string[] = [];

		const importRegex = /@import\s+(?:url\()?['"]?([^\s'"]+)['"]?\)?;/g;
		const fontFaceRegex = /@font-face\s*{[^}]*}/g;

		const imports = [...cssContent.matchAll(importRegex)];
		const fontFaces = [...cssContent.matchAll(fontFaceRegex)];

		fontFaces.forEach((match) => {
			const fontFace = match[0];
			const parsedFonts = this.parse(fontFace, base, assetsDir);

			for (const filename in parsedFonts) {
				const font = parsedFonts[filename];

				if (this.webfontProviders.some((regex) => regex.test(font.url))) {
					fonts[filename] = font;
					matchedCssParts.push(match[0]);
				}
			}
		});

		imports.forEach((match) => {
			const url = match[1];

			if (this.webfontProviders.some((regex) => regex.test(url))) {
				webfontUrlsCss.add(url);
				matchedCssParts.push(match[0]);
			}
		});

		return {
			fonts,
			webfontUrlsCss,
			matchedCssParts,
		};
	}
}

