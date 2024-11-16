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

export const getResolvedOptions = (options: Options = {}): Required<Options> => {
	return {
		...defaultOptions,
		...options,
	};
};
