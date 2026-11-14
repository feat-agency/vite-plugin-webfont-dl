export class IndexHtmlProcessor {
	private webfontRegexes = [
		// <link rel="stylesheet" href="...">
		// <link href="..." rel="stylesheet">

		// https://fonts.googleapis.com
		/(<!--.*?)?<link[^>]+rel=['"]?stylesheet['"]?[^>]+href=['"]?(https:\/\/fonts\.googleapis\.com[^'">]+)['"]?[^>]*>/gs,
		/(<!--.*?)?<link[^>]+href=['"]?(https:\/\/fonts\.googleapis\.com[^'">]+)['"]?[^>]+rel=['"]?stylesheet['"]?[^>]*>/gs,

		// https://fonts.bunny.net
		/(<!--.*?)?<link[^>]+rel=['"]?stylesheet['"]?[^>]+href=['"]?(https:\/\/fonts\.bunny\.net[^'">]+)['"]?[^>]*>/gs,
		/(<!--.*?)?<link[^>]+href=['"]?(https:\/\/fonts\.bunny\.net[^'">]+)['"]?[^>]+rel=['"]?stylesheet['"]?[^>]*>/gs,

		// https://api.fontshare.com
		/(<!--.*?)?<link[^>]+rel=['"]?stylesheet['"]?[^>]+href=['"]?(https:\/\/api\.fontshare\.com[^'">]+)['"]?[^>]*>/gs,
		/(<!--.*?)?<link[^>]+href=['"]?(https:\/\/api\.fontshare\.com[^'">]+)['"]?[^>]+rel=['"]?stylesheet['"]?[^>]*>/gs,

		// https://cdn.jsdelivr.net
		/(<!--.*?)?<link[^>]+rel=['"]?stylesheet['"]?[^>]+href=['"]?(https:\/\/cdn\.jsdelivr\.net[^'">]+\.css)['"]?[^>]*>/gs,
		/(<!--.*?)?<link[^>]+href=['"]?(https:\/\/cdn\.jsdelivr\.net[^'">]+\.css)['"]?[^>]+rel=['"]?stylesheet['"]?[^>]*>/gs,

		// https://rsms.me
		/(<!--.*?)?<link[^>]+rel=['"]?stylesheet['"]?[^>]+href=['"]?(https:\/\/rsms\.me[^'">]+)['"]?[^>]*>/gs,
		/(<!--.*?)?<link[^>]+href=['"]?(https:\/\/rsms\.me[^'">]+)['"]?[^>]+rel=['"]?stylesheet['"]?[^>]*>/gs,
	];

	private preconnectRegexes = [
		// <link rel="preconnect" href="...">
		// <link rel="preconnect" href="..." crossorigin>
		// <link href="..." rel="preconnect">
		// <link href="..." rel="preconnect" crossorigin>

		// https://fonts.googleapis.com
		/<link[^>]+rel=['"]?preconnect['"]?[^>]+href=['"]?https:\/\/fonts\.googleapis\.com['"]?[^>]*>/,
		/<link[^>]+href=['"]?https:\/\/fonts\.googleapis\.com['"]?[^>]+rel=['"]?preconnect['"]?[^>]*>/,

		// https://fonts.gstatic.com
		/<link[^>]+rel=['"]?preconnect['"]?[^>]+href=['"]?https:\/\/fonts\.gstatic\.com['"]?[^>]*>/,
		/<link[^>]+href=['"]?https:\/\/fonts\.gstatic\.com['"]?[^>]+rel=['"]?preconnect['"]?[^>]*>/,

		// https://fonts.bunny.net
		/<link[^>]+rel=['"]?preconnect['"]?[^>]+href=['"]?https:\/\/fonts\.bunny\.net['"]?[^>]*>/,
		/<link[^>]+href=['"]?https:\/\/fonts\.bunny\.net['"]?[^>]+rel=['"]?preconnect['"]?[^>]*>/,

		// https://api.fontshare.com
		/<link[^>]+rel=['"]?preconnect['"]?[^>]+href=['"]?https:\/\/api\.fontshare\.com['"]?[^>]*>/,
		/<link[^>]+href=['"]?https:\/\/api\.fontshare\.com['"]?[^>]+rel=['"]?preconnect['"]?[^>]*>/,

		// https://rsms.me
		/<link[^>]+rel=['"]?preconnect['"]?[^>]+href=['"]?https:\/\/rsms\.me['"]?[^>]*>/,
		/<link[^>]+href=['"]?https:\/\/rsms\.me['"]?[^>]+rel=['"]?preconnect['"]?[^>]*>/,
	];

	private characterReferences: Record<string, string> = {
		amp: '&',
		lt: '<',
		gt: '>',
		quot: '"',
		apos: '\'',
	};

	parse(html: string): Set<string> {
		const webfontUrls = new Set<string>();

		for (const regex of this.webfontRegexes) {
			const matches = html.matchAll(regex);

			if (matches) {
				for (const match of matches) {
					if (!match[1] || match[1].includes('-->')) {
						webfontUrls.add(this.decodeUrl(match[2]));
					}
				}
			}
		}

		return webfontUrls;
	}

	/**
	 * Removes the webfont tags, except the ones of `keepUrls`:
	 * a webfont css which could not be downloaded stays on the provider.
	 */
	removeTags(html: string, keepUrls = new Set<string>()): string {
		// a kept tag still benefits from the preconnect hints
		const keepsTag = keepUrls.size > 0 && [...this.parse(html)].some((url) => keepUrls.has(url));

		if (!keepsTag) {
			html = this.removePreconnectTags(html);
		}

		html = this.removeWebfontTags(html, keepUrls);

		return html;
	}

	/**
	 * An attribute value is html: `&amp;` stands for `&` (validators, formatters and template engines write it this way),
	 * the browser decodes the character references before it requests the stylesheet.
	 */
	private decodeUrl(url: string): string {
		return url.replace(
			/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|(amp|AMP|lt|LT|gt|GT|quot|QUOT|apos));/g,
			(match: string, decimal?: string, hex?: string, name?: string) => {
				if (name) {
					return this.characterReferences[name.toLowerCase()];
				}

				const codePoint = decimal ? parseInt(decimal, 10) : parseInt(hex!, 16);

				return codePoint > 0 && codePoint <= 0x10FFFF ? String.fromCodePoint(codePoint) : match;
			}
		);
	}

	private removePreconnectTags(html: string): string {
		for (const regex of this.preconnectRegexes) {
			const removeRegex = new RegExp('[ \t]*' + regex.source + '(\r\n|\r|\n)?', 'g');
			html = html.replace(removeRegex, '');
		}

		return html;
	}

	private removeWebfontTags(html: string, keepUrls: Set<string>): string {
		for (const regex of this.webfontRegexes) {
			const removeRegex = new RegExp('[ \t]*' + regex.source + '(\r\n|\r|\n)?', 'g');

			html = html.replace(
				removeRegex,
				(match: string, comment: string | undefined, url: string) => keepUrls.has(this.decodeUrl(url)) ? match : (comment ?? '')
			);
		}

		return html;
	}
}
