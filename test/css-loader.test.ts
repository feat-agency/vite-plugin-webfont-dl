import { readFileSync } from 'node:fs';
import { CssLoader } from 'src/components/css-loader';
import { Downloader } from 'src/components/downloader';
import { FileCache } from 'src/components/file-cache';
import { getResolvedOptions } from 'src/components/default-options';
import { describe, expect, it } from 'vitest';
import { Logger } from 'src/components/logger';

describe('css loader', () => {

	it('should minify css', () => {
		const options = getResolvedOptions({
			minifyCss: true,
			cache: false,
		});

		const cssBefore = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/google-fonts.min.css').toString().replace(/\n$/, '');

		const cssLoader = new CssLoader(
			options,
			new Logger(),
			new Downloader(getResolvedOptions({}), new Logger()),
			new FileCache(options)
		);
		const cssAfter = cssLoader.minify(cssBefore);

		expect(cssAfter).eq(cssExpected);
	});



	it('should normalize relative urls', () => {
		const cssBefore = readFileSync(__dirname + '/fixtures/pre-normalization.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/post-normalization.css').toString();

		const cssLoader = new CssLoader(
			getResolvedOptions({}),
			new Logger(),
			new Downloader(getResolvedOptions({}), new Logger()),
			new FileCache(getResolvedOptions({ cache: false }))
		);

		const cssAfter = cssLoader.normalizeUrls(cssBefore, 'https://www.example.com/css/test.css');

		expect(cssAfter).eq(cssExpected);
	});
});
