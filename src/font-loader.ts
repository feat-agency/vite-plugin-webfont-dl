import axios from 'axios';

export class FontLoader {
	async load(url: string, userAgent?: string) {
		const response = await axios.request({
			method: 'get',
			responseType: 'arraybuffer',
			url: url,
		});

		return response.data as Buffer;
	}
}

