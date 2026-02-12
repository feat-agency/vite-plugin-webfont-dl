import { Buffer } from 'node:buffer';
import { create as cacheCreate, clearCacheById, type FlatCache } from 'flat-cache';
import { Options } from '../types';
import { version } from '../../package.json';

interface BufferJson {
	type: 'Buffer';
	data: number[];
}
type FileData = string | Buffer | BufferJson;

export class FileCache {
	private enabled = true;
	private cacheID = `plugin-webfont-dl_${version}.json`;
	private cache: FlatCache;
	private cacheDir = 'node_modules/.vite/cache';

	public hits = {
		css: 0,
		font: 0,
	};

	constructor(options: Required<Options>) {
		if (options.cache === false) {
			this.enabled = false;
		}

		this.cache = cacheCreate({
			cacheId: this.cacheID,
			cacheDir: this.cacheDir,
		});

		if (!this.enabled) {
			this.clear();
		}
	}

	setCacheDir(cacheDir: string) {
		// Only reinitialize if cache directory changes
		if (this.cacheDir !== cacheDir) {
			this.cacheDir = cacheDir;
			this.cache = cacheCreate({
				cacheId: this.cacheID,
				cacheDir: this.cacheDir,
			});
		}
	}

	get(type: 'css' | 'font', url: string): FileData | undefined {
		if (!this.enabled) {
			return;
		}

		const cachedFile = this.cache.get<FileData | undefined>(url);

		if (cachedFile) {
			if (type === 'css') {
				this.hits.css++;
			} else {
				this.hits.font++;
			}

			if ((cachedFile as BufferJson).type === 'Buffer') {
				return Buffer.from((cachedFile as BufferJson).data);
			}

			return cachedFile;
		}
	}

	save(type: 'css' | 'font', url: string, data: FileData): void {
		if (!this.enabled) {
			return;
		}

		this.cache.set(url, data);
		this.cache.save(true);
	}

	clear() {
		clearCacheById(this.cacheID);
	}
}
