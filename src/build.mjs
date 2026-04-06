/**
 * esbuild configuration for the browser extension background script.
 *
 * Input:  src/background/background.ts  (imports from ../shared/ + npm)
 * Output: src/background/background.bundle.js  (IIFE, loaded by manifest.json)
 *
 * The `browser` global comes from `browser-polyfill.min.js` which is listed
 * first in manifest.json; we do NOT bundle the polyfill a second time.
 */

import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["background/background.ts"],
  bundle: true,
  // `browser` is provided at runtime by browser-polyfill.min.js (loaded
  // before this bundle by manifest.json).  Marking the npm package external
  // prevents a second copy from being bundled while still letting TypeScript
  // resolve the type declarations via globals.d.ts.
  external: ["webextension-polyfill", ...builtins],
  format: "iife",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "background/background.bundle.js",
  minify: prod,
});

process.exit(0);
