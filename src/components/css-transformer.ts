import CleanCSS from 'clean-css';
import type { Font, FontCollection, FontExtension, Options } from '../types';

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
		// longest url first: an url can be the prefix of another one (`font.woff` / `font.woff2`)
		const sortedFonts = [...fonts.values()].sort((a, b) => b.url.length - a.url.length);

		sortedFonts.forEach((font: Font) => {
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

	public formatCss(cssContent: string, isDevServer?: boolean): string {
		if (!isDevServer && this.options.minifyCss) {
			return this.minify(cssContent);
		}

		return cssContent.trim();
	}

	public minify(cssContent: string) {
		return new CleanCSS().minify(cssContent).styles;
	}

	private getFontMime(font: Font): string {
		return getFontMime(font.filename);
	}
}

export const getFontMime = (filename: string): string => {
	const extension = filename.replace(/[?#].*$/, '').replace(/^.+\.(.+)$/, '$1').toLowerCase() as FontExtension;

	const mime: string | undefined = FontMime[extension];

	return mime ?? FontMime.woff2;
};

