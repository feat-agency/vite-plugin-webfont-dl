/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import cache, { Cache } from 'flat-cache';
import { Options } from './types';
import { version } from '../package.json';

export class FileCache {
	private enabled = true;
	private storeCss: Cache;
	private storeFont: Cache;

	public hits = {
		css: 0,
		font: 0,
	};

	constructor(options: Required<Options>) {
		if (options.cache === false) {
			this.enabled = false;
		}

		this.storeCss = cache.create(`vite-plugin-webfont-dl__${version}__css`);
		this.storeFont = cache.create(`vite-plugin-webfont-dl__${version}__font`);

		if (!this.enabled) {
			this.clear();
		}
	}

	get(type: 'css' | 'font', url: string): Buffer | string | undefined {
		if (!this.enabled) {
			return;
		}

		const cachedFile = type === 'css' ?
			this.storeCss.getKey(url) :
			this.storeFont.getKey(url);

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

		if (type === 'css') {
			this.storeCss.setKey(url, data);
			this.storeCss.save(true);
		} else {
			this.storeFont.setKey(url, data);
			this.storeFont.save(true);
		}
	}

	clear() {
		cache.clearCacheById(`vite-plugin-webfont-dl__${version}__css`);
		cache.clearCacheById(`vite-plugin-webfont-dl__${version}__font`);
	}
}

