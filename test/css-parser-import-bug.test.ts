import { getResolvedOptions } from 'src/components';
import { CssParser } from 'src/components/css-parser';
import { describe, expect, it } from 'vitest';

describe('css parser - import URL extraction bug', () => {

	it('should extract @import URLs without trailing parenthesis - url() syntax', () => {
		const css = `@import url(https://fonts.googleapis.com/css?family=Roboto:300,400);`;
		const { webfontUrlsCss } = (new CssParser(getResolvedOptions({}))).parseBundleCss(css, '/', 'assets');

		expect(Array.from(webfontUrlsCss)).toEqual([
			'https://fonts.googleapis.com/css?family=Roboto:300,400',
		]);
	});

	it('should extract @import URLs without trailing parenthesis - url() with quotes', () => {
		const css = `@import url('https://fonts.googleapis.com/css?family=Roboto:300,400');`;
		const { webfontUrlsCss } = (new CssParser(getResolvedOptions({}))).parseBundleCss(css, '/', 'assets');

		expect(Array.from(webfontUrlsCss)).toEqual([
			'https://fonts.googleapis.com/css?family=Roboto:300,400',
		]);
	});

	it('should extract @import URLs without trailing parenthesis - direct string', () => {
		const css = `@import "https://fonts.googleapis.com/css?family=Roboto:300,400";`;
		const { webfontUrlsCss } = (new CssParser(getResolvedOptions({}))).parseBundleCss(css, '/', 'assets');

		expect(Array.from(webfontUrlsCss)).toEqual([
			'https://fonts.googleapis.com/css?family=Roboto:300,400',
		]);
	});

	it('should handle multiple @import statements correctly', () => {
		const css = `
@import url(https://fonts.googleapis.com/css?family=Roboto:300,400,500,700);
@import url(https://fonts.googleapis.com/earlyaccess/notokufiarabic.css);
		`.trim();

		const { webfontUrlsCss } = (new CssParser(getResolvedOptions({}))).parseBundleCss(css, '/', 'assets');

		expect(Array.from(webfontUrlsCss)).toEqual([
			'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700',
			'https://fonts.googleapis.com/earlyaccess/notokufiarabic.css',
		]);
	});

	it('should handle @import with complex query parameters', () => {
		const css = `@import url(https://fonts.googleapis.com/css2?family=Roboto:wght@300;400&display=swap);`;
		const { webfontUrlsCss } = (new CssParser(getResolvedOptions({}))).parseBundleCss(css, '/', 'assets');

		expect(Array.from(webfontUrlsCss)).toEqual([
			'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400&display=swap',
		]);
	});
});
