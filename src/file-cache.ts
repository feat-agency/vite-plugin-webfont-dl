/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { create as cacheCreate, clearCacheById, type FlatCache } from 'flat-cache';
import { Options } from './types';
import { version } from '../package.json';

type FileData = string | Buffer;

export class FileCache {
	private enabled = true;
	private storeCssId = `vite-plugin-webfont-dl__${version}__css`;
	private storeCss: FlatCache;
	private storeFontId = `vite-plugin-webfont-dl__${version}__font`;
	private storeFont: FlatCache;

	public hits = {
		css: 0,
		font: 0,
	};

	constructor(options: Options) {
		if (options.cache === false) {
			this.enabled = false;
		}

		this.storeCss = cacheCreate({ cacheId: this.storeCssId });
		this.storeFont = cacheCreate({ cacheId: this.storeFontId });

		if (!this.enabled) {
			this.clear();
		}
	}

	get(type: 'css' | 'font', url: string): FileData | undefined {
		if (!this.enabled) {
			return;
		}

		const cachedFile = type === 'css' ?
			this.storeCss.getKey<any>(url) :
			this.storeFont.getKey<any>(url);

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

	save(type: 'css' | 'font', url: string, data: FileData): void {
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
		clearCacheById(this.storeCssId);
		clearCacheById(this.storeFontId);
	}
}
