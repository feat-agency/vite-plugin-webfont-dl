import type { Options } from './types';

const defaultOptions: Options = {
	async: true,
}

export const getOptionsWithDefaults = (options: Options = {}): Options => {

	return {
		...defaultOptions,
		...options
	};
}
