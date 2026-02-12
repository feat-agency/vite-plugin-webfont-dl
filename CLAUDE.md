# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`vite-plugin-webfont-dl` is a Vite plugin that downloads webfonts from third-party providers (Google Fonts, Bunny Fonts, Fontshare, jsDelivr, rsms.me) and self-hosts them. This eliminates render-blocking external requests, improves page load performance, and protects user privacy by preventing third-party tracking.

**Core functionality:**
- Extracts webfont URLs from HTML `<link>` tags, plugin config, and CSS `@import` statements
- Downloads webfont CSS and parses `@font-face` definitions
- Downloads font files (woff2, woff, ttf, otf, eot, svg)
- Transforms CSS to reference local paths or embed fonts as base64
- Injects fonts into HTML as `<style>` tags or external CSS files
- Persistent file caching for offline development

## Commands

**Build:**
```bash
npm run build          # Production build with tsup (minified CJS + ESM + types)
npm start              # Watch mode for development
```

**Lint:**
```bash
npm run lint           # TypeScript check + ESLint (read-only)
npm run lint:fix       # ESLint with auto-fix
```

**Test:**
```bash
npm test               # Run all Vitest tests
```

## Architecture Overview

### Entry Point: src/index.ts

The main plugin file exports a Vite Plugin that implements four hooks:

1. **`configResolved`**: Captures Vite config (base URL, assets directory, minify settings, logger)
2. **`configureServer`**: Sets up dev server middleware for serving fonts dynamically
3. **`transformIndexHtml`**: Processes HTML files to extract and inject font references
4. **`generateBundle`**: Main build-time processing (download, parse, transform, inject)

**Critical detail**: The plugin has two completely different execution flows:
- **Build mode**: Pre-downloads all fonts at bundle generation time
- **Dev server mode**: Serves fonts on-demand via middleware, lazy-loading as needed

### Core Orchestrator: src/webfont-download.ts

The `WebfontDownload` class is the central coordinator that:
- Manages three webfont URL sources:
  1. **Plugin config**: URLs passed to the plugin constructor
  2. **HTML extraction**: `<link>` tags parsed from HTML files
  3. **CSS extraction**: `@import` statements found in bundled CSS
- Coordinates all components in sequence
- Maintains the font collection (Map<filename, Font>)
- Handles both dev server middleware and build-time processing
- Generates cache hit statistics for performance transparency

### Component Architecture (src/components/)

The plugin uses a component-based architecture with single-responsibility classes:

#### css-loader.ts
**Purpose**: Downloads webfont CSS from providers and normalizes URLs

**Key implementation details:**
- Uses FileCache for persistent storage
- **URL normalization edge cases**:
  - Protocol-relative URLs (`//fonts.googleapis.com/...`) → prefixed with `https:`
  - Relative URLs (`../fonts/`, `./fonts/`, `fonts/`) → resolved to absolute URLs using CSS file's origin
  - Fully-qualified URLs → used as-is
- Flash logging shows download progress in terminal

#### css-parser.ts
**Purpose**: Parses CSS to extract font URLs and `@font-face` definitions

**Key implementation details:**
- **Two regex patterns for font URLs**:
  1. Standard font URLs: `https://fonts.gstatic.com/.../font.woff2`
  2. Google Fonts Kit URLs: `https://fonts.gstatic.com/l/font?kit=...` (special format)
- **Google Fonts Kit handling**:
  - Extracts `kit` parameter as filename
  - If kit string >50 chars, generates SHA1 hash as filename
  - Always uses `.woff2` extension
- **Subset filtering**:
  - Google Fonts CSS includes comments like `/* latin */` before `@font-face` blocks
  - When `subsetsAllowed` option is set, only fonts with matching comment tags are included
  - Reduces font files downloaded by filtering out unwanted language subsets
- **`parseBundleCss` method** (separate from `parse`):
  - Scans user's bundled CSS for webfont references
  - Extracts both `@font-face` definitions and `@import` statements
  - Only processes fonts from whitelisted providers (security measure)
  - Handles three `@import` syntax variants:
    - `@import url('...');`
    - `@import"...";`
    - `@import '...';`
- **Provider whitelist**: Google Fonts, Bunny Fonts, Fontshare, Google Fonts Static
- Returns deduplicated fonts via Map (filename as key ensures uniqueness)

