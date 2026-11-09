import { AxiosError } from 'axios';
import type { ServerResponse } from 'node:http';
import type { Connect } from 'vite';
import { Downloader } from 'src/components';
import viteWebfontDownload from 'src/index';
import type { Options } from 'src/types';
import { WebfontDownload } from 'src/webfont-download';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const googleCssUrl = 'https://fonts.googleapis.com/css2?family=Inter&display=swap';
const interLatinUrl = 'https://fonts.gstatic.com/s/inter/v20/inter-latin.woff2';
const interCyrillicUrl = 'https://fonts.gstatic.com/s/inter/v20/inter-cyrillic.woff2';
const lobsterUrl = 'https://fonts.gstatic.com/s/lobster/v30/lobster.woff2';

const googleCss = `/* cyrillic */
@font-face {
  font-family: 'Inter';
  src: url(${interCyrillicUrl}) format('woff2');
}
/* latin */
@font-face {
  font-family: 'Inter';
  src: url(${interLatinUrl}) format('woff2');
}`;

const lobsterFontFace = `@font-face{font-family:Lobster;src:url(${lobsterUrl})format("woff2")}`;
const userCss = `${lobsterFontFace}body{font-family:Inter}h1{font-family:Lobster}`;

const html = `<!doctype html>
<html>
	<head>
		<meta charset="utf-8">
	</head>
	<body></body>
</html>
`;

interface Asset { source: string | Uint8Array }
type Bundle = Record<string, Asset>;

interface Hooks {
	configResolved: (config: unknown) => void;
	transformIndexHtml: (html: string, ctx: { path: string }) => string;
	generateBundle: (this: unknown, options: unknown, bundle: Bundle) => Promise<void>;
}

interface BuildConfig {
	minify?: boolean | string;
	ssr?: boolean | string;
}

const setup = (
	webfontUrls: string | string[] = [],
	options: Options = {},
	build: BuildConfig = {},
) => {
	const plugin = viteWebfontDownload(webfontUrls, { cache: false, ...options }) as unknown as Hooks;
	const emitted = new Map<string, string | Uint8Array>();

	const context = {
		emitFile: (file: { name: string; source: string | Uint8Array }) => {
			emitted.set(file.name, file.source);

			return file.name;
		},
		getFileName: (ref: string) => 'assets/' + ref,
	};

	plugin.configResolved({
		base: '/',
		cacheDir: 'node_modules/.vite',
		logger: { info: vi.fn(), error: vi.fn() },
		build: { assetsDir: 'assets', minify: 'oxc', ssr: false, ...build },
	});

	const run = async (bundle: Bundle, thisArg: object = {}) => {
		await plugin.generateBundle.call({ ...context, ...thisArg }, {}, bundle);

		return bundle;
	};

	return { plugin, emitted, run };
};

