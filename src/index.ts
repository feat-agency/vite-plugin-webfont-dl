import { ClientRequest, ServerResponse } from 'node:http';
import { EmittedFile, NormalizedOutputOptions, OutputAsset, OutputBundle } from 'rollup';
import type { Connect, IndexHtmlTransformContext, Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import colors from 'picocolors';
import { AxiosError } from 'axios';
import type { Options } from './types';
import { WebfontDownload } from './webfont-download';

/**
 * A, Build:
 *    1. [hook] configResolved
 *       ↳ setBase()
 *       ↳ setAssetsDir()
 *       ↳ setMinifyCss()
 *       ↳ setResolvedLogger()
 *
 *    2. [hook] transformIndexHtml
 *       ↳ htmlFiles collect
 *
 *    3. [hook] generateBundle
 *       ↳ setEmitFileFunction()
 *       ↳ setGetFilenameFunction()
 *       ↳ clearWebfontUrlsHtml()
 *       ↳ collectWebfontsFromHtml()
 *       ↳ collectWebfontsFromBundleCss()
 *       ↳ downloadWebfontCss()
 *       ↳ parseFontDefinitions()
 *       ↳ downloadFonts()
 *       ↳ replaceFontUrls()
 *       ↳ formatCss()
 *       ↳ saveCss()
 *       ↳ removeTagsFromHtml()
 *       ↳ injectToHtml()
 *
 *
 * B, Dev server:
 *    1. [hook] configResolved
 *       ↳ setBase()
 *       ↳ setAssetsDir()
 *       ↳ setMinifyCss()
 *       ↳ setResolvedLogger()
 *
 *    2. [hook] configureServer
 *       ↳ setIsDevServer(true)
 *       ↳ setAssetsDir('@webfonts')
 *       ↳ getDevServerMiddlewareCss()
 *       ↳ getDevServerMiddlewareGeneral()
 *
 *    3. [hook] transformIndexHtml
 *       ↳ clearWebfontUrlsHtml()
 *       ↳ collectWebfontsFromHtml()
 *       ↳ removeTagsFromHtml()
 *       ↳ injectToHtml()
 *
 *    4. [middleware] css (@webfonts/webfonts.css)
 *       ↳ loadDevServerFonts()
 *         ↳ downloadWebfontCss()
 *         ↳ parseFontDefinitions()
 *         ↳ replaceFontUrls()
 *         ↳ formatCss()
 *         ↳ fontUrlsDevMap fill
 *       ↳ response: css (text)
 *
 *    5. [middleware] font (assets/xyz.woff2)
 *       ↳ check fontUrlsDevMap
 *       ↳ downloadFont()
 *       ↳ response: font (binary)
 */

function viteWebfontDownload(
	webfontUrls?: string | string[],
	options?: Options
): Plugin {
	const webfontDl = new WebfontDownload(webfontUrls, options);
	const htmlFiles: Map<string, string> = new Map<string, string>();

	return {
		name: 'vite-plugin-webfont-dl',
		enforce: 'post',

		configResolved(resolvedConfig: ResolvedConfig) {
			webfontDl.setBase(resolvedConfig.base);
			webfontDl.setAssetsDir(resolvedConfig.build.assetsDir);
			webfontDl.setCacheDir(resolvedConfig.cacheDir);

			if (resolvedConfig.build.minify === false && !webfontDl.getOptions().minifyCss) {
				webfontDl.setMinifyCss(false);
			}

			webfontDl.setResolvedLogger(resolvedConfig.logger);
		},

		configureServer(viteDevServer: ViteDevServer) {
			webfontDl.setIsDevServer(true);
			webfontDl.setAssetsDir('@webfonts');

			viteDevServer.middlewares.use(
				webfontDl.getBase() + webfontDl.getCssPath(), // /@webfonts/webfonts.css
				(
					request: Connect.IncomingMessage,
					response: ServerResponse
				) => void (webfontDl.getDevServerMiddlewareCss(response))
			);

			viteDevServer.middlewares.use(
				webfontDl.getBase() + webfontDl.getCssFilename(), // /webfonts.css (Laravel Vite Plugin)
				(
					request: Connect.IncomingMessage,
					response: ServerResponse
				) => void (webfontDl.getDevServerMiddlewareCss(response))
			);

			viteDevServer.middlewares.use(
				(
					request: Connect.IncomingMessage,
					response: ServerResponse,
					next: Connect.NextFunction
				) => void (webfontDl.getDevServerMiddlewareGeneral(request, response, next))
			);
		},

		transformIndexHtml(html: string, ctx: IndexHtmlTransformContext) {
			if (!webfontDl.getIsDevServer()) {
				htmlFiles.set(
					ctx.path.replace(/^\//, ''),
					html,
				);
			} else {
				webfontDl.clearWebfontUrlsHtml();
				webfontDl.collectWebfontsFromHtml(html);

				html = webfontDl.removeTagsFromHtml(html);
				html = webfontDl.injectToHtml(html);
			}

			return html;
		},

		async generateBundle(options: NormalizedOutputOptions, bundle: OutputBundle) {
			webfontDl.setEmitFileFunction(
				(emittedFile: EmittedFile) => this.emitFile(emittedFile)
			);

			webfontDl.setGetFilenameFunction(
				(fileReferenceId: string) => this.getFileName(fileReferenceId)
			);

			webfontDl.clearWebfontUrlsHtml();

			htmlFiles.forEach(
				(html) => webfontDl.collectWebfontsFromHtml(html)
			);

			webfontDl.collectWebfontsFromBundleCss(bundle);

			try {
				if (await webfontDl.downloadWebfontCss()) {
					webfontDl.parseFontDefinitions();

					await webfontDl.downloadFonts();

					webfontDl.replaceFontUrls();
					webfontDl.formatCss();

					if (!webfontDl.getOptions().injectAsStyleTag || !htmlFiles.size) {
						webfontDl.saveCss();
					}

					htmlFiles.forEach((html, htmlPath) => {
						const asset = bundle[htmlPath] as OutputAsset;

						if (asset !== undefined) {
							asset.source = webfontDl.removeTagsFromHtml(asset.source as string);
							asset.source = webfontDl.injectToHtml(asset.source);

							htmlFiles.set(htmlPath, asset.source);
						}
					});
				}
			} catch (error) {
				webfontDl.logError(
					colors.red((error as Error).message)
				);

				if (error instanceof AxiosError) {
					if (error.request instanceof ClientRequest) {
						webfontDl.logError(
							colors.red(`${error.request.method} ${error.request.protocol}//${error.request.host}${error.request.path}`)
						);
					}
				}

				if (webfontDl.getOptions().throwError) {
					throw error;
				}
			}
		},
	};
}

export {
	viteWebfontDownload as default,
	viteWebfontDownload as webfontDl,
	viteWebfontDownload as webfontDownload,
	viteWebfontDownload as viteWebfontDl,
	viteWebfontDownload as ViteWebfontDownload,
	viteWebfontDownload,
};
