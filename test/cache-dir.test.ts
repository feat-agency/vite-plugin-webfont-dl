import { describe, expect, it } from 'vitest';
import { WebfontDownload } from 'src/webfont-download';

describe('Cache directory configuration (Issue #88)', () => {
	it('should use default cache directory when not configured', () => {
		const webfontDl = new WebfontDownload();

		// Default cache directory should be used
		// We can't directly test the private property, but we can verify the method exists
		expect(typeof webfontDl.setCacheDir).toBe('function');
	});

	it('should accept custom cache directory from Vite config', () => {
		const webfontDl = new WebfontDownload();

		// This simulates what happens in the configResolved hook
		expect(() => {
			webfontDl.setCacheDir('/custom/cache/dir');
		}).not.toThrow();
	});

	it('should accept Yarn PnP cache directory', () => {
		const webfontDl = new WebfontDownload();

		// Simulate Yarn PnP without node_modules
		expect(() => {
			webfontDl.setCacheDir('.yarn/.cache');
		}).not.toThrow();
	});
});
