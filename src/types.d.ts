import { AxiosProxyConfig } from 'axios';

/**
 * Minimal structural types for bundle interaction,
 * compatible with both Rollup (Vite ≤7) and Rolldown (Vite 8+).
 */
export interface EmittedAsset {
	type: 'asset';
	name?: string;
	fileName?: string;
	originalFileName?: string;
	source: string | Uint8Array;
}

export type EmitFile = (emittedFile: EmittedAsset) => string;

export interface OutputAsset {
	source: string | Uint8Array;
}

export type OutputBundle = Record<string, unknown>;

export type FontExtension = 'woff2' | 'woff' | 'ttf' | 'otf' | 'svg' | 'eot';

export interface Font {
	url: string;
	filename: string;
	localPath: string;
	savedPath?: string; // emitted file name, relative to the output directory
	binary?: Buffer;
}

export type FontCollection = Map<string, Font>;

export interface BundleCssImport {
	url: string;
	statement: string;
}

export interface ParsedBundleCss {
	fonts: FontCollection;
	webfontUrlsCss: Set<string>;
	matchedCssParts: string[];
	fontFaces: string[];
	imports: BundleCssImport[];
}

export interface BundleCssFile extends Pick<ParsedBundleCss, 'fontFaces' | 'imports'> {
	path: string;
}

export interface Options {
	/**
	 * Inject critical CSS as a <style> tag.
	 * default: `true`
	 */
	injectAsStyleTag?: boolean;

	/**
	 * Minify CSS code during the build process.
	 * default: value of `build.minify`
	 */
	minifyCss?: boolean;

	/**
	 * Embed base64-encoded fonts into CSS.
	 * May increase file size if CSS contains multiple references to the same font file.
	 * default: `false`
	 */
	embedFonts?: boolean;

	/**
	 * Load stylesheet asynchronously using `media="print"`.
	 * Only applies when `injectAsStyleTag` is `false`.
	 * default: `true`
	 */
	async?: boolean;

	/**
	 * Persistently store downloaded CSS and font files in a local file cache.
	 * If set to `false`, the existing cache will be deleted.
	 * default: `true`
	 */
	cache?: boolean;

	/**
	 * Proxy configuration for network requests (uses axios).
	 * default: `false`
	 */
	proxy?: false | AxiosProxyConfig;

	/**
	 * Move downloaded font files to a separate subfolder within the assets directory.
	 * default: `''`
	 */
	assetsSubfolder?: string;

	/**
	 * Throw an error and stop the build if any font download or processing fails.
	 * If `false`, errors are logged as warnings and the build continues.
	 * default: `false`
	 */
	throwError?: boolean;

	/**
	 * Restrict downloaded fonts to the specified Unicode subsets (e.g., `['latin', 'latin-ext']`).
	 * Only font files matching these subsets will be included. Leave empty to allow all subsets.
	 * default: `[]`
	 */
	subsetsAllowed?: string[];

	/**
	 * Self-host the fonts referenced from your CSS (`@import`, `@font-face`) inside the same CSS file,
	 * instead of moving them to the injected webfont CSS.
	 * Use it with frameworks that render HTML outside of Vite (e.g., React Router, SvelteKit, Nuxt),
	 * where the plugin has no HTML file to inject into.
	 * default: `false`
	 */
	cssInPlace?: boolean;
}
