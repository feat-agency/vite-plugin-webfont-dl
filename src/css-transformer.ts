import type { FontCollection } from './types';

export class CssTransformer {
	public transform(
		cssContent: string,
		fonts: FontCollection
	): string {
		for (const fontFile in fonts) {
			const font = fonts[fontFile];

			cssContent = cssContent.replaceAll(font.url, font.localPath);
		}

		return cssContent;
	}
}

