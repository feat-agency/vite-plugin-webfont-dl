import { readFileSync } from 'node:fs';
import { CssLoader } from 'src/components/css-loader';
import { Downloader } from 'src/components/downloader';
import { FileCache } from 'src/components/file-cache';
import { getResolvedOptions } from 'src/components/default-options';
import { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from 'src/components/logger';

describe('css loader', () => {

	it('should normalize relative urls', () => {
		const cssBefore = readFileSync(__dirname + '/fixtures/pre-normalization.css').toString();
		const cssExpected = readFileSync(__dirname + '/fixtures/post-normalization.css').toString();

		const cssLoader = new CssLoader(
			new Logger(),
			new Downloader(getResolvedOptions({}), new Logger()),
			new FileCache(getResolvedOptions({ cache: false }))
		);

		const cssAfter = cssLoader.normalizeUrls(cssBefore, 'https://www.example.com/css/test.css');

		expect(cssAfter).eq(cssExpected);
	});

	describe('loadEach', () => {
		const createCssLoader = () => new CssLoader(
			new Logger(),
			new Downloader(getResolvedOptions({}), new Logger()),
			new FileCache(getResolvedOptions({ cache: false }))
		);

		const httpError = new AxiosError('Request failed with status code 404', 'ERR_BAD_REQUEST', undefined, undefined, { status: 404 } as AxiosResponse);
		const networkError = new AxiosError('timeout of 2500ms exceeded', 'ECONNABORTED');

		const mockDownload = (responses: Record<string, string | Error>) => vi.spyOn(Downloader.prototype, 'download').mockImplementation(async (url: string) => {
			// later urls answer first
			await new Promise((resolve) => setTimeout(resolve, 10 - Object.keys(responses).indexOf(url) * 3));

			const response = responses[url];

			if (response instanceof Error) {
				throw response;
			}

			return { data: response } as never;
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('should keep the order of the urls and normalize the font urls', async () => {
			mockDownload({
				'https://a.example/css/a.css': ' @font-face{src:url(../fonts/a.woff2)} ',
				'https://b.example/b.css': '@font-face{src:url(//cdn.example/b.woff2)}',
				'https://c.example/c.css': '@font-face{src:url(https://c.example/c.woff2)}',
			});

			const { css, failed } = await createCssLoader().loadEach([
				'https://a.example/css/a.css',
				'https://b.example/b.css',
				'https://c.example/c.css',
			]);

			expect([...css.entries()]).deep.eq([
				['https://a.example/css/a.css', '@font-face{src:url(https://a.example/fonts/a.woff2)}'],
				['https://b.example/b.css', '@font-face{src:url(https://cdn.example/b.woff2)}'],
				['https://c.example/c.css', '@font-face{src:url(https://c.example/c.woff2)}'],
			]);
			expect(failed.size).eq(0);
		});

		it('should join everything with loadAll', async () => {
			mockDownload({ 'https://a.example/a.css': 'a{}\n', 'https://b.example/b.css': '\nb{}' });

			expect(await createCssLoader().loadAll(['https://a.example/a.css', 'https://b.example/b.css'])).eq('a{}\nb{}');
		});

		it('should reject on an http error by default', async () => {
			mockDownload({ 'https://a.example/a.css': 'a{}', 'https://b.example/b.css': httpError });

			await expect(
				createCssLoader().loadEach(['https://a.example/a.css', 'https://b.example/b.css'])
			).rejects.toThrow(/404/);
		});

		it('should report http errors as failed urls when they are isolated', async () => {
			mockDownload({ 'https://a.example/a.css': 'a{}', 'https://b.example/b.css': httpError });

			const { css, failed } = await createCssLoader().loadEach(['https://a.example/a.css', 'https://b.example/b.css'], true);

			expect([...css.keys()]).deep.eq(['https://a.example/a.css']);
			expect([...failed]).deep.eq(['https://b.example/b.css']);
		});

		it('should always reject on a network error', async () => {
			mockDownload({ 'https://a.example/a.css': 'a{}', 'https://b.example/b.css': networkError });

			await expect(
				createCssLoader().loadEach(['https://a.example/a.css', 'https://b.example/b.css'], true)
			).rejects.toThrow(/timeout/);
		});
	});
});
