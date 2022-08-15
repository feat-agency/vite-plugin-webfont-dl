export interface Font {
	url: string;
	localPath: string;
}

/**
 * This is the description of the interface
 *
 * @interface Options
 * @member {boolean} injectToHead is used to inject critical css between style tag.
 * @member {boolean} async is used to import stylesheet asynchronously.
 */
export interface Options {
	/** Inject critical css between style tag */
	injectToHead?: boolean;
	/** Import stylesheet asynchronously. Has no effect when `injectToHead` is true */
	async?: boolean;
}