#### css-transformer.ts
**Purpose**: Replaces remote font URLs with local paths or embeds as base64

**Key implementation details:**
- **Two transformation modes**:
  1. **URL replacement**: Replaces `https://fonts.gstatic.com/.../font.woff2` with `/assets/font.woff2`
  2. **Base64 embedding**: Converts font to `data:font/woff2;base64,...`
- **MIME type mapping**: Each font extension has correct MIME type (woff2→font/woff2, svg→image/svg+xml, etc.)
- **Regex escaping**: Font URLs are escaped before regex replacement to handle special characters in query strings
- **Minification**: Uses CleanCSS library, only applied in build mode when `minifyCss: true`

#### css-injector.ts
**Purpose**: Injects transformed CSS into HTML

**Key implementation details:**
- **Three injection modes**:
  1. **Inline style tag** (default): `<style>...</style>` in `<head>`
  2. **Async external stylesheet**: Uses `media="print"` trick with `onload` handler for non-blocking load
  3. **Sync external stylesheet**: Standard `<link rel="stylesheet">`
- **Indentation preservation**:
  - Regex captures existing indentation from `</head>` tag
  - Injects CSS with matching indentation to preserve HTML formatting
  - For minified HTML/CSS, injects without extra whitespace
- **Async loading technique**:
  ```html
  <link rel="preload" as="style" href="/assets/webfonts.css">
  <link rel="stylesheet" media="print" onload="this.onload=null;this.removeAttribute('media');" href="/assets/webfonts.css">
  ```
  - First link preloads the CSS file
  - Second link loads as print media (non-blocking), then promotes to all media via JS

#### font-loader.ts
**Purpose**: Downloads font binary files

**Key implementation details:**
- Simple wrapper around Downloader with FileCache integration
- Uses flash logging to show progress
- Returns Buffer for binary font data

#### index-html-processor.ts
**Purpose**: Extracts webfont `<link>` tags from HTML and removes them

**Key implementation details:**
- **Handles both attribute orders**:
  - `<link rel="stylesheet" href="...">`
  - `<link href="..." rel="stylesheet">`
- **Supports 5 providers**: Google Fonts, Bunny Fonts, Fontshare, jsDelivr, rsms.me (Inter font)
- **Comment detection**: Skips tags inside HTML comments
  - Regex captures `(<!--.*?)?` before `<link>`
  - Checks if captured group contains `-->` to determine if tag is commented out
  - Only processes uncommented tags
- **Removes preconnect hints**: Also removes `<link rel="preconnect">` tags for font domains
- **Newline cleanup**: When removing tags, also removes trailing newlines to avoid blank lines in output

#### downloader.ts
**Purpose**: HTTP client for downloading CSS and fonts

**Key implementation details:**
- **User-Agent**: Uses Chrome 77 UA string to ensure Google Fonts serves woff2 format
  - `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.0.0 Safari/537.36`
- **IPv4-only**: Sets `family: 4` on HTTP agents to avoid IPv6 connection issues
- **Keep-alive connections**: Reuses TCP connections for better performance
- **Retry logic**:
  - Max 3 attempts per request
  - Random wait interval between retries: 25-2500ms
  - Logs success with try number if retry was needed
  - Throws error after 3 failed attempts
- **Timeout**: 2500ms per request
- **Proxy support**: Accepts AxiosProxyConfig for corporate proxy environments
- **Response types**:
  - Default: `arraybuffer` (for binary fonts)
  - Optional: `text` (for CSS files)

#### file-cache.ts
**Purpose**: Persistent file-based cache for CSS and fonts

**Key implementation details:**
- **Cache location**: `node_modules/.vite/cache/`
- **Cache versioning**: Filename includes plugin version (`plugin-webfont-dl_${version}.json`)
  - Automatically invalidates cache when plugin updates
  - Prevents issues from format changes between versions
- **Dual data types**:
  - CSS: Stored as strings
  - Fonts: Stored as Buffers
- **Buffer serialization**:
  - flat-cache stores everything as JSON
  - Buffers are serialized as `{type: 'Buffer', data: [...]}`
  - Deserialized back to Buffer on retrieval using `Buffer.from()`
- **Cache hit tracking**: Maintains separate counters for CSS and font cache hits
- **Cache clearing**: When `cache: false`, existing cache is deleted on initialization
- **Save strategy**: Saves immediately after each write (`cache.save(true)`)

