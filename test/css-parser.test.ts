import { readFileSync } from 'fs';
import { CssParser } from 'src/css-parser';
import { describe, expect, it } from 'vitest';

describe('css parser', () => {

	it('should parse Google Fonts', () => {
		const css = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const fonts = (new CssParser()).parse(css, '/', 'assets');

		expect(Object.keys(fonts).length).eq(20); // 26 with duplicates
	});
});
