import axios, { AxiosResponse, ResponseType } from 'axios';
import colors from 'picocolors';
import { Logger } from './logger';
import { Options } from './types';

export class Downloader {
	private userAgentWoff2 = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36';
	private maxTries = 3;
	private timeout = 2500;
	private waitBeforeRetry = [25, 2500]; // range

	constructor(
		private options: Options,
		private logger: Logger
	) {}

	public async download(url: string, responseType?: ResponseType, tries = 1): Promise<AxiosResponse> {
		try {
			return await this.toRequest(url, responseType);
		} catch (err) {
			this.logger.error(
				colors.red(`✗ ${url}`) + ' ' +
				colors.dim(`(try #${tries})`) + ': ' +
				((axios.isAxiosError(err) ? err.message : err) as string)
			);

			if (tries < this.maxTries) {
				await new Promise((r) => setTimeout(r, this.randomWaitInterval()));

				return this.download(url, responseType, tries + 1);
			} else {
				throw err;
			}
		}
	}

	private toRequest(url: string, responseType?: ResponseType) {
		return axios.request({
			method: 'get',
			url: url,
			headers: {
				'User-Agent': this.userAgentWoff2,
			},
			responseType: responseType || 'arraybuffer',
			proxy: this.options.proxy,
			timeout: this.timeout,
		});
	}

	private randomWaitInterval() {
		return Math.floor(
			Math.random() * (this.waitBeforeRetry[0] - this.waitBeforeRetry[1] + 1) + this.waitBeforeRetry[1]
		);
	}
}