#### logger.ts
**Purpose**: Logging with Vite integration and TTY support

**Key implementation details:**
- **Flash line feature**: Shows transient progress messages
  - Only works in TTY environments (not in CI)
  - Clears line after 500ms timeout
  - Truncates output to terminal width to prevent wrapping
  - Falls back to regular logging in non-TTY environments
- **Prefix**: All messages prefixed with `[webfont-dl]` in dim color
- **Vite logger integration**: Uses Vite's logger when available for consistency
- **TTY detection**: Checks `stdout.isTTY && !env.CI` to determine terminal capabilities

#### default-options.ts
**Purpose**: Default configuration values

**Default values:**
```typescript
{
  injectAsStyleTag: true,    // Inline CSS in <style> tag
  minifyCss: true,           // Minify CSS (overridden by build.minify)
  embedFonts: false,         // Don't embed as base64
  async: true,               // Use async loading for external CSS
  cache: true,               // Enable persistent cache
  proxy: false,              // No proxy
  assetsSubfolder: '',       // No subfolder
  throwError: false,         // Log errors as warnings, don't stop build
  subsetsAllowed: [],        // Allow all subsets
}
```

## Critical Implementation Details

### Font Collection Management
- **Data structure**: `Map<string, Font>` where key is filename
- **Why Map**: Ensures uniqueness, prevents duplicate downloads
- **Filename collision**: Later fonts with same filename overwrite earlier ones (intentional)

### URL Path Handling
Multiple path variables interact:
- **`base`**: Vite's base URL (e.g., `/` or `/app/`)
- **`assetsDir`**: Output directory for assets (e.g., `assets`), changes in dev mode to `@webfonts`
- **`assetsSubfolder`**: Optional user-configured subfolder within assets
- **Security**: `assetsSubfolder` is sanitized:
  - Leading/trailing slashes removed
  - Path traversal (`../`) blocked, reverts to empty string

### Dev Server vs Build Mode

**Build Mode** (`isDevServer = false`):
- All fonts pre-downloaded during `generateBundle` hook
- CSS can be inline `<style>` or external `.css` file
- Font paths include `base` and `assetsDir`

**Dev Server Mode** (`isDevServer = true`):
- `assetsDir` changed to `@webfonts` (virtual directory)
- Two middleware handlers:
  1. CSS handler: `/@webfonts/webfonts.css` and `/webfonts.css` (Laravel compat)
  2. Font handler: Matches font requests against `fontUrlsDevMap`
- Fonts downloaded on-demand when requested
- CSS is always external, never inline
- Font downloads cached in `fontUrlsDevMap` for subsequent requests

### Error Handling
- **`throwError` option**: Controls build behavior on errors
  - `false` (default): Logs error as warning, continues build
  - `true`: Throws error, stops build
- **Axios errors**: Extracts request details (method, protocol, host, path) for debugging
- **Graceful degradation**: If fonts fail to download, build continues without them (unless `throwError: true`)

### HTML Processing Edge Cases
- **Commented tags**: `<!-- <link href="..."> -->` are ignored
- **Multi-line comments**: Handles comments spanning multiple lines
- **Nested HTML**: Regex handles complex HTML structures
- **Self-closing tags**: Supports both `<link>` and `<link />`
- **Quote variations**: Handles single quotes, double quotes, and no quotes

### CSS Parsing Edge Cases
- **Protocol-relative URLs**: `//fonts.googleapis.com/...` converted to `https://...`
- **Relative paths**: Resolved relative to CSS file's location
- **Query strings**: Preserved in font URLs (e.g., `?v=7.0.96`)
- **Google Fonts Kit URLs**: Special handling for `?kit=` parameter
- **Unicode ranges**: Preserved in `@font-face` definitions
- **Subset comments**: Used for filtering, preserved in output

### Indentation Preservation
The injector preserves HTML indentation for aesthetic reasons:
```typescript
// Captures indentation from </head> tag
/([ \t]*)<\/head>/

// Injects with matched indentation
`$1$1<style>\n${css.replace(/^/gm, '$1$1$1')}\n$1$1</style>\n$1</head>`
```
For minified HTML, injects without extra whitespace.

## Testing

### Test Structure
- **Location**: `test/` directory
- **Fixtures**: `test/fixtures/` contains sample HTML and CSS files
- **Framework**: Vitest 4
- **Configuration**: `vitest.config.ts` sets test directory and `src/` alias for imports

