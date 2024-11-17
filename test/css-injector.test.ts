import { readFileSync } from 'node:fs';
import { CssInjector } from 'src/components/css-injector';
import { getResolvedOptions } from 'src/components/default-options';
import { describe, expect, it } from 'vitest';

describe('css injector', () => {

	it('should inject style tag', () => {
		const options = getResolvedOptions({
			minifyCss: false,
		});

		const css = readFileSync(__dirname + '/fixtures/google-fonts.css').toString();
		const htmlBefore = readFileSync(__dirname + '/fixtures/index-no-fonts.html').toString();
		const htmlExpected = htmlBefore.replace(
			'</head>',
			`  <style>\n${css.replace(/^/gm, '      ')}\n    </style>\n  </head>`
		);

		const htmlAfter = (new CssInjector(options)).injectAsStyleTag(htmlBefore, css);

		expect(htmlAfter).eq(htmlExpected);
	});



	it('should inject style tag minified', () => {
		const options = getResolvedOptions({
			minifyCss: true,
		});

		const css = readFileSync(__dirname + '/fixtures/google-fonts.min.css').toString();

		const htmlBefore = readFileSync(__dirname + '/fixtures/index-no-fonts.html').toString();
		const htmlExpected = htmlBefore.replace(
			'</head>',
			`  <style>${css}</style>\n  </head>`
		);

		const htmlAfter = (new CssInjector(options)).injectAsStyleTag(htmlBefore, css);

		expect(htmlAfter).eq(htmlExpected);
	});



	it('should inject style tag minified into minified html', () => {
		const options = getResolvedOptions({
			minifyCss: true,
		});

		const css = readFileSync(__dirname + '/fixtures/google-fonts.min.css').toString();

		const htmlBefore = readFileSync(__dirname + '/fixtures/index-no-fonts-min.html').toString();
		const htmlExpected = htmlBefore.replace(
			'</head>',
			`<style>${css}</style></head>`
		);

		const htmlAfter = (new CssInjector(options)).injectAsStyleTag(htmlBefore, css);

		expect(htmlAfter).eq(htmlExpected);
	});



	it('should inject stylesheet async', () => {
		const options = getResolvedOptions({
			injectAsStyleTag: false,
			async: true,
		});

		const htmlBefore = readFileSync(__dirname + '/fixtures/index-no-fonts.html').toString();
		const htmlExpected = htmlBefore.replace(
			'</head>',
			'  <link rel="preload" as="style" href="/assets/webfonts.css">\n    <link rel="stylesheet" media="print" onload="this.onload=null;this.removeAttribute(\'media\');" href="/assets/webfonts.css">\n  </head>'
		);

		const htmlAfter = (new CssInjector(options)).injectAsStylesheet(htmlBefore, '/', 'assets/webfonts.css');

		expect(htmlAfter).eq(htmlExpected);
	});



	it('should inject stylesheet sync', () => {
		const options = getResolvedOptions({
			injectAsStyleTag: false,
			async: false,
		});

		const htmlBefore = readFileSync(__dirname + '/fixtures/index-no-fonts.html').toString();
		const htmlExpected = htmlBefore.replace(
			'</head>',
			'  <link rel="preload" as="style" href="/assets/webfonts.css">\n    <link rel="stylesheet" href="/assets/webfonts.css">\n  </head>'
		);

		const htmlAfter = (new CssInjector(options)).injectAsStylesheet(htmlBefore, '/', 'assets/webfonts.css');

		expect(htmlAfter).eq(htmlExpected);
	});
});
