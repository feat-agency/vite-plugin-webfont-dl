import { AxiosProxyConfig } from 'axios';

export type FontExtension = 'woff2' | 'woff' | 'ttf' | 'otf' | 'svg' | 'eot';

export interface Font {
	url: string;
	filename: string;
	localPath: string;
	binary?: Buffer;
}

export type FontCollection = Map<string, Font>;

export interface ParsedBundleCss {
	fonts: FontCollection;
	webfontUrlsCss: Set<string>;
	matchedCssParts: string[];
}

export interface Options {
	/**
	 * Inject critical css between style tag.
	 * default: `true`
	 * */
	injectAsStyleTag?: boolean;

	/**
	 * Minify CSS code during build.
	 * default: value of `build.minify`
	 * */
	minifyCss?: boolean;

	/**
	 * Embed base64-encoded fonts into css.
	 * In some cases can cause filesize increase if css containes multiple references to same font file.
	 * default: `false`
	 * */
	embedFonts?: boolean;

	/**
	 * Load stylesheet asynchronously (using `media="print"`).
	 * Works only with `injectAsStyleTag:false`).
	 * default: `true`
	 * */
	async?: boolean;

	/**
	 * Persistently store downloaded css and font files in local file cache.
	 * If set to `false` the existing cache will be deleted.
	 * default: `true`
	 * */
	cache?: boolean;

	/**
	 * You can set proxy for network requests (using axios).
	 * default: `false`
	 */
	proxy?: false | AxiosProxyConfig;

	/**
	 * Moves downloaded font files to separate subfolder
	 * default: `''`
	 */
	assetsSubfolder?: string;
}

