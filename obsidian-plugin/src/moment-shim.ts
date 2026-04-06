/**
 * Redirect `import moment from "moment"` to Obsidian's bundled copy.
 * This shim is referenced in esbuild.config.mjs via the `alias` option so
 * that the shared converter imports Obsidian's moment instead of bundling
 * a second copy from npm.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export { moment as default } from "obsidian";
