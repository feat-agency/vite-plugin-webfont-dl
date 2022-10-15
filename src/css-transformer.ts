import type { Font } from "./types";

export class CssTransformer {
	public transform(
		cssContent: string,
		fonts: {[key: string]: Font}
	): string {
		for (const fontFile in fonts) {
			const font = fonts[fontFile];

			cssContent = cssContent.replaceAll(font.url, font.localPath);
		}

		return cssContent;
	}
}

