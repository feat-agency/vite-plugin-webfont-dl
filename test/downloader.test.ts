import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Downloader, getResolvedOptions, Logger } from 'src/components';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('downloader', () => {
	let server: Server;
	let origin: string;
	let hits: Record<string, number> = {};

	const createDownloader = () => {
		const downloader = new Downloader(getResolvedOptions({}), new Logger());

		// keep the retries fast
		(downloader as unknown as { waitBeforeRetry: number[] }).waitBeforeRetry = [1, 5];

		return downloader;
	};

	beforeAll(async () => {
		server = createServer((request, response) => {
			const url = request.url ?? '';

			hits[url] = (hits[url] ?? 0) + 1;

			if (url === '/ok.css') {
				response.statusCode = 200;
				response.end('@font-face{font-family:Foo}');
			} else if (url === '/flaky.css') {
				response.statusCode = hits[url] < 3 ? 503 : 200;
				response.end(hits[url] < 3 ? 'unavailable' : 'recovered');
			} else if (url === '/rate-limited.css') {
				response.statusCode = 429;
				response.end('slow down');
			} else if (url === '/broken.css') {
				response.statusCode = 500;
				response.end('<html>error page</html>');
			} else if (url === '/bad-request.css') {
				response.statusCode = 400;
				response.end('<html>error page</html>');
			} else {
				response.statusCode = 404;
				response.end('<html>error page</html>');
			}
		});

		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

		origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		await new Promise((resolve) => server.close(resolve));
	});

	beforeEach(() => {
		hits = {};
	});

	it('should download text', async () => {
		const response = await createDownloader().download(`${origin}/ok.css`, 'text');

		expect(response.data).eq('@font-face{font-family:Foo}');
		expect(hits['/ok.css']).eq(1);
	});

	it('should download binary by default', async () => {
		const response = await createDownloader().download(`${origin}/ok.css`);

		expect(Buffer.isBuffer(response.data)).eq(true);
		expect((response.data as Buffer).toString()).eq('@font-face{font-family:Foo}');
	});

	it('should reject on 404 instead of returning the error page', async () => {
		await expect(
			createDownloader().download(`${origin}/missing.woff2`)
		).rejects.toThrow(/404/);
	});

	it('should reject on 400 instead of returning the error page', async () => {
		await expect(
			createDownloader().download(`${origin}/bad-request.css`, 'text')
		).rejects.toThrow(/400/);
	});

	it('should not retry permanent client errors', async () => {
		await expect(
			createDownloader().download(`${origin}/missing.woff2`)
		).rejects.toThrow();

		expect(hits['/missing.woff2']).eq(1);
	});

	it('should retry server errors and give up after 3 tries', async () => {
		await expect(
			createDownloader().download(`${origin}/broken.css`, 'text')
		).rejects.toThrow(/500/);

		expect(hits['/broken.css']).eq(3);
	});

	it('should retry 429 responses', async () => {
		await expect(
			createDownloader().download(`${origin}/rate-limited.css`, 'text')
		).rejects.toThrow(/429/);

		expect(hits['/rate-limited.css']).eq(3);
	});

	it('should recover when a retry succeeds', async () => {
		const response = await createDownloader().download(`${origin}/flaky.css`, 'text');

		expect(response.data).eq('recovered');
		expect(hits['/flaky.css']).eq(3);
	});

	it('should retry network errors', async () => {
		// nothing listens on port 1
		await expect(
			createDownloader().download('http://127.0.0.1:1/font.woff2')
		).rejects.toThrow();
	});
});
