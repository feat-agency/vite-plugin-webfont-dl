import axios from 'axios';
import { FileCache } from './file-cache';

export class FontLoader {
	constructor(private fileCache: FileCache) {}

	async load(url: string): Promise<Buffer> {
		const cachedFile = this.fileCache.get('font', url);

		if (cachedFile) {
			return cachedFile as Buffer;
		}

		const response = await axios.request({
			method: 'get',
			responseType: 'arraybuffer',
			url: url,
		});

		this.fileCache.save('font', url, response.data as Buffer);

		return response.data as Buffer;
	}
}

