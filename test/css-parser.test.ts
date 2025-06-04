import { readFileSync } from 'node:fs';
import { CssParser } from 'src/components/css-parser';
import { describe, expect, it } from 'vitest';

describe('css parser', () => {

	it('should parse Google Fonts', () => {
		const css = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const { fonts } = (new CssParser()).parse(css, '/', 'assets');

		expect(fonts.size).eq(20); // 26 with duplicates
	});

	it('should parse Google Fonts kit', () => {
		const css = readFileSync(__dirname + '/fixtures/google-fonts-kit.css').toString();
		const { fonts } = (new CssParser()).parse(css, '/', 'assets');

		expect(fonts.size).eq(1);
	});

	it('should find imports', () => {
		const css = readFileSync(__dirname + '/fixtures/imports.css').toString();
		const parsedBundleCss = (new CssParser()).parseBundleCss(css, '/', 'assets');

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
});
