import type { Options } from './types';

const defaultOptions: Options = {
	async: true,
}

export const getOptionsWithDefaults = (options?: Options): Options => {

	if (!options) {
		return defaultOptions;
	}

	const obj: {[key: string]: boolean} = {};

	for (const key in options) {
		if (key in defaultOptions) {
			obj[(key as keyof Options)] = options[(key as keyof Options)];
		}
	}

	return {
		...defaultOptions,
		...obj
	};
}
