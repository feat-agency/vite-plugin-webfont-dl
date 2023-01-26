import type { FontsCollection } from "./types";

export class CssTransformer {
	public transform(
		cssContent: string,
		fonts: FontsCollection
	): string {
		for (const fontFile in fonts) {
			const font = fonts[fontFile];

			cssContent = cssContent.replaceAll(font.url, font.localPath);
		}

		return cssContent;
	}
}

