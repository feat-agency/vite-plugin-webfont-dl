import { readFileSync } from 'node:fs';
import { IndexHtmlProcessor } from 'src/components/index-html-processor';
import { describe, expect, it } from 'vitest';

describe('index.html processor', () => {

	it('should find Google Fonts', () => {
		const html = readFileSync(__dirname + '/fixtures/index-google-fonts.html').toString();
		const fonts = (new IndexHtmlProcessor()).parse(html);

		expect(fonts.size).eq(1);
		expect(fonts.has('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@300;700&family=Roboto:wght@300;700&display=swap')).toBeTruthy();
	});



	it('should find Bunny Fonts', () => {
		const html = readFileSync(__dirname + '/fixtures/index-bunny-fonts.html').toString();
		const fonts = (new IndexHtmlProcessor()).parse(html);

		expect(fonts.size).eq(1);
		expect(fonts.has('https://fonts.bunny.net/css2?family=Roboto+Mono:wght@300;700&family=Roboto:wght@300;700&display=swap')).toBeTruthy();
	});



	it('should find Fontshare', () => {
		const html = readFileSync(__dirname + '/fixtures/index-fontshare.html').toString();
		const fonts = (new IndexHtmlProcessor()).parse(html);

		expect(fonts.size).eq(1);
		expect(fonts.has('https://api.fontshare.com/v2/css?f[]=general-sans@200,300&f[]=cabinet-grotesk@200&display=swap')).toBeTruthy();
	});



	it('should find jsDelivr', () => {
		const html = readFileSync(__dirname + '/fixtures/index-jsdelivr.html').toString();
		const fonts = (new IndexHtmlProcessor()).parse(html);

		expect(fonts.size).eq(1);
		expect(fonts.has('https://cdn.jsdelivr.net/npm/firacode@6.2.0/distr/fira_code.css')).toBeTruthy();
	});



	it('should find rsms.me', () => {
		const html = readFileSync(__dirname + '/fixtures/index-rsms.html').toString();
		const fonts = (new IndexHtmlProcessor()).parse(html);

		expect(fonts.size).eq(1);
		expect(fonts.has('https://rsms.me/inter/inter.css')).toBeTruthy();
	});



	it('should not find any fonts', () => {
		const html = readFileSync(__dirname + '/fixtures/index-no-fonts.html').toString();
		const fonts = (new IndexHtmlProcessor()).parse(html);

		expect(fonts.size).eq(0);
	});



	it('should remove Google Fonts tags', () => {
		const htmlBefore = readFileSync(__dirname + '/fixtures/index-google-fonts.html').toString();
		const htmlAfter = (new IndexHtmlProcessor()).removeTags(htmlBefore);

		const preconnectTag1 = '<link rel="preconnect" href="https://fonts.googleapis.com">';
		const preconnectTag2 = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
		const stylesheetTag = '<link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@300;700&family=Roboto:wght@300;700&display=swap" rel="stylesheet">';

		expect(htmlBefore).contains(preconnectTag1);
		expect(htmlAfter).not.contains(preconnectTag1);

		expect(htmlBefore).contains(preconnectTag2);
		expect(htmlAfter).not.contains(preconnectTag2);

		expect(htmlBefore).contains(stylesheetTag);
		expect(htmlAfter).not.contains(stylesheetTag);
	});



	it('should remove Bunny Fonts tags', () => {
		const htmlBefore = readFileSync(__dirname + '/fixtures/index-bunny-fonts.html').toString();
		const htmlAfter = (new IndexHtmlProcessor()).removeTags(htmlBefore);

		const preconnectTag = '<link rel="preconnect" href="https://fonts.bunny.net">';
		const stylesheetTag = '<link href="https://fonts.bunny.net/css2?family=Roboto+Mono:wght@300;700&family=Roboto:wght@300;700&display=swap" rel="stylesheet" />';

		expect(htmlBefore).contains(preconnectTag);
		expect(htmlAfter).not.contains(preconnectTag);

		expect(htmlBefore).contains(stylesheetTag);
		expect(htmlAfter).not.contains(stylesheetTag);
	});



	it('should remove Fontshare tags', () => {
		const htmlBefore = readFileSync(__dirname + '/fixtures/index-fontshare.html').toString();
		const htmlAfter = (new IndexHtmlProcessor()).removeTags(htmlBefore);

		const preconnectTag = '<link rel="preconnect" href="https://api.fontshare.com">';
		const stylesheetTag = '<link href="https://api.fontshare.com/v2/css?f[]=general-sans@200,300&f[]=cabinet-grotesk@200&display=swap" rel="stylesheet">';

		expect(htmlBefore).contains(preconnectTag);
		expect(htmlAfter).not.contains(preconnectTag);

		expect(htmlBefore).contains(stylesheetTag);
		expect(htmlAfter).not.contains(stylesheetTag);
	});



	it('should remove jsDelivr tags', () => {
		const htmlBefore = readFileSync(__dirname + '/fixtures/index-jsdelivr.html').toString();
		const htmlAfter = (new IndexHtmlProcessor()).removeTags(htmlBefore);

		const stylesheetTag = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/firacode@6.2.0/distr/fira_code.css">';

		expect(htmlBefore).contains(stylesheetTag);
		expect(htmlAfter).not.contains(stylesheetTag);
	});



	it('should remove rsms.me tags', () => {
		const htmlBefore = readFileSync(__dirname + '/fixtures/index-rsms.html').toString();
		const htmlAfter = (new IndexHtmlProcessor()).removeTags(htmlBefore);

		const preconnectTag = '<link rel="preconnect" href="https://rsms.me/">';
		const stylesheetTag = '<link rel="stylesheet" href="https://rsms.me/inter/inter.css">';

		expect(htmlBefore).contains(preconnectTag);
		expect(htmlAfter).not.contains(preconnectTag);

		expect(htmlBefore).contains(stylesheetTag);
		expect(htmlAfter).not.contains(stylesheetTag);
	});

	describe('character references in the href', () => {
		const url = 'https://fonts.googleapis.com/css2?family=Roboto&family=Lato&display=swap';

		const link = (href: string) => `<head>\n  <link href="${href}" rel="stylesheet" />\n  <title>x</title>\n</head>`;

		it('should decode `&amp;`', () => {
			const html = link('https://fonts.googleapis.com/css2?family=Roboto&amp;family=Lato&amp;display=swap');

			expect([...(new IndexHtmlProcessor()).parse(html)]).deep.eq([url]);
		});

		it('should decode numeric character references', () => {
			const html = link('https://fonts.googleapis.com/css2?family=Roboto&#38;family=Lato&#x26;display=swap');

			expect([...(new IndexHtmlProcessor()).parse(html)]).deep.eq([url]);
		});

		it('should leave a plain `&` as it is', () => {
			const plain = 'https://fonts.googleapis.com/css2?family=Roboto&amp=1&lt=2&family=Lato';

			expect([...(new IndexHtmlProcessor()).parse(link(plain))]).deep.eq([plain]);
		});

		it('should find the same url only once, however it is written', () => {
			const html = link(url) + link(url.replaceAll('&', '&amp;'));

			expect([...(new IndexHtmlProcessor()).parse(html)]).deep.eq([url]);
		});

		it('should remove the tag', () => {
			const html = link(url.replaceAll('&', '&amp;'));

			expect((new IndexHtmlProcessor()).removeTags(html)).eq('<head>\n  <title>x</title>\n</head>');
		});

		it('should keep the tag of a failed url as it was written', () => {
			const html = link(url.replaceAll('&', '&amp;'));

			expect((new IndexHtmlProcessor()).removeTags(html, new Set([url]))).eq(html);
		});
	});

	describe('keeping the tags of failed urls', () => {
		const goodUrl = 'https://fonts.googleapis.com/css2?family=Good';
		const failedUrl = 'https://fonts.googleapis.com/css2?family=Failed';

		const html = [
			'<head>',
			'  <link rel="preconnect" href="https://fonts.googleapis.com">',
			`  <link href="${goodUrl}" rel="stylesheet">`,
			`  <link rel="stylesheet" href="${failedUrl}">`,
			'  <title>x</title>',
			'</head>',
		].join('\n');

		it('should remove everything by default', () => {
			expect((new IndexHtmlProcessor()).removeTags(html)).eq('<head>\n  <title>x</title>\n</head>');
		});

		it('should keep the tag of a failed url and the preconnect hints', () => {
			expect((new IndexHtmlProcessor()).removeTags(html, new Set([failedUrl]))).eq([
				'<head>',
				'  <link rel="preconnect" href="https://fonts.googleapis.com">',
				`  <link rel="stylesheet" href="${failedUrl}">`,
				'  <title>x</title>',
				'</head>',
			].join('\n'));
		});

		it('should remove the preconnect hints when the failed url has no tag in the html', () => {
			expect(
				(new IndexHtmlProcessor()).removeTags(html, new Set(['https://fonts.googleapis.com/css2?family=Elsewhere']))
			).eq('<head>\n  <title>x</title>\n</head>');
		});

		it('should behave the same with an empty set', () => {
			expect((new IndexHtmlProcessor()).removeTags(html, new Set())).eq((new IndexHtmlProcessor()).removeTags(html));
		});
	});
});