### Test Categories
1. **Component tests**: Each component has dedicated test file
   - `css-loader.test.ts`: URL normalization
   - `css-parser.test.ts`: Font extraction, subset filtering
   - `css-transformer.test.ts`: URL replacement, base64 embedding, minification
   - `css-injector.test.ts`: HTML injection, indentation preservation
   - `index-html-processor.test.ts`: Tag extraction and removal for all providers
   - `save.test.ts`: File emission and path generation

2. **Fixture files**: Real-world examples
   - `google-fonts.css`: Full Google Fonts CSS with all subsets
   - `google-fonts-kit.css`: Google Fonts Kit URL format
   - `imports.css`: Three `@import` syntax variants
   - `pre-normalization.css` / `post-normalization.css`: URL resolution examples
   - HTML fixtures for each provider (Google, Bunny, Fontshare, jsDelivr, rsms.me)

### Key Test Patterns
- **Snapshot testing**: Compares transformed output to expected fixtures
- **Subset filtering**: Verifies only specified subsets are included
- **Indentation tests**: Checks both formatted and minified HTML
- **Provider coverage**: Tests all supported webfont providers
- **Comment handling**: Verifies commented tags are ignored

## Build Configuration

### tsup (tsup.config.ts)
- **Entry**: `src/index.ts`
- **Formats**: CJS (`.js`) and ESM (`.mjs`)
- **Type definitions**: Generated (`.d.ts`)
- **Minification**: Only in production (disabled in watch mode)
- **Clean**: Removes `dist/` before each build

### Output Structure
```
dist/
├── index.js      # CommonJS
├── index.mjs     # ESM
└── index.d.ts    # TypeScript definitions
```

### Module Exports
```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "require": "./dist/index.js",
    "import": "./dist/index.mjs"
  }
}
```

Multiple export names for flexibility:
- `default` (main export)
- `webfontDl`
- `webfontDownload`
- `viteWebfontDl`
- `ViteWebfontDownload`
- `viteWebfontDownload`

## Code Style and Linting

### ESLint Configuration (eslint.config.mjs)
- **Extends**:
  - `eslint:recommended`
  - `@typescript-eslint/recommended-type-checked`
  - `@typescript-eslint/stylistic-type-checked`
- **Parser**: TypeScript ESLint parser with type-aware linting
- **Rules**:
  - Trailing commas required in multiline constructs
  - Single quotes preferred
  - Semicolons required
  - Semicolon spacing enforced
- **Ignores**: `dist/`, `node_modules/`

### TypeScript Configuration
- **Target**: ES2018
- **Module**: ESNext with Node resolution
- **Strict mode**: Enabled with strict null checks
- **noUnusedLocals**: Enforced for clean code
- **Include**: `src/`, `test/`, config files
- **Exclude**: `dist/`

## Important Patterns and Conventions

### When Adding New Webfont Providers
1. Add URL patterns to `IndexHtmlProcessor.webfontRegexes` (both attribute orders)
2. Add domain to `IndexHtmlProcessor.preconnectRegexes`
3. Add domain to `CssParser.webfontProviders` whitelist
4. Create fixture files in `test/fixtures/`
5. Add tests in `test/index-html-processor.test.ts`

### When Modifying CSS Parsing
- Be aware of URL normalization edge cases
- Test with protocol-relative and relative URLs
- Consider Google Fonts Kit URL format
- Verify subset filtering still works
- Check that duplicate filenames are handled correctly

### When Changing Injection Logic
- Test both minified and formatted HTML
- Verify indentation preservation
- Test all three injection modes (inline, async, sync)
- Check that base paths are correctly applied

### When Working with Cache
- Cache filename includes version - increment version on breaking changes
- Test both string (CSS) and Buffer (font) serialization
- Remember cache is disabled in tests by default

### Dev Server Considerations
- Middleware runs before Vite's built-in middleware
- Dev server uses virtual `@webfonts/` directory
- Laravel Vite Plugin compatibility requires `/webfonts.css` route
- Font URLs are stored in `fontUrlsDevMap` for on-demand serving
- Dev server never uses inline styles, always external CSS

### Security Considerations
- Path traversal in `assetsSubfolder` is blocked
- Only whitelisted providers are processed from user CSS
- HTML comment tags are ignored to prevent injection via comments
