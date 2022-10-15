import type { Options } from './types';

const defaultOptions: Options = {
	injectAsStyleTag: true,
	minifyCss: true,
	async: true,
}

export const getOptionsWithDefaults = (options: Options = {}): Options => {

	return {
		...defaultOptions,
		...options
	};
}
