export interface Font {
	url: string;
	localPath: string;
}

export interface FontsCollection {
	[key: string]: Font;
}

export interface ParsedBundleCss {
	fonts: FontsCollection;
	webfontUrlsCss: Set<string>;
	matchedCssParts: string[];
}

/**
 * This is the description of the interface
 *
 * @interface Options
 * @member {boolean} injectAsStyleTag is used to inject critical css between style tag.
 * @member {boolean} async is used to import stylesheet asynchronously.
 */
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
	 * Load stylesheet asynchronously (using `media="print"`).
	 * Works only with `injectAsStyleTag:false`).
	 * default: `true`
	 * */
	async?: boolean;
}

