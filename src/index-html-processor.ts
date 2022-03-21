function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class IndexHtmlProcessor {
	private googlePreconnectUrls = [
		'https://fonts.googleapis.com',
		'https://fonts.gstatic.com',
	];

	private googleFontUrls = [
		'https://fonts.googleapis.com'
	];

	parse(html: string): Set<string> {
		const webfontUrls = new Set<string>();

		for (const url of this.googleFontUrls) {
			const escapedUrl = escapeRegExp(url);

			// <link rel="stylesheet" href="...">
			// <link href="..." rel="stylesheet">
			const regexes = [
				new RegExp(`<link[^>]+rel=['"]?stylesheet['"]?[^>]+href=['"]?(${escapedUrl}[^'">]+)['"]?[^>]*>`, 'g'),
				new RegExp(`<link[^>]+href=['"]?(${escapedUrl}[^'">]+)['"]?[^>]+rel=['"]?stylesheet['"]?[^>]*>`, 'g'),
			];

			for (const regex of regexes) {
				const matches = html.matchAll(regex);

				if (matches) {
					for (const match of matches) {
						webfontUrls.add(match[1]);
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
		for (const url of this.googlePreconnectUrls) {
			const escapedUrl = escapeRegExp(url);

			// <link rel="preconnect" href="...">
			// <link rel="preconnect" href="..." crossorigin>
			// <link href="..." rel="preconnect">
			// <link href="..." rel="preconnect" crossorigin>
			const regexes = [
				new RegExp(`[ \t]*<link[^>]+rel=['"]?preconnect['"]?[^>]+href=['"]?${escapedUrl}['"]?[^>]*>(\r\n|\r|\n)?`, 'g'),
				new RegExp(`[ \t]*<link[^>]+href=['"]?${escapedUrl}['"]?[^>]+rel=['"]?preconnect['"]?[^>]*>(\r\n|\r|\n)?`, 'g'),
			];

			for (const regex of regexes) {
				html = html.replace(regex, '');
			}
		}

		return html;
	}

	private removeWebfontTags(html: string): string {
		for (const url of this.googleFontUrls) {
			const escapedUrl = escapeRegExp(url);

			// <link rel="stylesheet" href="...">
			// <link href="..." rel="stylesheet">
			const regexes = [
				new RegExp(`[ \t]*<link[^>]+rel=['"]?stylesheet['"]?[^>]+href=['"]?${escapedUrl}['"]?[^>]*>(\r\n|\r|\n)?`, 'g'),
				new RegExp(`[ \t]*<link[^>]+href=['"]?${escapedUrl}['"]?[^>]+rel=['"]?stylesheet['"]?[^>]*>(\r\n|\r|\n)?`, 'g'),
			];

			for (const regex of regexes) {
				html = html.replace(regex, '');
			}
		}

		return html;
	}
}
