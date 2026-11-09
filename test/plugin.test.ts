import { AxiosError, type AxiosResponse } from 'axios';
import { mkdtempSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

// the server answered with an error status
const httpError = (status: number) => new AxiosError(
	`Request failed with status code ${status}`,
	'ERR_BAD_REQUEST',
	undefined,
	undefined,
	{ status } as AxiosResponse,
);

const cacheDir = mkdtempSync(join(tmpdir(), 'webfont-dl-test-'));

const setup = (
	webfontUrls: string | string[] = [],
	options: Options = {},
	build: BuildConfig = {},
	base = '/',
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
		base,
		cacheDir,
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

	describe('refused files (http errors)', () => {
		const refusedCssUrl = 'https://fonts.googleapis.com/css2?family=Refused';

		const htmlWithLinks = `<!doctype html>
<html>
	<head>
		<link rel="preconnect" href="https://fonts.googleapis.com">
		<link href="${googleCssUrl}" rel="stylesheet">
		<link href="${refusedCssUrl}" rel="stylesheet">
	</head>
	<body></body>
</html>
`;

		beforeEach(() => {
			download.mockImplementation((url: string) => {
				if (url === googleCssUrl) {
					return Promise.resolve({ data: googleCss }) as never;
				}

				if (url === refusedCssUrl || url === interCyrillicUrl) {
					return Promise.reject(httpError(404)) as never;
				}

				return Promise.resolve({ data: Buffer.from('font:' + url) }) as never;
			});
		});

		it('should self-host the other webfont css and keep the refused one on the provider', async () => {
			const { plugin, emitted, run } = setup([], { subsetsAllowed: ['latin'] });

			plugin.transformIndexHtml(htmlWithLinks, { path: '/index.html' });

			const bundle = await run({ 'index.html': { source: htmlWithLinks } });
			const source = bundle['index.html'].source as string;

			expect(source).contain('url(/assets/inter-latin.woff2)');
			expect(source).not.contain(`<link href="${googleCssUrl}"`);
			expect(emitted.has('inter-latin.woff2')).eq(true);

			// the refused tag stays, with its preconnect hint
			expect(source).contain(`<link href="${refusedCssUrl}" rel="stylesheet">`);
			expect(source).contain('<link rel="preconnect" href="https://fonts.googleapis.com">');
		});

		it('should remove the preconnect hints when the refused url is not in the html', async () => {
			const page = htmlWithLinks.replace(`\t\t<link href="${refusedCssUrl}" rel="stylesheet">\n`, '');
			const { plugin, run } = setup(refusedCssUrl, { subsetsAllowed: ['latin'] });

			plugin.transformIndexHtml(page, { path: '/index.html' });

			const bundle = await run({ 'index.html': { source: page } });
			const source = bundle['index.html'].source as string;

			expect(source).contain('url(/assets/inter-latin.woff2)');
			expect(source).not.contain('preconnect');
			expect(source).not.contain('fonts.googleapis.com');
		});

		it('should keep the @import of a refused url in the bundled css', async () => {
			const css = `@import url('${refusedCssUrl}');@import url('${googleCssUrl}');body{color:red}`;
			const { plugin, run } = setup([], { subsetsAllowed: ['latin'] });

			plugin.transformIndexHtml(html, { path: '/index.html' });

			const bundle = await run({
				'index.html': { source: html },
				'assets/index.css': { source: css },
			});

			expect(bundle['assets/index.css'].source).eq(`@import url('${refusedCssUrl}');body{color:red}`);
			expect(bundle['index.html'].source).contain('url(/assets/inter-latin.woff2)');
		});

		it('should keep a refused font on the provider', async () => {
			const { plugin, emitted, run } = setup(googleCssUrl);

			plugin.transformIndexHtml(html, { path: '/index.html' });

			const bundle = await run({ 'index.html': { source: html } });
			const source = bundle['index.html'].source as string;

			expect(source).contain('url(/assets/inter-latin.woff2)');
			expect(source).contain(`url(${interCyrillicUrl})`);
			expect([...emitted.keys()]).deep.eq(['inter-latin.woff2']);
		});

		it('should change nothing when every webfont css is refused', async () => {
			const page = htmlWithLinks.replace(`\t\t<link href="${googleCssUrl}" rel="stylesheet">\n`, '');
			const css = `@import url('${refusedCssUrl}');body{color:red}`;
			const { plugin, emitted, run } = setup(refusedCssUrl);

			plugin.transformIndexHtml(page, { path: '/index.html' });

			const bundle = await run({
				'index.html': { source: page },
				'assets/index.css': { source: css },
			});

			expect(bundle['index.html'].source).eq(page);
			expect(bundle['assets/index.css'].source).eq(css);
			expect(emitted.size).eq(0);
		});

		it('should fail the build when `throwError` is set', async () => {
			const { run } = setup([googleCssUrl, refusedCssUrl], { throwError: true });

			await expect(run({})).rejects.toThrow(/404/);
		});

		it('should fail the build on a refused font when `throwError` is set', async () => {
			const { run } = setup(googleCssUrl, { throwError: true });

			await expect(run({})).rejects.toThrow(/404/);
		});

		it('should treat server errors (5xx) and rate limits like network errors', async () => {
			for (const status of [500, 503, 429, 408]) {
				download.mockImplementation((url: string) => {
					if (url === googleCssUrl) {
						return Promise.resolve({ data: googleCss }) as never;
					}

					return Promise.reject(httpError(status)) as never;
				});

				const { plugin, emitted, run } = setup(googleCssUrl);

				plugin.transformIndexHtml(html, { path: '/index.html' });

				const bundle = await run({ 'index.html': { source: html } });

				// all or nothing, as before
				expect(bundle['index.html'].source, `status ${status}`).eq(html);
				expect(emitted.has('webfonts.css')).eq(false);
			}
		});
	});

	describe('network errors', () => {
		it('should change nothing when a font can not be reached', async () => {
			download.mockImplementation((url: string) => {
				if (url === googleCssUrl) {
					return Promise.resolve({ data: googleCss }) as never;
				}

				return Promise.reject(new AxiosError('timeout of 2500ms exceeded', 'ECONNABORTED')) as never;
			});

			const page = html.replace('</head>', `<link href="${googleCssUrl}" rel="stylesheet">\n\t</head>`);
			const { plugin, emitted, run } = setup();

			plugin.transformIndexHtml(page, { path: '/index.html' });

			const bundle = await run({
				'index.html': { source: page },
				'assets/index.css': { source: userCss },
			});

			expect(bundle['index.html'].source).eq(page);
			expect(bundle['assets/index.css'].source).eq(userCss);
			expect(emitted.has('webfonts.css')).eq(false);
		});
	});

	describe('fontDefinitionsInCss', () => {
		const minifiedLatin = `@font-face{font-family:Inter;src:url(/assets/inter-latin.woff2) format('woff2')}`;
		const minifiedCyrillic = `@font-face{font-family:Inter;src:url(/assets/inter-cyrillic.woff2) format('woff2')}`;

		it('should replace an @import with the self-hosted webfont css', async () => {
			const { plugin, emitted, run } = setup([], { fontDefinitionsInCss: true });

			plugin.transformIndexHtml(html, { path: '/index.html' });

			const bundle = await run({
				'index.html': { source: html },
				'assets/index.css': { source: `@import url('${googleCssUrl}');body{color:red}` },
			});

			expect(bundle['assets/index.css'].source).eq(`body{color:red}${minifiedCyrillic}${minifiedLatin}`);

			// nothing is injected or saved elsewhere
			expect(bundle['index.html'].source).eq(html);
			expect(emitted.has('webfonts.css')).eq(false);
			expect([...emitted.keys()].sort()).deep.eq(['inter-cyrillic.woff2', 'inter-latin.woff2']);
		});

		it('should not read `$` in the css as a replacement pattern', async () => {
			const fontFace = `@font-face{font-family:"$&$1$$";src:url(${lobsterUrl})}`;
			const { run } = setup([], { fontDefinitionsInCss: true });

			const bundle = await run({ 'assets/app.css': { source: fontFace + 'body{color:red}' } });

			expect(bundle['assets/app.css'].source).eq(
				'@font-face{font-family:"$&$1$$";src:url(/assets/lobster.woff2)}body{color:red}'
			);
		});

		it('should self-host a @font-face rule where it is', async () => {
			const { emitted, run } = setup([], { fontDefinitionsInCss: true });

			const bundle = await run({ 'assets/app.css': { source: userCss } });

			expect(bundle['assets/app.css'].source).eq(
				'@font-face{font-family:Lobster;src:url(/assets/lobster.woff2)format("woff2")}body{font-family:Inter}h1{font-family:Lobster}'
			);
			expect([...emitted.keys()]).deep.eq(['lobster.woff2']);
		});

		it('should work without any html file', async () => {
			const { emitted, run } = setup([], { fontDefinitionsInCss: true });

			const bundle = await run({
				'assets/app.css': { source: `@import"${googleCssUrl}";${userCss}` },
			});

			const source = bundle['assets/app.css'].source as string;

			expect(source).not.contain('@import');
			expect(source).not.contain('fonts.gstatic.com');
			expect(source).contain('url(/assets/lobster.woff2)');
			expect(source).contain(minifiedLatin);
			expect(emitted.has('webfonts.css')).eq(false);
		});

		it('should keep the remaining @import statements at the top', async () => {
			const { run } = setup([], { fontDefinitionsInCss: true });

			const bundle = await run({
				'assets/app.css': {
					source: `@import url('${googleCssUrl}');@import url('https://example.com/other.css');body{color:red}`,
				},
			});

			expect(bundle['assets/app.css'].source).eq(
				`@import url('https://example.com/other.css');body{color:red}${minifiedCyrillic}${minifiedLatin}`
			);
		});

		it('should use relative urls with a relative base', async () => {
			const { run } = setup([], { fontDefinitionsInCss: true }, {}, './');

			const bundle = await run({
				'assets/app.css': { source: userCss },
				'style.css': { source: userCss },
				'assets/nested/deep.css': { source: userCss },
			});

			expect(bundle['assets/app.css'].source).contain('url(lobster.woff2)');
			expect(bundle['style.css'].source).contain('url(assets/lobster.woff2)');
			expect(bundle['assets/nested/deep.css'].source).contain('url(../lobster.woff2)');
		});

		it('should prefix absolute urls with the base', async () => {
			const { run } = setup([], { fontDefinitionsInCss: true }, {}, '/app/');

			const bundle = await run({ 'assets/app.css': { source: userCss } });

			expect(bundle['assets/app.css'].source).contain('url(/app/assets/lobster.woff2)');
		});

		it('should respect `assetsSubfolder`', async () => {
			const { run } = setup([], { fontDefinitionsInCss: true, assetsSubfolder: 'fonts' }, {}, './');

			const bundle = await run({ 'assets/app.css': { source: userCss } });

			expect(bundle['assets/app.css'].source).contain('url(fonts/lobster.woff2)');
		});

		it('should embed fonts', async () => {
			const { emitted, run } = setup([], { fontDefinitionsInCss: true, embedFonts: true });

			const bundle = await run({
				'assets/app.css': { source: `@import url('${googleCssUrl}');${userCss}` },
			});

			const source = bundle['assets/app.css'].source as string;

			expect(source.match(/url\(data:font\/woff2;base64,/g)).length(3);
			expect(source).not.contain('fonts.gstatic.com');
			expect(emitted.size).eq(0);
		});

		it('should filter subsets', async () => {
			const { emitted, run } = setup([], { fontDefinitionsInCss: true, subsetsAllowed: ['latin'] });

			const bundle = await run({
				'assets/app.css': { source: `@import url('${googleCssUrl}');${userCss}` },
			});

			const source = bundle['assets/app.css'].source as string;

			expect(source).contain(minifiedLatin);
			expect(source).not.contain('cyrillic');
			expect(source).contain('url(/assets/lobster.woff2)');
			expect([...emitted.keys()].sort()).deep.eq(['inter-latin.woff2', 'lobster.woff2']);
		});

		it('should not minify when minification is off', async () => {
			const { run } = setup([], { fontDefinitionsInCss: true }, { minify: false });

			const bundle = await run({
				'assets/app.css': { source: `@import url('${googleCssUrl}');\nbody {\n  color: red;\n}\n` },
			});

			expect(bundle['assets/app.css'].source).eq(
				'\nbody {\n  color: red;\n}\n' +
				googleCss.replace(interCyrillicUrl, '/assets/inter-cyrillic.woff2').replace(interLatinUrl, '/assets/inter-latin.woff2') +
				'\n'
			);
		});

		it('should handle the same @import in several css files', async () => {
			const css = `@import url('${googleCssUrl}');body{color:red}`;
			const { run } = setup([], { fontDefinitionsInCss: true });

			const bundle = await run({
				'assets/a.css': { source: css },
				'assets/b.css': { source: css },
			});

			expect(bundle['assets/a.css'].source).eq(`body{color:red}${minifiedCyrillic}${minifiedLatin}`);
			expect(bundle['assets/b.css'].source).eq(bundle['assets/a.css'].source);
		});

		it('should add a repeated @import only once', async () => {
			const { run } = setup([], { fontDefinitionsInCss: true });

			const bundle = await run({
				'assets/a.css': { source: `@import url('${googleCssUrl}');@import"${googleCssUrl}";body{color:red}` },
			});

			expect(bundle['assets/a.css'].source).eq(`body{color:red}${minifiedCyrillic}${minifiedLatin}`);
		});

		it('should leave a refused @import untouched', async () => {
			const refusedCssUrl = 'https://fonts.googleapis.com/css2?family=Refused';

			download.mockImplementation((url: string) => {
				if (url === googleCssUrl) {
					return Promise.resolve({ data: googleCss }) as never;
				}

				if (url === refusedCssUrl) {
					return Promise.reject(httpError(400)) as never;
				}

				return Promise.resolve({ data: Buffer.from('font:' + url) }) as never;
			});

			const { run } = setup([], { fontDefinitionsInCss: true });

			const bundle = await run({
				'assets/app.css': {
					source: `@import url('${refusedCssUrl}');@import url('${googleCssUrl}');body{color:red}`,
				},
			});

			expect(bundle['assets/app.css'].source).eq(
				`@import url('${refusedCssUrl}');body{color:red}${minifiedCyrillic}${minifiedLatin}`
			);
		});

		it('should leave the css untouched when the download fails', async () => {
			const css = `@import url('https://fonts.googleapis.com/css2?family=Missing');${userCss}`;
			const { emitted, run } = setup([], { fontDefinitionsInCss: true });

			const bundle = await run({ 'assets/app.css': { source: css } });

			expect(bundle['assets/app.css'].source).eq(css);
			expect(emitted.has('webfonts.css')).eq(false);
		});

		it('should still inject the fonts of html tags and plugin config into the html', async () => {
			const lobsterCssUrl = 'https://fonts.googleapis.com/css2?family=Lobster';

			download.mockImplementation((url: string) => {
				if (url === googleCssUrl) {
					return Promise.resolve({ data: googleCss }) as never;
				}

				if (url === lobsterCssUrl) {
					return Promise.resolve({ data: `/* latin */\n@font-face {\n  font-family: 'Lobster';\n  src: url(${lobsterUrl}) format('woff2');\n}` }) as never;
				}

				return Promise.resolve({ data: Buffer.from('font:' + url) }) as never;
			});

			const { plugin, emitted, run } = setup(lobsterCssUrl, { fontDefinitionsInCss: true, subsetsAllowed: ['latin'] });

			plugin.transformIndexHtml(html, { path: '/index.html' });

			const bundle = await run({
				'index.html': { source: html },
				'assets/index.css': { source: `@import url('${googleCssUrl}');body{color:red}` },
			});

			// config url -> html
			expect(bundle['index.html'].source).contain('url(/assets/lobster.woff2)');
			expect(bundle['index.html'].source).not.contain('inter-latin');

			// @import -> stays in the css file
			expect(bundle['assets/index.css'].source).eq(`body{color:red}${minifiedLatin}`);
			expect([...emitted.keys()].sort()).deep.eq(['inter-latin.woff2', 'lobster.woff2']);
		});

		it('should save the fonts of the plugin config to webfonts.css when there is no html', async () => {
			const { emitted, run } = setup(googleCssUrl, { fontDefinitionsInCss: true, subsetsAllowed: ['latin'] });

			const bundle = await run({ 'assets/app.css': { source: userCss } });

			expect(emitted.get('webfonts.css')).eq(minifiedLatin);
			expect(bundle['assets/app.css'].source).contain('url(/assets/lobster.woff2)');
		});
	});

	describe('deterministic output', () => {
		const page = (url: string) => html.replace('</head>', `<link href="${url}" rel="stylesheet">\n\t</head>`);
		const lobsterCssUrl = 'https://fonts.googleapis.com/css2?family=Lobster';

		const build = async (order: string[]) => {
			download.mockImplementation((url: string) => {
				if (url === googleCssUrl) {
					return Promise.resolve({ data: googleCss }) as never;
				}

				if (url === lobsterCssUrl) {
					return Promise.resolve({ data: `@font-face {\n  font-family: 'Lobster';\n  src: url(${lobsterUrl});\n}` }) as never;
				}

				return Promise.resolve({ data: Buffer.from('font:' + url) }) as never;
			});

			const pages: Record<string, string> = {
				'index.html': page(googleCssUrl),
				'about/index.html': page(lobsterCssUrl),
			};

			const { plugin, emitted, run } = setup();

			// Vite transforms the html files in an arbitrary order
			order.forEach((path) => plugin.transformIndexHtml(pages[path], { path: '/' + path }));

			const bundle = await run({
				'index.html': { source: pages['index.html'] },
				'about/index.html': { source: pages['about/index.html'] },
			});

			return { html: bundle['index.html'].source as string, emitted: [...emitted.keys()] };
		};

		it('should not depend on the order the html files are transformed in', async () => {
			const first = await build(['index.html', 'about/index.html']);
			const second = await build(['about/index.html', 'index.html']);

			expect(first.html).eq(second.html);
			expect(first.emitted).deep.eq(second.emitted);
		});
	});

	describe('parallel downloads', () => {
		const fontUrls = Array.from({ length: 20 }, (_, index) => `https://fonts.gstatic.com/s/test/v1/font-${index}.woff2`);
		const manyFontsCss = fontUrls.map((url, index) => `@font-face{font-family:Test${index};src:url(${url})}`).join('\n');

		it('should download in parallel, with a limit, and emit in the css order', async () => {
			let running = 0;
			let maxRunning = 0;

			download.mockImplementation(async (url: string) => {
				if (url === googleCssUrl) {
					return { data: manyFontsCss } as never;
				}

				running++;
				maxRunning = Math.max(maxRunning, running);

				// later fonts finish first
				await new Promise((resolve) => setTimeout(resolve, 20 - fontUrls.indexOf(url)));

				running--;

				return { data: Buffer.from('font:' + url) } as never;
			});

			const { emitted, run } = setup(googleCssUrl);

			await run({});

			expect(maxRunning).greaterThan(1);
			expect(maxRunning).lessThanOrEqual(6);

			expect([...emitted.keys()]).deep.eq([
				...fontUrls.map((url) => url.replace(/^.*\//, '')),
				'webfonts.css',
			]);
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

	it('should send the right content type for every font format', async () => {
		const css = [
			'https://fonts.gstatic.com/s/x/icons.svg',
			'https://fonts.gstatic.com/s/x/legacy.eot',
			'https://fonts.gstatic.com/s/x/plain.ttf',
			'https://fonts.gstatic.com/s/x/modern.woff2',
		].map((url, index) => `@font-face{font-family:F${index};src:url(${url})}`).join('\n');

		vi.spyOn(Downloader.prototype, 'download').mockImplementation((url: string) =>
			Promise.resolve({ data: url === googleCssUrl ? css : Buffer.from('font') }) as never
		);

		const webfontDl = await createWebfontDl();

		const contentType = async (path: string) => {
			const { response, headers } = createResponse();

			await webfontDl.getDevServerMiddlewareGeneral(
				{ originalUrl: path } as Connect.IncomingMessage,
				response as unknown as ServerResponse,
				vi.fn(),
			);

			return headers['Content-Type'];
		};

		expect(await contentType('/@webfonts/icons.svg')).eq('image/svg+xml');
		expect(await contentType('/@webfonts/legacy.eot')).eq('application/vnd.ms-fontobject');
		expect(await contentType('/@webfonts/plain.ttf')).eq('font/ttf');
		expect(await contentType('/@webfonts/modern.woff2?v=1')).eq('font/woff2');
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
