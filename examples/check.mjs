// Verifies the build output of an example:
//  - it contains @font-face rules
//  - every font url of the html / css files points at an emitted file
//  - nothing loads from a webfont provider anymore
//
// usage: node check.mjs <output directory> [base]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const [, , outDir, base = '/'] = process.argv;

if (!outDir || !existsSync(outDir)) {
	console.error(`Output directory not found: ${outDir}`);
	process.exit(1);
}

const providers = /fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\.bunny\.net|api\.fontshare\.com|cdn\.fontshare\.com|cdn\.jsdelivr\.net|rsms\.me/;
const fontFile = /\.(woff2?|ttf|otf|eot|svg)$/;

const files = [];

const walk = (dir) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);

		if (entry.isDirectory()) {
			walk(path);
		} else {
			files.push(path);
		}
	}
};

walk(outDir);

let fontFaces = 0;
let localUrls = 0;
let embedded = 0;
const missing = [];
const remote = [];

for (const file of files.filter((path) => /\.(html|css)$/.test(path))) {
	const content = readFileSync(file, 'utf8');
	const name = relative(outDir, file);

	fontFaces += (content.match(/@font-face/g) ?? []).length;

	for (const [, url] of content.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
		if (url.startsWith('data:')) {
			embedded++;
		} else if (/^(https?:)?\/\//.test(url)) {
			if (providers.test(url)) {
				remote.push(`${name}: ${url}`);
			}
		} else {
			const path = url.replace(/[?#].*$/, '');

			if (!fontFile.test(path)) {
				continue;
			}

			const target = path.startsWith('/') ?
				join(outDir, path.startsWith(base) ? path.slice(base.length) : path) :
				resolve(dirname(file), path);

			if (existsSync(target)) {
				localUrls++;
			} else {
				missing.push(`${name}: ${url}`);
			}
		}
	}

	for (const [statement] of content.matchAll(/@import[^;]+;/g)) {
		if (providers.test(statement)) {
			remote.push(`${name}: ${statement}`);
		}
	}

	for (const [tag] of content.matchAll(/<link[^>]+>/g)) {
		if (providers.test(tag)) {
			remote.push(`${name}: ${tag}`);
		}
	}
}

const fonts = files.filter((path) => fontFile.test(path) && !path.endsWith('.svg')).length;

console.log(`${outDir}: ${fontFaces} @font-face rules, ${localUrls} local font urls, ${embedded} embedded fonts, ${fonts} font files`);

const errors = [
	...(fontFaces === 0 ? ['no @font-face rule found'] : []),
	...(localUrls + embedded === 0 ? ['no self-hosted font found'] : []),
	...missing.map((entry) => `font file is missing — ${entry}`),
	...remote.map((entry) => `still loads from a webfont provider — ${entry}`),
];

if (errors.length) {
	errors.forEach((error) => console.error(`✗ ${error}`));
	process.exit(1);
}

console.log('✓ all fonts are self-hosted');
