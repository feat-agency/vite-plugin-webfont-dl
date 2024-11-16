import type { Options } from './types';

const defaultOptions: Required<Options> = {
	injectAsStyleTag: true,
	minifyCss: true,
	embedFonts: false,
	async: true,
	cache: true,
	proxy: false,
	assetsSubfolder: '',
};

export const getOptionsWithDefaults = (options: Options = {}): Required<Options> => {
	const optionsWithDefaults = {
		...defaultOptions,
		...options,
	};
	return optionsWithDefaults;
};