import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Options } from '../types';
import { version } from '../../package.json';

type CacheType = 'css' | 'font';

/**
 * Persistent file cache, one file per downloaded css / font:
 *   <cacheDir>/webfont-dl/<plugin version>/<sha1 of the url>.<css|font>
 *
 * The cache is best effort, it must never break a build.
 */
export class FileCache {
	private enabled = true;
	private cacheDir = 'node_modules/.vite/cache';
	private prepared = false;

	private namespace = 'webfont-dl';

	// cache files of the flat-cache based versions (<= 3.13)
	private legacyFileRegex = /^plugin-webfont-dl_.+\.json$/;

	public hits = {
		css: 0,
		font: 0,
	};

	constructor(options: Required<Options>) {
		if (options.cache === false) {
			this.enabled = false;
		}
	}

	setCacheDir(cacheDir: string) {
		if (this.cacheDir !== cacheDir) {
			this.cacheDir = cacheDir;
			this.prepared = false;
		}
	}

	get(type: 'css', url: string): string | undefined;
	get(type: 'font', url: string): Buffer | undefined;
	get(type: CacheType, url: string): string | Buffer | undefined {
		this.prepare();

		if (!this.enabled) {
			return;
		}

		let data: Buffer;

		try {
			data = readFileSync(this.getPath(type, url));
		} catch {
			return;
		}

		// an empty file is a leftover of an interrupted write
		if (!data.length) {
			return;
		}

		this.hits[type]++;

		return type === 'css' ? data.toString('utf8') : data;
	}

	save(type: CacheType, url: string, data: string | Buffer): void {
		this.prepare();

		if (!this.enabled || !data.length) {
			return;
		}

		const path = this.getPath(type, url);
		const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;

		try {
			mkdirSync(this.getVersionDir(), { recursive: true });

			// write + rename, so a parallel build never reads a half-written file
			writeFileSync(tempPath, data);
			renameSync(tempPath, path);
		} catch {
			this.remove(tempPath);
		}
	}

	resetHits(type: CacheType) {
		this.hits[type] = 0;
	}

	/**
	 * Deletes the whole cache (every version).
	 */
	clear() {
		this.remove(this.getRootDir());
		this.removeLegacyFiles();
	}

	/**
	 * Runs once per cache directory:
	 * deletes the cache when it is disabled, removes the leftovers of other versions otherwise.
	 */
	private prepare() {
		if (this.prepared) {
			return;
		}

		this.prepared = true;

		if (!this.enabled) {
			this.clear();

			return;
		}

		this.removeLegacyFiles();

		for (const entry of this.list(this.getRootDir())) {
			if (entry !== version) {
				this.remove(join(this.getRootDir(), entry));
			}
		}
	}

	private removeLegacyFiles() {
		for (const entry of this.list(this.cacheDir)) {
			if (this.legacyFileRegex.test(entry)) {
				this.remove(join(this.cacheDir, entry));
			}
		}
	}

	private getRootDir(): string {
		return join(this.cacheDir, this.namespace);
	}

	private getVersionDir(): string {
		return join(this.getRootDir(), version);
	}

	private getPath(type: CacheType, url: string): string {
		return join(
			this.getVersionDir(),
			createHash('sha1').update(url).digest('hex') + '.' + type
		);
	}

	private list(dir: string): string[] {
		try {
			return readdirSync(dir);
		} catch {
			return [];
		}
	}

	private remove(path: string) {
		try {
			rmSync(path, { recursive: true, force: true });
		} catch {
			// best effort
		}
	}
}
