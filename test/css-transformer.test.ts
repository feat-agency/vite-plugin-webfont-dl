import { readFileSync } from 'fs';
import { CssParser } from 'src/css-parser';
import { CssTransformer } from 'src/css-transformer';
import { Font } from 'src/types';
import { describe, expect, it } from 'vitest';

describe('css transformer', () => {

	it('should replace fonts', () => {
		const cssBefore = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/google-fonts-transformed.css').toString();

		const fonts = (new CssParser()).parse(cssBefore, '/', 'assets');
		const cssAfter = (new CssTransformer({})).transform(cssBefore, fonts);

		expect(cssAfter).eq(cssExpected);
	});

	it('should embed fonts', () => {
		const cssBefore = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/google-fonts-embedded.css').toString();

		const fonts = (new CssParser()).parse(cssBefore, '/', 'assets');

		fonts.forEach((font: Font) => {
			font.binary = Buffer.from('TEST');
		});

		const cssAfter = (new CssTransformer({ embedFonts: true })).transform(cssBefore, fonts);

		expect(cssAfter).eq(cssExpected);
	});
});
