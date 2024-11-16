import { Buffer } from 'node:buffer';
import { create as cacheCreate, clearCacheById, type FlatCache } from 'flat-cache';
import { Options } from './types';
import { version } from '../package.json';

interface BufferJson {
	type: 'Buffer';
	data: number[];
}
type FileData = string | Buffer | BufferJson;

export class FileCache {
	private enabled = true;
	private cacheID = `plugin-webfont-dl_${version}.json`;
	private cache: FlatCache;

	public hits = {
		css: 0,
		font: 0,
	};

	constructor(options: Options) {
		if (options.cache === false) {
			this.enabled = false;
		}

		this.cache = cacheCreate({
			cacheId: this.cacheID,
			cacheDir: 'node_modules/.vite/cache',
		});

		if (!this.enabled) {
			this.clear();
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
