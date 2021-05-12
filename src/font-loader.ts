import axios from 'axios';

export class FontLoader {
	async load(url: string): Promise<Buffer> {
		const response = await axios.request({
			method: 'get',
			responseType: 'arraybuffer',
			url: url,
		});

		return response.data;
	}
}