describe('plugin (build)', () => {
	let download: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		download = vi.spyOn(Downloader.prototype, 'download').mockImplementation((url: string) => {
			if (url === googleCssUrl) {
				return Promise.resolve({ data: googleCss }) as never;
			}

			if (url.startsWith('https://fonts.gstatic.com/')) {
				return Promise.resolve({ data: Buffer.from('font:' + url) }) as never;
			}

			return Promise.reject(new AxiosError('Request failed with status code 404')) as never;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('@font-face in bundled css', () => {
		it('should move the rule into the html and self-host the font', async () => {
			const { plugin, emitted, run } = setup();

			plugin.transformIndexHtml(html, { path: '/index.html' });

			const bundle = await run({
				'index.html': { source: html },
				'assets/index.css': { source: userCss },
			});

			// removed from the bundled css
			expect(bundle['assets/index.css'].source).eq('body{font-family:Inter}h1{font-family:Lobster}');

			// font is emitted
			expect(emitted.has('lobster.woff2')).eq(true);

			// rule is kept, pointing to the local font
			expect(bundle['index.html'].source).contain('font-family:Lobster;src:url(/assets/lobster.woff2)');
			expect(bundle['index.html'].source).not.contain('fonts.gstatic.com');
		});

		it('should keep the rule next to downloaded webfont css', async () => {
			const { plugin, emitted, run } = setup(googleCssUrl);

			plugin.transformIndexHtml(html, { path: '/index.html' });

			const bundle = await run({
				'index.html': { source: html },
				'assets/index.css': { source: userCss },
			});

			const source = bundle['index.html'].source as string;

			expect(source).contain('url(/assets/lobster.woff2)');
			expect(source).contain('url(/assets/inter-latin.woff2)');
			expect(source).contain('url(/assets/inter-cyrillic.woff2)');
			expect(source).not.contain('fonts.gstatic.com');
			expect([...emitted.keys()].sort()).members(['inter-cyrillic.woff2', 'inter-latin.woff2', 'lobster.woff2']);
		});

		it('should save the rule to webfonts.css when there is no html', async () => {
			const { emitted, run } = setup();

			const bundle = await run({
				'assets/app.css': { source: userCss },
			});

			expect(bundle['assets/app.css'].source).eq('body{font-family:Inter}h1{font-family:Lobster}');
			expect(emitted.has('lobster.woff2')).eq(true);
			expect(emitted.get('webfonts.css')).contain('font-family:Lobster;src:url(/assets/lobster.woff2)');
		});

		it('should not duplicate a rule with multiple sources', async () => {
			const fontFace = '@font-face{font-family:Lobster;src:' +
				'url(https://fonts.gstatic.com/s/lobster/v30/lobster.woff2)format("woff2"),' +
				'url(https://fonts.gstatic.com/s/lobster/v30/lobster.woff)format("woff")}';

			const { emitted, run } = setup();

			await run({
				'assets/app.css': { source: fontFace },
			});

			const css = emitted.get('webfonts.css') as string;

			expect(css.match(/@font-face/g)).length(1);
			expect(css).contain('url(/assets/lobster.woff2)');
			expect(css).contain('url(/assets/lobster.woff)');
		});

		it('should self-host the rule when `subsetsAllowed` is set', async () => {
			const { plugin, emitted, run } = setup(googleCssUrl, { subsetsAllowed: ['latin'] });

			plugin.transformIndexHtml(html, { path: '/index.html' });

			const bundle = await run({
				'index.html': { source: html },
				'assets/index.css': { source: userCss },
			});

			const source = bundle['index.html'].source as string;

			// the user's rule has no subset comment, it must survive the filtering
			expect(source).contain('url(/assets/lobster.woff2)');
			expect(source).contain('url(/assets/inter-latin.woff2)');
			expect(source).not.contain('inter-cyrillic');
			expect([...emitted.keys()].sort()).members(['inter-latin.woff2', 'lobster.woff2']);
		});

		it('should leave @font-face rules of unknown hosts untouched', async () => {
			const ownCss = '@font-face{font-family:Own;src:url(https://example.com/own.woff2)}body{color:red}';
			const { emitted, run } = setup();

			const bundle = await run({
				'assets/app.css': { source: ownCss },
			});

			expect(bundle['assets/app.css'].source).eq(ownCss);
			expect(emitted.size).eq(0);
			expect(download).not.toHaveBeenCalled();
		});

		it('should not carry fonts over to the next build (watch mode)', async () => {
			const { emitted, run } = setup();

			await run({ 'assets/app.css': { source: userCss } });

			expect(emitted.has('lobster.woff2')).eq(true);

			emitted.clear();

			await run({ 'assets/app.css': { source: 'body{color:red}' } });

			expect(emitted.size).eq(0);
		});
	});

	describe('html missing from the bundle', () => {
		// e.g. a secondary output of a multi-output build
		it('should keep the bundled css untouched when the css can not be injected', async () => {
			const css = `@import url('${googleCssUrl}');${userCss}`;
			const { plugin, emitted, run } = setup();

			plugin.transformIndexHtml(html, { path: '/index.html' });

			const bundle = await run({ 'assets/index.css': { source: css } });

			expect(bundle['assets/index.css'].source).eq(css);
			expect(emitted.has('webfonts.css')).eq(false);
		});

		it('should still move the rules when the css is saved as a file', async () => {
			const { plugin, emitted, run } = setup([], { injectAsStyleTag: false });

			plugin.transformIndexHtml(html, { path: '/index.html' });

			const bundle = await run({ 'assets/index.css': { source: userCss } });

			expect(bundle['assets/index.css'].source).eq('body{font-family:Inter}h1{font-family:Lobster}');
			expect(emitted.get('webfonts.css')).contain('font-family:Lobster');
		});
	});

	describe('@import in bundled css', () => {
		it('should download the imported webfont css', async () => {
			const { plugin, emitted, run } = setup();

			plugin.transformIndexHtml(html, { path: '/index.html' });

			const bundle = await run({
				'index.html': { source: html },
				'assets/index.css': { source: `@import url('${googleCssUrl}');body{color:red}` },
			});

			expect(bundle['assets/index.css'].source).eq('body{color:red}');
			expect(bundle['index.html'].source).contain('url(/assets/inter-latin.woff2)');
			expect(bundle['index.html'].source).not.contain('@import');
			expect(emitted.has('inter-latin.woff2')).eq(true);
		});
	});

	describe('minifyCss default', () => {
		const build = async (options: Options, buildConfig: BuildConfig) => {
			const { emitted, run } = setup(googleCssUrl, options, buildConfig);

			await run({});

			return emitted.get('webfonts.css') as string;
		};

		it('should minify by default', async () => {
			expect(await build({}, {})).not.contain('\n');
		});

		it('should not minify when `build.minify` is false', async () => {
			const css = await build({}, { minify: false });

			expect(css).contain('\n');
			expect(css).contain('/* latin */');
		});

		it('should minify when `minifyCss` is explicitly true', async () => {
			expect(await build({ minifyCss: true }, { minify: false })).not.contain('\n');
		});

		it('should not minify when `minifyCss` is explicitly false', async () => {
			expect(await build({ minifyCss: false }, { minify: 'oxc' })).contain('\n');
		});
	});

	describe('ssr build', () => {
		it('should do nothing when `build.ssr` is set', async () => {
			const { emitted, run } = setup(googleCssUrl, {}, { ssr: 'src/entry-server.js' });

			const bundle = await run({ 'assets/app.css': { source: userCss } });

			expect(emitted.size).eq(0);
			expect(download).not.toHaveBeenCalled();
			expect(bundle['assets/app.css'].source).eq(userCss);
		});

		it('should do nothing in a server environment', async () => {
			const { emitted, run } = setup(googleCssUrl);

			await run({}, { environment: { config: { consumer: 'server' } } });

			expect(emitted.size).eq(0);
			expect(download).not.toHaveBeenCalled();
		});

		it('should run in a client environment', async () => {
			const { emitted, run } = setup(googleCssUrl, {}, { ssr: true });

			// the environment is more specific than `build.ssr`
			await run({}, { environment: { config: { consumer: 'client' } } });

			expect(emitted.has('webfonts.css')).eq(true);
			expect(emitted.has('inter-latin.woff2')).eq(true);
		});
	});

	describe('download errors', () => {
		const missingUrl = 'https://fonts.googleapis.com/css2?family=Missing';

		it('should continue the build by default', async () => {
			const { emitted, run } = setup(missingUrl);

			await expect(run({})).resolves.toBeDefined();
			expect(emitted.size).eq(0);
		});

		it('should keep the original bundled css when the download fails', async () => {
			const css = `@import url('${missingUrl}');${userCss}`;
			const { emitted, run } = setup();

			const bundle = await run({ 'assets/app.css': { source: css } });

			// the fonts keep loading from the provider instead of disappearing
			expect(bundle['assets/app.css'].source).eq(css);
			expect(emitted.has('webfonts.css')).eq(false);
		});

		it('should fail the build when `throwError` is set', async () => {
			const { run } = setup(missingUrl, { throwError: true });

			await expect(run({})).rejects.toThrow(/404/);
		});
	});
});

describe('dev server middleware', () => {
	const createResponse = () => {
		const headers: Record<string, string> = {};

		const response = {
			statusCode: 200,
			body: undefined as unknown,
			ended: false,
			setHeader: (name: string, value: string) => {
				headers[name] = value;
			},
			end: (body?: unknown) => {
				response.body = body;
				response.ended = true;
			},
		};

		return { response, headers };
	};

	const createWebfontDl = async () => {
		const webfontDl = new WebfontDownload(googleCssUrl, { cache: false });

		webfontDl.setIsDevServer(true);
		webfontDl.setAssetsDir('@webfonts');

		await webfontDl.loadDevServerFonts();

		return webfontDl;
	};

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should serve a font', async () => {
		vi.spyOn(Downloader.prototype, 'download').mockImplementation((url: string) =>
			Promise.resolve({ data: url === googleCssUrl ? googleCss : Buffer.from('font') }) as never
		);

		const webfontDl = await createWebfontDl();
		const { response, headers } = createResponse();
		const next = vi.fn();

		await webfontDl.getDevServerMiddlewareGeneral(
			{ originalUrl: '/@webfonts/inter-latin.woff2?v=1' } as Connect.IncomingMessage,
			response as unknown as ServerResponse,
			next,
		);

		expect(response.statusCode).eq(200);
		expect(headers['Content-Type']).eq('font/woff2');
		expect((response.body as Buffer).toString()).eq('font');
		expect(next).not.toHaveBeenCalled();
	});

	it('should pass on unknown urls', async () => {
		vi.spyOn(Downloader.prototype, 'download').mockImplementation(() =>
			Promise.resolve({ data: googleCss }) as never
		);

		const webfontDl = await createWebfontDl();
		const { response } = createResponse();
		const next = vi.fn();

		await webfontDl.getDevServerMiddlewareGeneral(
			{ originalUrl: '/src/main.js' } as Connect.IncomingMessage,
			response as unknown as ServerResponse,
			next,
		);

		expect(next).toHaveBeenCalledOnce();
		expect(response.ended).eq(false);
	});

	it('should respond with 502 instead of crashing when a font download fails', async () => {
		vi.spyOn(Downloader.prototype, 'download').mockImplementation((url: string) =>
			url === googleCssUrl ?
				Promise.resolve({ data: googleCss }) as never :
				Promise.reject(new Error('connect ECONNREFUSED')) as never
		);

		const webfontDl = await createWebfontDl();
		const { response, headers } = createResponse();
		const next = vi.fn();

		await expect(
			webfontDl.getDevServerMiddlewareGeneral(
				{ originalUrl: '/@webfonts/inter-latin.woff2' } as Connect.IncomingMessage,
				response as unknown as ServerResponse,
				next,
			)
		).resolves.toBeUndefined();

		expect(response.statusCode).eq(502);
		expect(headers['X-Error']).eq('connect ECONNREFUSED');
		expect(response.ended).eq(true);
		expect(next).not.toHaveBeenCalled();
	});

	it('should send a valid header value for any error message', async () => {
		vi.spyOn(Downloader.prototype, 'download').mockImplementation((url: string) =>
			url === googleCssUrl ?
				Promise.resolve({ data: googleCss }) as never :
				Promise.reject(new Error('Error: első sor\nsecond line\u0000')) as never
		);

		const webfontDl = await createWebfontDl();
		const { response, headers } = createResponse();

		await webfontDl.getDevServerMiddlewareGeneral(
			{ originalUrl: '/@webfonts/inter-latin.woff2' } as Connect.IncomingMessage,
			response as unknown as ServerResponse,
			vi.fn(),
		);

		expect(response.statusCode).eq(502);
		expect(headers['X-Error']).eq('els  sor second line');
		expect(() => new Headers({ 'X-Error': headers['X-Error'] })).not.toThrow();
	});

	it('should respond with 502 when the webfont css can not be downloaded', async () => {
		vi.spyOn(Downloader.prototype, 'download').mockImplementation(() =>
			Promise.reject(new Error('timeout of 2500ms exceeded\n')) as never
		);

		const webfontDl = new WebfontDownload(googleCssUrl, { cache: false });
		const { response, headers } = createResponse();

		webfontDl.setIsDevServer(true);
		webfontDl.setAssetsDir('@webfonts');

		await expect(
			webfontDl.getDevServerMiddlewareCss(response as unknown as ServerResponse)
		).resolves.toBeUndefined();

		expect(response.statusCode).eq(502);
		expect(headers['X-Error']).eq('timeout of 2500ms exceeded');
	});
});
