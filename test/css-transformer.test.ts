import { readFileSync } from 'node:fs';
import { CssParser } from 'src/components/css-parser';
import { CssTransformer, getFontMime } from 'src/components/css-transformer';
import type { Font, FontCollection } from 'src/types';
import { getResolvedOptions } from 'src/components/default-options';
import { describe, expect, it } from 'vitest';

describe('css transformer', () => {

	it('should replace fonts', () => {
		const cssBefore = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/google-fonts-transformed.css').toString();

		const { fonts } = (new CssParser(getResolvedOptions({}))).parse(cssBefore, '/', 'assets');
		const cssAfter = (new CssTransformer(getResolvedOptions({}))).transform(cssBefore, fonts);

		expect(cssAfter).eq(cssExpected);
	});

	it('should embed fonts', () => {
		const cssBefore = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/google-fonts-embedded.css').toString();

		const { fonts } = (new CssParser(getResolvedOptions({}))).parse(cssBefore, '/', 'assets');

		fonts.forEach((font: Font) => {
			font.binary = Buffer.from('TEST');
		});

		const cssAfter = (new CssTransformer(getResolvedOptions({ embedFonts: true }))).transform(cssBefore, fonts);

		expect(cssAfter).eq(cssExpected);
	});

	it('should minify css', () => {
		const options = getResolvedOptions({
			minifyCss: true,
			cache: false,
		});

		const cssBefore = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/google-fonts.min.css').toString().replace(/\n$/, '');

		const cssTransformer = new CssTransformer(options);
		const cssAfter = cssTransformer.minify(cssBefore);

		expect(cssAfter).eq(cssExpected);
	});

	it('should replace an url which is the prefix of another url correctly', () => {
		// `font.woff` is listed first and is a prefix of `font.woff2`
		const css = '@font-face{src:url(https://example.com/font.woff) format("woff"),url(https://example.com/font.woff2) format("woff2")}';

		const fonts: FontCollection = new Map([
			['font.woff', { url: 'https://example.com/font.woff', filename: 'font.woff', localPath: '/assets/font-AAAA.woff' }],
			['font.woff2', { url: 'https://example.com/font.woff2', filename: 'font.woff2', localPath: '/assets/font-BBBB.woff2' }],
		]);

		const cssAfter = (new CssTransformer(getResolvedOptions({}))).transform(css, fonts);

		expect(cssAfter).eq('@font-face{src:url(/assets/font-AAAA.woff) format("woff"),url(/assets/font-BBBB.woff2) format("woff2")}');
	});

	it('should resolve the mime type of a font', () => {
		expect(getFontMime('font.woff2')).eq('font/woff2');
		expect(getFontMime('font.woff')).eq('font/woff');
		expect(getFontMime('font.ttf')).eq('font/ttf');
		expect(getFontMime('font.otf')).eq('font/otf');
		expect(getFontMime('/assets/icons.SVG?v=1#iefix')).eq('image/svg+xml');
		expect(getFontMime('font.eot')).eq('application/vnd.ms-fontobject');
		expect(getFontMime('unknown')).eq('font/woff2');
	});
});
