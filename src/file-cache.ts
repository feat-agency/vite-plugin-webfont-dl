/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { resolve } from 'path';
import cache, { Cache } from 'flat-cache';
import { Options } from './types';

export class FileCache {
	private cacheID = 'vite-plugin-webfont-dl';
	private store: Cache;
	private enabled = true;

	public count = {
		css: 0,
		font: 0,
	};
	public hits = {
		css: 0,
		font: 0,
	};

	constructor(options: Options) {
		if (options.cache === false) {
			this.enabled = false;
		}

		this.store = cache.create(
			this.cacheID,
			resolve(__dirname, '../.cache/')
		);

		if (!this.enabled) {
			this.clear();
		}

		Object.keys(this.all()).forEach((key) => {
			if (key.startsWith('css::')) {
				this.count.css++;
			} else if (key.startsWith('font::')) {
				this.count.font++;
			}
		});
	}

	get(type: 'css' | 'font', url: string): Buffer | string | undefined {
		if (!this.enabled) {
			return;
		}

		const key = `${type}::${url}`;
		const cachedFile = this.store.getKey(key);

		if (cachedFile) {
			if (type === 'css') {
				this.hits.css++;
			} else {
				this.hits.font++;
			}

			if (cachedFile.type !== undefined) {
				return Buffer.from(cachedFile.data);
			}

			return cachedFile as string;
		}
	}

	save(type: 'css' | 'font', url: string, data: Buffer | string): void {
		if (!this.enabled) {
			return;
		}

		const key = `${type}::${url}`;

		if (!this.store.getKey(key)) {
			if (type === 'css') {
				this.count.css++;
			} else {
				this.count.font++;
			}
		}

		this.store.setKey(key, data);
		this.store.save(true);
	}

	all() {
		return this.store.all();
	}

	clear() {
		cache.clearCacheById(this.cacheID);
	}
}

