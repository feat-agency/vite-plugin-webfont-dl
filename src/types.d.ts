export interface Font {
	url: string;
	localPath: string;
}

/**
 * This is the description of the interface
 *
 * @interface Options
 * @member {boolean} injectAsStyleTag is used to inject critical css between style tag.
 * @member {boolean} async is used to import stylesheet asynchronously.
 */
export interface Options {
	/** Inject critical css between style tag */
	injectAsStyleTag?: boolean;
	/** Import stylesheet asynchronously. Has no effect when `injectAsStyleTag` is `true` */
	async?: boolean;
}

