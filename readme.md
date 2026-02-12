# 🔠 **Webfont Download** Vite Plugin ⚡

[![NPM](https://img.shields.io/npm/v/vite-plugin-webfont-dl)](https://www.npmjs.com/package/vite-plugin-webfont-dl)
[![NPM downloads all-time](https://img.shields.io/npm/dt/vite-plugin-webfont-dl)](https://www.npmjs.com/package/vite-plugin-webfont-dl)
[![NPM downloads last month](https://img.shields.io/npm/dm/vite-plugin-webfont-dl)](https://www.npmjs.com/package/vite-plugin-webfont-dl)

**Automatically collects webfont links, imports, and definitions** from your Vite project, **downloads** CSS and font files (**privacy-first**), adds the fonts to your **bundle** (or serves them through the dev server), and **injects** font definitions using a **non-render-blocking method**. External CSS and font files are stored in a **persistent file cache**, making them available for **offline** development.

<br>

## 📦 Install <span name="install"></span>
```bash
npm i vite-plugin-webfont-dl -D
```

<br>

## 📖 Table of Contents
1. 📦 [Install](#install)
1. Usage:
   * 😎 [Zero config <sub><sup>[method A]</sub></sup>](#zero-config)
   * 🦄 [Simple config <sub><sup>[method B]</sub></sup>](#simple-config)
1. 🚀 [That's all!](#thats-all)
   * 🔌 [Laravel](#laravel)
   * 📸 [Screenshot](#screenshot)
1. 🧩 [Supported webfont providers](#supported-webfont-providers)
1. 🛠️ [Options](#options)
1. ❓ [Third-party webfonts](#third-party-webfonts)
1. 🔮 [How it works](#how-it-works)
   * 📉 [Google Fonts](#google-fonts)
   * 📈 [Webfont-DL Vite plugin](#webfont-dl-vite-plugin)
1. 📊 [Benchmark](#benchmark)
1. 📚 [Resources](#resources)
1. 📄 [License](#license)

<br>

## 😎 Usage: **Zero config** <sub><sup>[method A]</sub></sup> <span name="zero-config"></span>

*Extracts, downloads, and injects fonts from the **original Google Fonts code snippet**.*

1. Select your font families from your [webfont provider](#supported-webfont-providers) (e.g., [Google Fonts](https://fonts.google.com)) and copy the code from the **"Use on the web"** block into your `<head>`:
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400&family=Roboto:wght@100&display=swap" rel="stylesheet">
   ```
2. Add **`webfontDownload`** to your Vite plugins without any configuration. The plugin will automatically handle everything:
   ```js
   // vite.config.js

   import webfontDownload from 'vite-plugin-webfont-dl';

   export default {
     plugins: [
       webfontDownload(),
     ],
   };
   ```
3. The original webfont tags will be replaced in `dist/index.html`:
   ```html
   <style>@font-face{font-family:...;src:url(/assets/foo-xxxxxxxx.woff2) format('woff2'),url(/assets/bar-yyyyyyyy.woff) format('woff')}...</style>
   ```

<br>

## 🦄 Usage: **Simple config** <sub><sup>[method B]</sub></sup> <span name="simple-config"></span>

*Extracts, downloads, and injects fonts from the **configured webfont CSS URL(s)**.*

1. Select your font families from your [webfont provider](#supported-webfont-providers) (e.g., [Google Fonts](https://fonts.google.com)) and copy the **CSS URL(s)** from the **"Use on the web"** code block:
   ```html
   <link href="[CSS URL]" rel="stylesheet">
   ```
2. Add **`webfontDownload`** to your Vite plugins with the selected webfont **CSS URL(s)**:
   ```js
   // vite.config.js

   import webfontDownload from 'vite-plugin-webfont-dl';

   export default {
     plugins: [
       webfontDownload([
         'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap',
         'https://fonts.googleapis.com/css2?family=Fira+Code&display=swap'
       ]),
     ],
   };
   ```

<br>

## 🚀 That's all! <span name="thats-all"></span>
The webfonts are **injected and ready to use**.<br>
The plugin works seamlessly whether you are running a local development server or building for production.

> **💡 Import alias:** The plugin can be imported using any of these names: `webfontDownload`, `webfontDl`, `viteWebfontDl`, `ViteWebfontDownload`, or `viteWebfontDownload`. Use whichever style you prefer!

```css
h1 {
  font-family: 'Press Start 2P', cursive;
}

h2 {
  font-family: 'Fira Code', monospace;
}
```

### 🔌 Laravel <span name="laravel"></span>
To use with the [Laravel Vite Plugin](https://laravel.com/docs/vite), add this line to your Blade file:
```blade
@vite('webfonts.css')
```

### 📸 Screenshot <span name="screenshot"></span>
<img src="./img/terminal.png" width="400" />

<br>

### 🧩 Supported webfont providers <span name="supported-webfont-providers"></span>
- **[Google Fonts](https://fonts.google.com)**: works with [Zero config](#zero-config) or [Simple config](#simple-config)
- **[Bunny Fonts](https://bunny.net/fonts/)**: works with [Zero config](#zero-config) or [Simple config](#simple-config)
- **[Fontshare](https://www.fontshare.com)**: works with [Zero config](#zero-config) or [Simple config](#simple-config)
- **[Fira Code](https://github.com/tonsky/FiraCode)**, **[Hack](https://github.com/source-foundry/Hack)** fonts (`cdn.jsdelivr.net`): works with [Zero config](#zero-config) or [Simple config](#simple-config)
- **[Inter](https://rsms.me/inter/)** font (`rsms.me`): works with [Zero config](#zero-config) or [Simple config](#simple-config)
- *Any provider with CSS containing `@font-face` definitions works with [Simple config](#simple-config)*

<br>

### 🛠️ **Options** <span name="options"></span>

#### Injection Options
- **`injectAsStyleTag`** <small>(`boolean`, default: `true`)</small>
  Inject webfonts as a `<style>` tag (embedded CSS) or as an external `.css` file.

- **`async`** <small>(`boolean`, default: `true`)</small>
  Prevents the use of inline event handlers that can cause Content Security Policy issues.
  ⚠️ Only applicable when `injectAsStyleTag: false`.

#### Build Options
- **`minifyCss`** <small>(`boolean`, default: *value of* `build.minify`)</small>
  Minify CSS code during the build process.

- **`embedFonts`** <small>(`boolean`, default: `false`)</small>
  Embed base64-encoded fonts directly into CSS.
  ⚠️ This can increase file size if CSS contains multiple references to the same font. [Example](https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&display=swap&text=0123456789)

- **`assetsSubfolder`** <small>(`string`, default: `''`)</small>
  Moves downloaded font files to a separate subfolder within the assets directory.

#### Performance Options
- **`cache`** <small>(`boolean`, default: `true`)</small>
  Persistently stores downloaded CSS and font files in a local file cache.
  Respects Vite's `cacheDir` configuration. Set to `false` to disable and delete the existing cache.

- **`subsetsAllowed`** <small>(`string[]`, default: `[]`)</small>
  Restricts downloaded fonts to specified Unicode subsets (e.g., `['latin', 'cyrillic']`).
  Leave empty to allow all subsets.

#### Network Options
- **`proxy`** <small>(`false | AxiosProxyConfig`, default: `false`)</small>
  [Proxy configuration](https://axios-http.com/docs/req_config) for network requests.

#### Error Handling
- **`throwError`** <small>(`boolean`, default: `false`)</small>
  If `true`, stops the build on font download/processing errors.
  If `false`, errors are logged as warnings and the build continues.

#### Example Configuration

```js
// vite.config.js
import webfontDownload from 'vite-plugin-webfont-dl';

export default {
  plugins: [
    webfontDownload([], {
      injectAsStyleTag: true,
      minifyCss: true,
      embedFonts: false,
      async: true,
      cache: true,
      proxy: false,
      assetsSubfolder: 'fonts',
      subsetsAllowed: ['latin', 'latin-ext'],
      throwError: false,
    })
  ],
};
```

**With font URLs:**

```js
webfontDownload([
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
], {
  injectAsStyleTag: true,
  cache: true,
})
```

<br>

### ❓ Third-party webfonts <span name="third-party-webfonts"></span>

⚠️ Using the standard method to add third-party webfonts ([Google Fonts](https://fonts.google.com), [Bunny Fonts](https://bunny.net/fonts/), or [Fontshare](https://www.fontshare.com)) to a webpage can **significantly slow down page load**. **Lighthouse** and **PageSpeed Insights** call them ***"render-blocking resources"***, which means the page can't fully render until the webfonts CSS has been fetched from the remote server.

📈 By avoiding render-blocking resources caused by third-party webfonts, you can **boost page performance**, leading to a **better user experience** and **improved SEO results**.

⚙️ The plugin **downloads the specified fonts from the third-party webfont service (like Google Fonts) and dynamically injects** them (as an internal or external stylesheet) into your Vite project, transforming third-party webfonts into **self-hosted** ones. 🤩

🔐 In addition to the significant **performance increase**, your visitors will also benefit from **privacy protection**, since there is no third-party server involved.

<br>

## 🔮 How it works <span name="how-it-works"></span>

### 📉 **Google Fonts** <span name="google-fonts"></span>

**Google Fonts** generates the following code, which you have to inject into your website's `<head>` (*example*):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Code&display=swap" rel="stylesheet">
```

📱 What happens on the **client-side** with **Google Fonts**:
1. The first line gives a hint to the browser to begin the connection handshake (DNS, TCP, TLS) with `fonts.googleapis.com`. This happens in the background to improve performance. [**`preconnect`**]
1. The second line is another preconnect hint to `fonts.gstatic.com`. [**`preconnect`**]
1. The third line instructs the browser to load and use a CSS stylesheet file from `fonts.googleapis.com` (with [`font-display:swap`](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display#values)). [**`stylesheet`**]
1. The browser downloads the CSS file and starts to parse it. The parsed CSS is a set of `@font-face` definitions containing font URLs from the `fonts.gstatic.com` server.
1. The browser starts to download all relevant fonts from `fonts.gstatic.com`.
1. After the fonts are successfully downloaded, the browser swaps the fallback fonts for the downloaded ones.

### 🆚

### 📈 **Webfont-DL** Vite Plugin <span name="webfont-dl-vite-plugin"></span>

In contrast, the **Webfont-DL plugin** does most of the work at build time, leaving minimal work for the browser.

**Webfont-DL plugin**
- Collects the webfont CSS URLs (from plugin config, `index.html`, and generated CSS)
- Downloads the webfont CSS file(s)
- Extracts the font URLs
- Downloads the fonts
- Adds the fonts to the bundle
- Generates embedded CSS (`<style>` tag) **or** an external webfont CSS file
- Adds the fonts and CSS to the bundle and injects the following code into your website's `<head>` using a non-render-blocking method (*example*):

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
**Or** (using the dev server or `injectAsStyleTag: false` option):

```html
<link rel="preload" as="style" href="/assets/webfonts.b904bd45.css">
<link rel="stylesheet" media="print" onload="this.onload=null;this.removeAttribute('media');" href="/assets/webfonts.b904bd45.css">
```

📱 What happens on the **client-side** with the **Webfont-DL plugin**:

1. Loads fonts from the embedded CSS (`<style>` tag).

**Or**

1. The first line instructs the browser to prefetch a CSS file for later use as a stylesheet. [**`preload`**]
2. The second line instructs the browser to load and use that CSS file as a `print` stylesheet (non-render-blocking). After loading, it is promoted to an `all` media type stylesheet (by removing the `media` attribute). [**`stylesheet`**]


<br>

## 📊 Benchmark <span name="benchmark"></span>
Comparison using a [starter Vite project](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-vanilla):

| [▶️ Standard **Google Fonts**](https://web.dev/measure/?url=https%3A%2F%2Fwebfont.feat.agency%2F) | 🆚 | [▶️ **Webfont DL** Vite plugin](https://web.dev/measure/?url=https%3A%2F%2Fwebfont-dl.feat.agency%2F) |
|:---:|:---:|:---:|
| [🔗 webfont.feat.agency](https://webfont.feat.agency) | | [🔗 webfont-dl.feat.agency](https://webfont-dl.feat.agency) |

![Compare](./img/compare.png)

<br>

## 📚 Resources <span name="resources"></span>
* [Page Speed Checklist / Fix & Eliminate Render Blocking Resources](https://pagespeedchecklist.com/eliminate-render-blocking-resources)

<br>

## 📄 License <span name="license"></span>

MIT License © 2022 [feat.](https://feat.agency)


