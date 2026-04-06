/**
 * Ambient type declarations for the browser extension global scope.
 *
 * `browser` is injected at runtime by `browser-polyfill.min.js`, which is
 * loaded as the first background script in manifest.json.  We declare it as
 * a global here so TypeScript knows its shape without bundling the polyfill
 * a second time.
 */

// CommonJS-style import needed because @types/webextension-polyfill uses `export =`
import Browser = require("webextension-polyfill");

declare global {
  /**
   * The webextension browser API, provided at runtime by browser-polyfill.min.js.
   * `Browser.Browser` is the interface for the global `browser` object.
   */
  const browser: Browser.Browser;
}
