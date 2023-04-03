import { Downloader } from './downloader';
import { FileCache } from './file-cache';
import { Logger } from './logger';

export class FontLoader {
	constructor(
		private logger: Logger,
		private downloader: Downloader,
		private fileCache: FileCache
	) {}

	async load(url: string): Promise<Buffer> {
		this.logger.flashLine(url);

		const cachedFile = this.fileCache.get('font', url);

		if (cachedFile) {
			return cachedFile as Buffer;
		}

		const response = await this.downloader.download(url);

		this.fileCache.save('font', url, response.data as Buffer);

		return response.data as Buffer;
	}
}

