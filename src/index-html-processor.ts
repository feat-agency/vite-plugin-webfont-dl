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

	parse(html: string): Set<string> {
		const webfontUrls = new Set<string>();

		for (const regex of this.webfontRegexes) {
			const matches = html.matchAll(regex);

			if (matches) {
				for (const match of matches) {
					if (!match[1] || match[1].includes('-->')) {
						webfontUrls.add(match[2]);
					}
				}
			}
		}

		return webfontUrls;
	}

	removeTags(html: string): string {
		html = this.removePreconnectTags(html);
		html = this.removeWebfontTags(html);

		return html;
	}

	private removePreconnectTags(html: string): string {
		for (const regex of this.preconnectRegexes) {
			const removeRegex = new RegExp('[ \t]*' + regex.source + '(\r\n|\r|\n)?', 'g');
			html = html.replace(removeRegex, '');
		}

		return html;
	}

	private removeWebfontTags(html: string): string {
		for (const regex of this.webfontRegexes) {
			const removeRegex = new RegExp('[ \t]*' + regex.source + '(\r\n|\r|\n)?', 'g');
			html = html.replace(removeRegex, '');
		}

		return html;
	}
}
