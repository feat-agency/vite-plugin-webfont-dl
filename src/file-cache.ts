/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import cache, { Cache } from 'flat-cache';

export class FileCache {
	private store: Cache;
	public count = {
		css: 0,
		font: 0,
	};
	public hits = {
		css: 0,
		font: 0,
	};

	constructor() {
		this.store = cache.create('vite-plugin-webfont-dl');

		Object.keys(this.store.all()).forEach((key) => {
			if (key.startsWith('css::')) {
				this.count.css++;
			} else if (key.startsWith('font::')) {
				this.count.font++;
			}
		});
	}

	get(type: 'css' | 'font', url: string): Buffer | string | undefined {
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

			return cachedFile.data as string;
		}
	}

	save(type: 'css' | 'font', url: string, data: Buffer | string): void {
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

	clear() {
		cache.clearAll();
	}
}

