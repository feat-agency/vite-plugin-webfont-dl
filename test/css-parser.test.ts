import { readFileSync } from 'node:fs';
import { getResolvedOptions } from 'src/components';
import { CssParser } from 'src/components/css-parser';
import { describe, expect, it } from 'vitest';

describe('css parser', () => {

	it('should parse Google Fonts', () => {
		const css = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const { fonts } = (new CssParser(getResolvedOptions({}))).parse(css, '/', 'assets');

		expect(fonts.size).eq(20); // 26 with duplicates
	});

	it('should parse Google Fonts kit', () => {
		const css = readFileSync(__dirname + '/fixtures/google-fonts-kit.css').toString();
		const { fonts } = (new CssParser(getResolvedOptions({}))).parse(css, '/', 'assets');

		expect(fonts.size).eq(1);
	});

	it('should find imports', () => {
		const css = readFileSync(__dirname + '/fixtures/imports.css').toString();
		const parsedBundleCss = (new CssParser(getResolvedOptions({}))).parseBundleCss(css, '/', 'assets');

		expect(Array.from(parsedBundleCss.webfontUrlsCss)).members([
			'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=fallback',
			'https://fonts.googleapis.com/css2?family=Inter:wght@500&display=fallback',
			'https://fonts.googleapis.com/css2?family=Inter:wght@600&display=fallback',
		]);

		expect(Array.from(parsedBundleCss.matchedCssParts)).members([
			'@import url(\'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=fallback\');',
			'@import"https://fonts.googleapis.com/css2?family=Inter:wght@500&display=fallback";',
			'@import \'https://fonts.googleapis.com/css2?family=Inter:wght@600&display=fallback\';',
		]);
	});

	it('should filter subsets', () => {
		const options = getResolvedOptions({
			subsetsAllowed: ['latin', 'latin-ext'],
		});

		const css = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const { fonts } = (new CssParser(options)).parse(css, '/', 'assets');

		expect(fonts.size).eq(6);
	});

	describe('fonts with the same file name', () => {
		// Bunny Fonts / Fontsource: the file name is only the subset, weight and style
		const interUrl = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.3.0/latin-400-normal.woff2';
		const robotoUrl = 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@5.3.0/latin-400-normal.woff2';
		const robotoItalicUrl = 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@5.3.0/latin-400-italic.woff2';

		const fontFace = (family: string, url: string) => `@font-face{font-family:${family};src:url(${url}) format('woff2')}`;

		const parse = (css: string, assetsDir = 'assets') => {
			const parser = new CssParser(getResolvedOptions({}));
			const { fonts } = parser.parse(css, '/', assetsDir);

			parser.deduplicateFilenames(fonts, '/', assetsDir);

			return fonts;
		};

		it('should keep every font of the css', () => {
			const { fonts } = (new CssParser(getResolvedOptions({}))).parse(
				fontFace('Inter', interUrl) + fontFace('Roboto', robotoUrl),
				'/',
				'assets'
			);

			expect([...fonts.keys()]).deep.eq([interUrl, robotoUrl]);
		});

		it('should prefix the file name with the directory of the font', () => {
			const fonts = parse(fontFace('Inter', interUrl) + fontFace('Roboto', robotoUrl));

			expect(fonts.get(interUrl)).deep.eq({
				url: interUrl,
				filename: 'inter-5.3.0-latin-400-normal.woff2',
				localPath: '/assets/inter-5.3.0-latin-400-normal.woff2',
			});

			expect(fonts.get(robotoUrl)).deep.eq({
				url: robotoUrl,
				filename: 'roboto-5.3.0-latin-400-normal.woff2',
				localPath: '/assets/roboto-5.3.0-latin-400-normal.woff2',
			});
		});

		it('should not touch a unique file name', () => {
			const fonts = parse(fontFace('Inter', interUrl) + fontFace('Roboto', robotoUrl) + fontFace('Roboto', robotoItalicUrl));

			expect(fonts.get(robotoItalicUrl)?.filename).eq('latin-400-italic.woff2');
			expect(fonts.get(robotoItalicUrl)?.localPath).eq('/assets/latin-400-italic.woff2');

			const single = parse(fontFace('Inter', interUrl), '@webfonts');

			expect(single.get(interUrl)?.localPath).eq('/@webfonts/latin-400-normal.woff2');
		});

		it('should not count a repeated url as another font', () => {
			const fonts = parse(fontFace('Inter', interUrl) + fontFace('Inter Alias', interUrl));

			expect(fonts.size).eq(1);
			expect(fonts.get(interUrl)?.filename).eq('latin-400-normal.woff2');
		});

		it('should fall back to the hash of the url when the directory is the same too', () => {
			const first = 'https://fonts.gstatic.com/a/files/font.woff2';
			const second = 'https://fonts.bunny.net/b/files/font.woff2';
			const fonts = parse(fontFace('First', first) + fontFace('Second', second));

			const filenames = [...fonts.values()].map((font) => font.filename);

			expect(filenames[0]).match(/^[0-9a-f]{8}-files-font\.woff2$/);
			expect(filenames[1]).match(/^[0-9a-f]{8}-files-font\.woff2$/);
			expect(filenames[0]).not.eq(filenames[1]);
		});

		it('should treat file names differing only in case as the same', () => {
			const upper = 'https://fonts.gstatic.com/s/one/Font.woff2';
			const lower = 'https://fonts.gstatic.com/s/two/font.woff2';
			const fonts = parse(fontFace('One', upper) + fontFace('Two', lower));

			expect(fonts.get(upper)?.filename).eq('one-Font.woff2');
			expect(fonts.get(lower)?.filename).eq('two-font.woff2');
		});

		it('should give the same names when it runs again', () => {
			const parser = new CssParser(getResolvedOptions({}));
			const { fonts } = parser.parse(fontFace('Inter', interUrl) + fontFace('Roboto', robotoUrl), '/', 'assets');

			parser.deduplicateFilenames(fonts, '/', 'assets');
			parser.deduplicateFilenames(fonts, '/', 'assets');

			expect([...fonts.values()].map((font) => font.filename)).deep.eq([
				'inter-5.3.0-latin-400-normal.woff2',
				'roboto-5.3.0-latin-400-normal.woff2',
			]);
		});
	});
});
