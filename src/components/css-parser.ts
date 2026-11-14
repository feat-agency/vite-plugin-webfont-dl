import type { BundleCssImport, Font, FontCollection, Options, ParsedBundleCss } from '../types';
import { createHash } from 'node:crypto';

export class CssParser {
	private fontSrcRegex = /(?:https?:)?\/\/[-a-z0-9@:%_+.~#?&/=]+\.(?:woff2?|eot|ttf|otf|svg)/gi;
	private googleFontsKitSrcRegex = /https:\/\/fonts\.gstatic\.com\/l\/font\?kit=[a-z0-9&=_-]+/gi;
	private fontFaceWithSubsetCommentRegex = /\/\*(.*?)\*\/\s*@font-face\s*{[^}]*}/gi;

	private fontFilenameRegex = /[^/]+\.(?:woff2?|eot|ttf|otf|svg)/i;
	private googleFontsFileRegex = /\?kit=([a-z0-9_-]+)/i;

	// @font-face { src: url('...'); }
	// @import url('...');
	private webfontProviders = [
		/https:\/\/fonts\.googleapis\.com\//i,
		/https:\/\/fonts\.gstatic\.com\//i,
		/https:\/\/fonts\.bunny\.net\//i,
		/https:\/\/api\.fontshare\.com\//i,
	];

	constructor(
		private options: Required<Options>,
	) {}

	public parse(cssContent: string, base: string, assetsDir: string, filterSubsets = true): { cssContent: string; fonts: FontCollection } {
		const fonts: FontCollection = new Map();

		if (filterSubsets && this.options.subsetsAllowed.length) {
			let newCssContent = '';

			const fontFaceWithSubsetCommentMatches = cssContent.matchAll(this.fontFaceWithSubsetCommentRegex);

			for (const fontFaceWithSubsetCommentMatch of fontFaceWithSubsetCommentMatches) {
				if (this.options.subsetsAllowed.includes(fontFaceWithSubsetCommentMatch[1].trim())) {
					newCssContent += fontFaceWithSubsetCommentMatch[0].trim() + '\n';
				}
			}

			cssContent = newCssContent.trim();
		}

		const fontSrcMatches = cssContent.matchAll(this.fontSrcRegex);
		const googleFontsKitSrcMatches = cssContent.matchAll(this.googleFontsKitSrcRegex);

		if (fontSrcMatches) {
			for (const fontSrcMatch of fontSrcMatches) {
				const url = fontSrcMatch.toString();
				const filenameMatch = url.match(this.fontFilenameRegex);

				if (filenameMatch) {
					const filename = filenameMatch[0];

					fonts.set(url, {
						// source: 'src'
						url,
						filename,
						localPath: this.getLocalPath(filename, base, assetsDir),
					});
				}
			}
		}

		if (googleFontsKitSrcMatches) {
			for (const googleFontsKitSrcMatch of googleFontsKitSrcMatches) {
				const url = googleFontsKitSrcMatch.toString();
				let filename = url.match(this.googleFontsFileRegex)?.[1]?.toString();

				if (filename) {
					if (filename.length > 50) {
						filename = createHash('sha1').update(filename).digest('hex');
					}

					const filenameWithExtension = filename + '.woff2';

					fonts.set(url, {
						url,
						filename: filenameWithExtension,
						localPath: this.getLocalPath(filenameWithExtension, base, assetsDir),
					});
				}
			}
		}

		return {
			cssContent: cssContent,
			fonts: fonts,
		};
	}

	/**
	 * Gives every font its own file name.
	 *
	 * Different fonts can share a file name: Bunny Fonts / Fontsource name the files by subset, weight and style
	 * (`inter@5.3.0/latin-400-normal.woff2`, `roboto@5.3.0/latin-400-normal.woff2`).
	 * These get the name of their directory as a prefix, and the hash of their url if that is still not unique.
	 * Fonts with a unique file name are not touched.
	 */
	public deduplicateFilenames(fonts: FontCollection, base: string, assetsDir: string): void {
		const prefixes = [
			(font: Font) => this.getDirectoryName(font.url),
			(font: Font) => createHash('sha1').update(font.url).digest('hex').substring(0, 8),
		];

		for (const getPrefix of prefixes) {
			const fontsByFilename = new Map<string, Font[]>();

			fonts.forEach((font) => {
				// lowercase: these are the same file on a case-insensitive file system
				const key = font.filename.toLowerCase();

				fontsByFilename.set(key, [...(fontsByFilename.get(key) ?? []), font]);
			});

			fontsByFilename.forEach((sameNamedFonts) => {
				if (sameNamedFonts.length < 2) {
					return;
				}

				sameNamedFonts.forEach((font) => {
					const prefix = getPrefix(font);

					if (prefix) {
						font.filename = prefix + '-' + font.filename;
						font.localPath = this.getLocalPath(font.filename, base, assetsDir);
					}
				});
			});
		}
	}

	private getLocalPath(filename: string, base: string, assetsDir: string): string {
		return base + (assetsDir ? assetsDir + '/' : '') + filename;
	}

	/**
	 * `https://cdn.jsdelivr.net/fontsource/fonts/inter@5.3.0/latin-400-normal.woff2` => `inter-5.3.0`
	 */
	private getDirectoryName(url: string): string {
		const directory = url.replace(/[?#].*$/, '').split('/').slice(-2, -1)[0] ?? '';

		return directory
			.replace(/[^a-z0-9._-]+/gi, '-')
			.replace(/^[-.]+|[-.]+$/g, '');
	}



	public parseBundleCss(cssContent: string, base: string, assetsDir: string): ParsedBundleCss {
		const fonts: FontCollection = new Map();
		const webfontUrlsCss = new Set<string>([]);
		const matchedCssParts: string[] = [];
		const matchedFontFaces: string[] = [];
		const matchedImports: BundleCssImport[] = [];

		const importRegex = /@import\s*(?:url\()?['"]?([^\s'")]+)['"]?\)?;/g;
		const fontFaceRegex = /@font-face\s*{[^}]*}/g;

		const imports = [...cssContent.matchAll(importRegex)];
		const fontFaces = [...cssContent.matchAll(fontFaceRegex)];

		fontFaces.forEach((match) => {
			const fontFace = match[0];

			// the user's own @font-face rules have no subset comments,
			// so subset filtering must not be applied here
			const parseResult = this.parse(fontFace, base, assetsDir, false);
			let matched = false;

			parseResult.fonts.forEach((font: Font) => {
				if (this.webfontProviders.some((regex) => regex.test(font.url))) {
					fonts.set(font.url, font);
					matched = true;
				}
			});

			if (matched && !matchedFontFaces.includes(fontFace)) {
				matchedCssParts.push(fontFace);
				matchedFontFaces.push(fontFace);
			}
		});

		imports.forEach((match) => {
			const url = match[1];

			if (this.webfontProviders.some((regex) => regex.test(url))) {
				webfontUrlsCss.add(url);
				matchedCssParts.push(match[0]);
				matchedImports.push({ url, statement: match[0] });
			}
		});

		return {
			fonts,
			webfontUrlsCss,
			matchedCssParts,
			fontFaces: matchedFontFaces,
			imports: matchedImports,
		};
	}
}

