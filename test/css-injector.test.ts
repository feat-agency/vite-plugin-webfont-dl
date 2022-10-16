import { readFileSync } from 'fs';
import { CssInjector } from 'src/css-injector';
import { Options } from 'src/types';
import { describe, expect, it } from 'vitest';

describe('css injector', () => {

	it('should inject style tag', () => {
		const options: Options = {
			minifyCss: false,
		};

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
		const options: Options = {
			minifyCss: true,
		};

		const css = readFileSync(__dirname + '/fixtures/google-fonts.min.css').toString();
		const htmlBefore = readFileSync(__dirname + '/fixtures/index-no-fonts.html').toString();
		const htmlExpected = htmlBefore.replace(
			'</head>',
			`  <style>${css}</style>\n  </head>`
		);

		const htmlAfter = (new CssInjector(options)).injectAsStyleTag(htmlBefore, css);

		expect(htmlAfter).eq(htmlExpected);
	});



	it('should inject stylesheet async', () => {
		const options: Options = {
			injectAsStyleTag: false,
			async: true,
		};

		const htmlBefore = readFileSync(__dirname + '/fixtures/index-no-fonts.html').toString();
		const htmlExpected = htmlBefore.replace(
			'</head>',
			`  <link rel="preload" as="style" href="/assets/webfonts.css">\n    <link rel="stylesheet" media="print" onload="this.onload=null;this.removeAttribute('media');" href="/assets/webfonts.css">\n  </head>`
		);

		const htmlAfter = (new CssInjector(options)).injectAsStylesheet(htmlBefore, '/', 'assets/webfonts.css');

		expect(htmlAfter).eq(htmlExpected);
	});



	it('should inject stylesheet sync', () => {
		const options: Options = {
			injectAsStyleTag: false,
			async: false,
		};

		const htmlBefore = readFileSync(__dirname + '/fixtures/index-no-fonts.html').toString();
		const htmlExpected = htmlBefore.replace(
			'</head>',
			`  <link rel="preload" as="style" href="/assets/webfonts.css">\n    <link rel="stylesheet" href="/assets/webfonts.css">\n  </head>`
		);

		const htmlAfter = (new CssInjector(options)).injectAsStylesheet(htmlBefore, '/', 'assets/webfonts.css');

		expect(htmlAfter).eq(htmlExpected);
	});
});
