import type { Options } from './types';

const defaultOptions: Options = {
	injectToHead: true,
	async: true,
}

export const getOptionsWithDefaults = (options: Options = {}): Options => {

	return {
		...defaultOptions,
		...options
	};
}
