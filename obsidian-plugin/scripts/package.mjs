/**
 * Packages the built plugin files into a distributable zip.
 *
 * Run via `npm run package` (which first builds, then calls this script).
 * The output zip is written to dist/markdownload-obsidian-plugin.zip and
 * contains exactly the three files Obsidian needs:
 *   main.js  manifest.json  styles.css
 */
import { execSync } from "child_process";
import { mkdirSync } from "fs";

mkdirSync("dist", { recursive: true });
execSync(
  "zip -j dist/markdownload-obsidian-plugin.zip main.js manifest.json styles.css",
  { stdio: "inherit" }
);
