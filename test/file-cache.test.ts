import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileCache, getResolvedOptions } from 'src/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { version } from '../package.json';

describe('file cache', () => {
	let cacheDir: string;

	const createCache = (cache = true, dir = cacheDir) => {
		const fileCache = new FileCache(getResolvedOptions({ cache }));

		fileCache.setCacheDir(dir);

		return fileCache;
	};

	const cacheFiles = () => {
		const versionDir = join(cacheDir, 'webfont-dl', version);

		return existsSync(versionDir) ? readdirSync(versionDir) : [];
	};

	beforeEach(() => {
		cacheDir = mkdtempSync(join(tmpdir(), 'webfont-dl-test-'));
	});

	afterEach(() => {
		rmSync(cacheDir, { recursive: true, force: true });
	});

	it('should return nothing for an unknown url', () => {
		const fileCache = createCache();

		expect(fileCache.get('css', 'https://example.com/a.css')).eq(undefined);
		expect(fileCache.get('font', 'https://example.com/a.woff2')).eq(undefined);
		expect(fileCache.hits).deep.eq({ css: 0, font: 0 });
	});

	it('should store css as a string', () => {
		const css = '@font-face{font-family:"Ő";src:url(https://example.com/a.woff2)}';
		const fileCache = createCache();

		fileCache.save('css', 'https://example.com/a.css', css);

		expect(fileCache.get('css', 'https://example.com/a.css')).eq(css);
		expect(fileCache.hits.css).eq(1);
	});

	it('should store fonts as binary, byte for byte', () => {
		const font = Buffer.from(Array.from({ length: 4096 }, (_, index) => index % 256));
		const fileCache = createCache();

		fileCache.save('font', 'https://example.com/a.woff2', font);

		const cached = fileCache.get('font', 'https://example.com/a.woff2');

		expect(Buffer.isBuffer(cached)).eq(true);
		expect(cached?.equals(font)).eq(true);
		expect(fileCache.hits.font).eq(1);

		// one file per entry, the same size as the font (no json / base64 overhead)
		const files = cacheFiles();

		expect(files).length(1);
		expect(statSync(join(cacheDir, 'webfont-dl', version, files[0])).size).eq(font.length);
	});

	it('should keep css and font entries of the same url apart', () => {
		const fileCache = createCache();

		fileCache.save('css', 'https://example.com/a', 'css');
		fileCache.save('font', 'https://example.com/a', Buffer.from('font'));

		expect(fileCache.get('css', 'https://example.com/a')).eq('css');
		expect(fileCache.get('font', 'https://example.com/a')?.toString()).eq('font');
	});

	it('should be shared between instances (persistent)', () => {
		createCache().save('css', 'https://example.com/a.css', 'cached');

		expect(createCache().get('css', 'https://example.com/a.css')).eq('cached');
	});

	it('should leave no temporary files behind', () => {
		const fileCache = createCache();

		fileCache.save('css', 'https://example.com/a.css', 'a');
		fileCache.save('css', 'https://example.com/a.css', 'b');

		expect(cacheFiles().filter((file) => file.endsWith('.tmp'))).length(0);
		expect(fileCache.get('css', 'https://example.com/a.css')).eq('b');
	});

	it('should ignore empty data and empty files', () => {
		const fileCache = createCache();

		fileCache.save('css', 'https://example.com/empty.css', '');

		expect(cacheFiles()).length(0);

		fileCache.save('css', 'https://example.com/a.css', 'a');
		writeFileSync(join(cacheDir, 'webfont-dl', version, cacheFiles()[0]), '');

		expect(fileCache.get('css', 'https://example.com/a.css')).eq(undefined);
	});

	it('should reset the hit counters separately', () => {
		const fileCache = createCache();

		fileCache.save('css', 'a', 'a');
		fileCache.save('font', 'b', Buffer.from('b'));
		fileCache.get('css', 'a');
		fileCache.get('font', 'b');
		fileCache.resetHits('css');

		expect(fileCache.hits).deep.eq({ css: 0, font: 1 });
	});

	it('should follow a changed cache directory', () => {
		const otherDir = mkdtempSync(join(tmpdir(), 'webfont-dl-test-'));
		const fileCache = createCache();

		fileCache.save('css', 'a', 'first');
		fileCache.setCacheDir(otherDir);

		expect(fileCache.get('css', 'a')).eq(undefined);

		fileCache.save('css', 'a', 'second');
		fileCache.setCacheDir(cacheDir);

		expect(fileCache.get('css', 'a')).eq('first');

		rmSync(otherDir, { recursive: true, force: true });
	});

	describe('cache: false', () => {
		it('should not read or write', () => {
			const fileCache = createCache(false);

			fileCache.save('css', 'a', 'a');

			expect(fileCache.get('css', 'a')).eq(undefined);
			expect(cacheFiles()).length(0);
		});

		it('should delete the existing cache', () => {
			createCache().save('css', 'a', 'a');
			writeFileSync(join(cacheDir, 'plugin-webfont-dl_3.13.2.json'), '{}');
			writeFileSync(join(cacheDir, 'unrelated.json'), '{}');

			createCache(false).get('css', 'a');

			expect(existsSync(join(cacheDir, 'webfont-dl'))).eq(false);
			expect(existsSync(join(cacheDir, 'plugin-webfont-dl_3.13.2.json'))).eq(false);
			expect(existsSync(join(cacheDir, 'unrelated.json'))).eq(true);
		});
	});

	describe('housekeeping', () => {
		it('should remove the caches of other plugin versions', () => {
			const oldVersionDir = join(cacheDir, 'webfont-dl', '0.0.1');

			mkdirSync(oldVersionDir, { recursive: true });
			writeFileSync(join(oldVersionDir, 'old.font'), 'old');

			const fileCache = createCache();

			fileCache.save('css', 'a', 'a');

			expect(existsSync(oldVersionDir)).eq(false);
			expect(fileCache.get('css', 'a')).eq('a');
		});

		it('should remove the json cache files of the versions before 3.14', () => {
			writeFileSync(join(cacheDir, 'plugin-webfont-dl_3.13.2.json'), '{}');
			writeFileSync(join(cacheDir, 'plugin-webfont-dl_3.12.0.json'), '{}');
			mkdirSync(join(cacheDir, 'deps'));
			writeFileSync(join(cacheDir, 'deps', '_metadata.json'), '{}');

			createCache().get('css', 'a');

			expect(readdirSync(cacheDir).sort()).deep.eq(['deps']);
			expect(existsSync(join(cacheDir, 'deps', '_metadata.json'))).eq(true);
		});
	});

	describe('best effort', () => {
		it('should never throw when the cache directory is not usable', () => {
			// a file where the cache directory should be
			const blocked = join(cacheDir, 'blocked');

			writeFileSync(blocked, 'not a directory');

			const fileCache = createCache(true, blocked);

			expect(() => fileCache.save('css', 'a', 'a')).not.toThrow();
			expect(fileCache.get('css', 'a')).eq(undefined);
			expect(() => fileCache.clear()).not.toThrow();
		});

		it('should never throw when the cache directory does not exist', () => {
			const fileCache = createCache(true, join(cacheDir, 'missing', 'deep'));

			expect(fileCache.get('css', 'a')).eq(undefined);

			fileCache.save('css', 'a', 'a');

			expect(fileCache.get('css', 'a')).eq('a');
		});
	});
});
