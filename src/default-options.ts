import type { Options } from './types';

const defaultOptions: Options = {
	injectAsStyleTag: true,
	minifyCss: true,
	embedFonts: false,
	async: true,
	cache: true,
	proxy: false,
};

export const getOptionsWithDefaults = (options: Options = {}): Options => {

	return {
		...defaultOptions,
		...options,
	};
};
