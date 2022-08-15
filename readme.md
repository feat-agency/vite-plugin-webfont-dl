# 🔌 **Webfont DL** - Vite plugin ⚡

[![NPM](https://img.shields.io/npm/v/vite-plugin-webfont-dl)](https://www.npmjs.com/package/vite-plugin-webfont-dl)
[![NPM downloads](https://img.shields.io/npm/dt/vite-plugin-webfont-dl)](https://www.npmjs.com/package/vite-plugin-webfont-dl)


### **Make your Vite site load faster & boost SEO performance 🚀**

⚠️ Using the standard method to add Google Fonts into a webpage can **slow down page load significantly.** **Lighthouse** and **PageSpeed Insights** audit calls this a **<i>"render-blocking resource"</i>**, which means that the page can't load until the font has been fetched from the Google Fonts server.

📈 By avoiding render-blocking resources caused by Google Fonts loading, you can **boost page performance** which leads to **better user-experience** and **improves SEO results**. 🔎

<br>

### **Eliminate Render-Blocking Resources caused by Google Fonts 🔝**

**💡 Webfont-DL plugin let's you leverage the flexibility of Google Fonts without trade-offs when it comes to page perfomance.**

⚙️ The plugin **downloads the given fonts from Google Fonts and dynamically injects** them into your Vite project.

<br>

## 📦 Install
```bash
npm i vite-plugin-webfont-dl -D
```

<br>

## 😎 Usage: **Zero config**

*Extracts, downloads and injects fonts from the **original Google Fonts code snippet**.*

0. Select your font families at [Google Fonts](https://fonts.google.com) and copy the code into `<head>` from the **<i>"Use on the web"</i>** block:
	```html
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400&family=Roboto:wght@100&display=swap" rel="stylesheet">
	```
1. Add **`ViteWebfontDownload`** to your Vite plugins without any configuration and the plugin automagically will take care of everything:
	```js
	// vite.config.js

	import { ViteWebfontDownload } from 'vite-plugin-webfont-dl';

	export default {
	  plugins: [
	    ViteWebfontDownload(),
	  ],
	};
	```

<br>

## 🦄 Usage: **Simple config**

*Extracts, downloads and injects fonts from the **configured webfont CSS URL(s)**.*

0. Select your font families at [Google Fonts](https://fonts.google.com) and copy the **CSS URL**(s) from the **<i>"Use on the web"</i>** code block:
	```html
	<link href="[CSS URL]" rel="stylesheet">
	```
1. Add **`ViteWebfontDownload`** to your Vite plugins with the selected Google Fonts **CSS URL**(s):
	```js
	// vite.config.js

	import { ViteWebfontDownload } from 'vite-plugin-webfont-dl';

	export default {
	  plugins: [
	    ViteWebfontDownload([
	      'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap',
	      'https://fonts.googleapis.com/css2?family=Fira+Code&display=swap'
	    ]),
	  ],
	};
	```

<br>

## 🚀 That's all!
From here the fonts are injected and available globally. Plugin works seamlessly even when working on local development server.


```css
h1 {
  font-family: 'Press Start 2P', cursive;
}

h2 {
  font-family: 'Fira Code', monospace;
}
```

<br>

## 📈 Benchmark
[Starter Vite project](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-vanilla) with

| [▶️ Standard **Google Fonts**](https://pagespeed.web.dev/report?url=https%3A%2F%2Fwebfont.feat.agency%2F) | 🆚 | [▶️ **Webfont DL** Vite plugin](https://pagespeed.web.dev/report?url=https%3A%2F%2Fwebfont-dl.feat.agency%2F) |
|:---:|:---:|:---:|
| [🔗 webfont.feat.agency](https://webfont.feat.agency) | | [🔗 webfont-dl.feat.agency](https://webfont-dl.feat.agency) |

![Compare](./img/compare.png)


## 🔮 How it works

### **Google Fonts** 📉

**Google Fonts** generates the following code which you have to inject into your website's `<head>` <i>(example)</i>:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Code&display=swap" rel="stylesheet">
```

📱 What happens on client-side with **Google Fonts**:
1. First line gives a hint to the browser to begin the connection handshake <i>(DNS, TCP, TLS)</i> with `fonts.googleapis.com`. This happens in the background to improve performance. [**`preconnect`**]
1. Second line is another preconnect hint to `fonts.gstatic.com`. [**`preconnect`**]
1. Third line instructs the browser to load and use a CSS stylesheet file from `fonts.googleapis.com` <i>(with [`font-display:swap`](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display#values))</i>. [**`stylesheet`**]
1. The browser downloads the CSS file and starts to parse it. The parsed CSS is a set of `@font-face` definitions containing font URLs from `fonts.gstatic.com` server.
1. The browser starts to download the all relevant fonts from `fonts.gstatic.com`.
1. After the successful fonts download the browser swaps the fallback fonts to the downloaded ones.

### 🆚

### **Webfont-DL** Vite plugin 📈

On the contrary, **Webfont-DL plugin** does most of the job at build time, leaves the minimum to the browser.

**Webfont-DL plugin** downloads the Google Fonts CSS file(s), extracts the font URLs, downloads the fonts, generates an inline style tag **or** a webfont CSS file, add them to the bundle and injects the following code into your website's `<head>` using a non-render blocking method <i>(example)</i>:

```html
<style>
	@font-face {
		font-family: 'Fira Code';
		font-style: normal;
		font-weight: 300;
		font-display: swap;
		src: url(/assets/uU9eCBsR6Z2vfE9aq3bL0fxyUs4tcw4W_GNsJV37Nv7g.9c348768.woff2) format('woff2');
		unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
	}
	...
</style>
```
**or**

```html
<link rel="preload" as="style" href="/assets/webfonts.b904bd45.css">
<link rel="stylesheet" media="print" onload="this.onload=null;this.removeAttribute('media');" href="/assets/webfonts.b904bd45.css">
```

📱 What happens on client-side with **Webfont-DL plugin**:

1. Load fonts from the `inline style tag`.

**or**

1. First line instructs the browser to prefetch a CSS file for later use as stylesheet. [**`preload`**]
1. Second line instructs the browser to load and use that CSS file as a "`print`" stylesheet <i>(non-render blocking)</i>. After loading it promote to "`all`" media type stylesheet (by removing the "`media`" attribute). [**`stylesheet`**]

<br>

### 🛠️ **Options**
```js
ViteWebfontDownload(
  [
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap'
  ],
  {
	injectAsStyleTag: true,
    async: true
  }
)
```

**or**

```js
ViteWebfontDownload(
  [],
  {
	injectAsStyleTag: true,
    async: true
  }
)
```

**`injectAsStyleTag`**: inject webfonts as `<style>` tag or as an external `.css` file
**`async`**: prevent the usage of inline event handlers that can cause Content Security Policy issues (has no effect when `injectAsStyleTag` is `true`)

## 📚 Resources
* [Page Speed Checklist / Fix & Eliminate Render Blocking Resources](https://pagespeedchecklist.com/eliminate-render-blocking-resources)


## 📄 License

MIT License © 2022 [feat.](https://feat.agency)


