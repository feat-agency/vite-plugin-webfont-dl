# Examples

Minimal projects showing the different ways to use `vite-plugin-webfont-dl`. Each one is a complete, runnable Vite project.

| Example | Shows | Fonts come from |
|---|---|---|
| [`vanilla`](./vanilla) | Zero config | `<link>` tags in `index.html` |
| [`vue`](./vue) | Simple config | URL passed to the plugin in `vite.config.js` |
| [`react`](./react) | CSS `@import` detection | `@import` in `src/index.css` |
| [`svelte`](./svelte) | Options (`injectAsStyleTag: false`, `subsetsAllowed`) | `<link>` tags in `index.html` |
| [`react-router`](./react-router) | `fontDefinitionsInCss` for frameworks that render HTML outside of Vite | `@import` in `app/app.css` |

## Running an example

The examples use the plugin from this repository (`"vite-plugin-webfont-dl": "file:../.."`), so build it first:

```bash
# in the repository root
npm install
npm run build

# in an example directory
cd examples/vanilla
npm install
npm run dev      # dev server
npm run build    # production build
```

To use an example as a starting point for your own project, replace the `file:../..` dependency with the published package:

```bash
npm i -D vite-plugin-webfont-dl
```

## Verifying the output

`check.mjs` verifies a production build: it fails if the output has no `@font-face` rule, if a font URL points at a missing file, or if anything still loads from a webfont provider.

```bash
node check.mjs vanilla/dist
node check.mjs react-router/build/client
```

CI builds and checks every example, and builds the `vanilla` example with every supported Vite major.
