# ESM Shared Core Migration

This branch migrates the browser extension to ESM/TypeScript so both the extension and the Obsidian plugin share the same core conversion logic.

## What changed

### Shared (`src/shared/`)

| File | Change |
|---|---|
| `converter.ts` | Now imports `moment` from npm instead of `obsidian`, making it truly platform-independent |
| `default-options.ts` | No change — already the canonical shared source |

### Browser Extension (`src/`)

| File | Change |
|---|---|
| `background/background.ts` | **New** — TypeScript replacement for `background.js`; imports from `src/shared/converter.ts` and `src/shared/default-options.ts` |
| `background/context-menus.ts` | **New** — Moved from `shared/context-menus.js`; TypeScript module with proper imports |
| `background/extension-options.ts` | **New** — `ExtensionOptions` interface (extends `SharedConversionOptions`) + `getOptions()` |
| `background/apache-mime-types.ts` | **New** — Converted from `apache-mime-types.js`; now an ES module |
| `globals.d.ts` | **New** — Ambient `browser` global declaration using `@types/webextension-polyfill` |
| `tsconfig.json` | **New** — TypeScript compiler config |
| `build.mjs` | **New** — esbuild config; bundles `background.ts` and its deps into `background.bundle.js` |
| `package.json` | **Updated** — Added esbuild, typescript, @mozilla/readability, turndown, moment as deps |
| `manifest.json` | **Updated** — Background scripts simplified to `browser-polyfill.min.js` + `background.bundle.js` |
| `.gitignore` | **New** — Excludes `background.bundle.js` (build artifact) and `node_modules/` |

**Removed** (replaced by npm packages bundled via esbuild):
- `background/background.js` → `background/background.ts`
- `background/moment.min.js` → npm `moment`
- `background/turndown.js` → npm `turndown`
- `background/turndown-plugin-gfm.js` → npm `turndown-plugin-gfm`
- `background/Readability.js` → npm `@mozilla/readability`
- `shared/context-menus.js` → `background/context-menus.ts`

### Obsidian Plugin (`obsidian-plugin/`)

| File | Change |
|---|---|
| `src/moment-shim.ts` | **New** — Re-exports `moment` from Obsidian's bundled copy |
| `esbuild.config.mjs` | **Updated** — Aliases `moment` → `moment-shim.ts` so the shared converter uses Obsidian's moment (no double-bundling) |
| `package.json` | **Updated** — Added `moment` as devDependency for type-checking the shim |

### CI (`.github/workflows/`)

| File | Change |
|---|---|
| `build-extension.yml` | **New** — Runs `tsc --noEmit` + `npm run build` on every push/PR that touches `src/`; uploads extension artifact |

## Building

```sh
cd src
npm install
npm run build   # produces src/background/background.bundle.js
```

## Architecture

```
src/shared/converter.ts        ← canonical conversion logic (Readability + Turndown)
src/shared/default-options.ts  ← canonical shared settings (SharedConversionOptions)
         ↑                              ↑
obsidian-plugin/src/...        src/background/background.ts
         (Obsidian plugin)             (browser extension background script)
```

The browser extension's options page (`options/options.html`) still loads
`src/shared/default-options.js` via a `<script>` tag (a planned follow-up converts
the options page to use the bundler too).
