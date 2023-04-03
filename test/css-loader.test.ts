import { readFileSync } from 'fs';
import { CssLoader } from 'src/css-loader';
import { Downloader } from 'src/downloader';
import { FileCache } from 'src/file-cache';
import { Options } from 'src/types';
import { describe, expect, it } from 'vitest';
import { Logger } from 'src/logger';

describe('css loader', () => {

	it('should minify css', () => {
		const options: Options = {
			minifyCss: true,
		};

		const cssBefore = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/google-fonts.min.css').toString().replace(/\n$/, '');

		const cssLoader = new CssLoader(
			options,
			new Logger(),
			new Downloader({}, new Logger()),
			new FileCache(options)
		);
		const cssAfter = cssLoader.minify(cssBefore);

		expect(cssAfter).eq(cssExpected);
	});



	it('should normalize relative urls', () => {
		const cssBefore = readFileSync(__dirname + '/fixtures/relative.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/relative-to-absolute.css').toString();

		const cssLoader = new CssLoader(
			{},
			new Logger(),
			new Downloader({}, new Logger()),
			new FileCache({})
		);
		const cssAfter = cssLoader.normalizeUrls(cssBefore, 'https://www.example.com/css/test.css');

		expect(cssAfter).eq(cssExpected);
	});
});
