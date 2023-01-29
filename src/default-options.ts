import type { Options } from './types';

const defaultOptions: Options = {
	injectAsStyleTag: true,
	minifyCss: true,
	async: true,
	cache: true,
};

export const getOptionsWithDefaults = (options: Options = {}): Options => {

	return {
		...defaultOptions,
		...options,
	};
};
