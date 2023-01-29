import { readFileSync } from 'fs';
import { CssLoader } from 'src/css-loader';
import { FileCache } from 'src/file-cache';
import { Options } from 'src/types';
import { describe, expect, it } from 'vitest';

describe('css loader', () => {

	it('should minify css', () => {
		const options: Options = {
			minifyCss: true,
		};

		const cssBefore = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/google-fonts.min.css').toString().replace(/\n$/, '');

		const cssAfter = (new CssLoader(options, new FileCache())).minify(cssBefore);

		expect(cssAfter).eq(cssExpected);
	});



	it('should normalize relative urls', () => {
		const cssBefore = readFileSync(__dirname + '/fixtures/relative.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/relative-to-absolute.css').toString();
		const cssAfter = (new CssLoader({}, new FileCache())).normalizeUrls(cssBefore, 'https://www.example.com/css/test.css');

		expect(cssAfter).eq(cssExpected);
	});
});
