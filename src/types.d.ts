export interface Font {
	url: string;
	localPath: string;
}

/**
 * This is the description of the interface
 *
 * @interface Options
 * @member {boolean} injectToHead is used to inject critical css between style tag
 */
export interface Options {
	async?: boolean;
	/** Inject critical css between style tag */
	injectToHead?: boolean;
}

