import type { Font, FontCollection, FontExtension, Options } from './types';

enum FontMime {
	woff2 = 'font/woff2',
	woff = 'font/woff',
	ttf = 'font/ttf',
	otf = 'font/otf',
	svg = 'image/svg+xml',
	eot = 'application/vnd.ms-fontobject',
}

export class CssTransformer {
	constructor(
		private options: Required<Options>,
	) {}

	public transform(
		cssContent: string,
		fonts: FontCollection
	): string {
		fonts.forEach((font: Font) => {
			if (!this.options.embedFonts || !font.binary) {
				cssContent = cssContent.replaceAll(font.url, font.localPath);
			} else if (font.binary) {
				const escapedUrl = font.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const fontUrlRegex = new RegExp(`url\\(['"]?\\b${escapedUrl}\\b['"]?\\)`, 'gi');

				cssContent = cssContent.replaceAll(
					fontUrlRegex,
					`url(data:${this.getFontMime(font)};base64,${font.binary.toString('base64')})`
				);
			}
		});


		return cssContent;
	}

	private getFontMime(font: Font): string {
		const extension = font.filename.replace(/^.+\.(.+)$/, '$1') as FontExtension;

		return FontMime[extension];
	}
}

