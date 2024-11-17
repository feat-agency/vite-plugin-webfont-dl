import { Font } from 'src/types';
import { WebfontDownload } from 'src/webfont-download';
import { describe, expect, it } from 'vitest';

describe('save', () => {
	it('should save css', () => {
		const webfontDl = new WebfontDownload([], {
			injectAsStyleTag: false,
		});

		expect(webfontDl.saveCss()).eq('webfonts.css');
	});

	it('should save font', () => {
		const webfontDl = new WebfontDownload();

		const font: Font = {
			url: 'url',
			filename: 'filename',
			localPath: 'localpath',
		};

		webfontDl.saveFont(font, Buffer.from('buffer'));

		expect(font.localPath).eq('/filename');
	});

	it('should save font in subfolder', () => {
		const webfontDl = new WebfontDownload([], {
			assetsSubfolder: 'subfolder',
		});

		const font: Font = {
			url: 'url',
			filename: 'filename',
			localPath: 'localpath',
		};

		webfontDl.saveFont(font, Buffer.from('buffer'));

		expect(font.localPath).eq('/subfolder/filename');
	});
});
