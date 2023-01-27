import { readFileSync } from 'fs';
import { IndexHtmlProcessor } from 'src/index-html-processor';
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



	it('should find CDNFonts', () => {
		const html = readFileSync(__dirname + '/fixtures/index-cdnfonts.html').toString();
		const fonts = (new IndexHtmlProcessor()).parse(html);

		expect(fonts.size).eq(1);
		expect(fonts.has('https://fonts.cdnfonts.com/css/glowkin-demo')).toBeTruthy();
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



	it('should remove CDNFonts tags', () => {
		const htmlBefore = readFileSync(__dirname + '/fixtures/index-cdnfonts.html').toString();
		const htmlAfter = (new IndexHtmlProcessor()).removeTags(htmlBefore);

		const preconnectTag = '<link rel="preconnect" href="https://fonts.cdnfonts.com">';
		const stylesheetTag = '<link href="https://fonts.cdnfonts.com/css/glowkin-demo" rel="stylesheet">';

		expect(htmlBefore).contains(preconnectTag);
		expect(htmlAfter).not.contains(preconnectTag);

		expect(htmlBefore).contains(stylesheetTag);
		expect(htmlAfter).not.contains(stylesheetTag);
	});
});
