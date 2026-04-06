/**
 * Shared conversion settings — the options that control how HTML is turned
 * into Markdown.  These settings are common to both the browser extension
 * (src/background/background.js + src/shared/default-options.js) and the
 * Obsidian plugin (obsidian-plugin/src/settings.ts).
 *
 * Front-end-specific options live in their respective modules:
 *   • Browser extension: saveAs, mdClipsFolder, downloadMode, contextMenus, …
 *   • Obsidian plugin:   defaultSaveLocation
 */

export interface SharedConversionOptions {
  // Markdown formatting
  headingStyle: "atx" | "setext";
  hr: string;
  bulletListMarker: "-" | "*" | "+";
  codeBlockStyle: "fenced" | "indented";
  fence: "```" | "~~~";
  emDelimiter: "_" | "*";
  strongDelimiter: "**" | "__";
  linkStyle: "inlined" | "referenced" | "stripLinks";
  linkReferenceStyle: "full" | "collapsed" | "shortcut";
  imageStyle:
    | "markdown"
    | "base64"
    | "originalSource"
    | "noImage"
    | "obsidian"
    | "obsidian-nofolder";
  imageRefStyle: "inlined" | "referenced";
  // Templates
  frontmatter: string;
  backmatter: string;
  title: string;
  includeTemplate: boolean;
  // Files & images
  downloadImages: boolean;
  imagePrefix: string;
  disallowedChars: string;
  turndownEscape: boolean;
}

export const SHARED_DEFAULTS: SharedConversionOptions = {
  headingStyle: "atx",
  hr: "___",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  fence: "```",
  emDelimiter: "_",
  strongDelimiter: "**",
  linkStyle: "inlined",
  linkReferenceStyle: "full",
  imageStyle: "markdown",
  imageRefStyle: "inlined",
  frontmatter:
    "---\ncreated: {date:YYYY-MM-DDTHH:mm:ss} (UTC {date:Z})\ntags: [{keywords}]\nsource: {baseURI}\nauthor: {byline}\n---\n\n# {pageTitle}\n\n> ## Excerpt\n> {excerpt}\n\n---",
  backmatter: "",
  title: "{pageTitle}",
  includeTemplate: false,
  downloadImages: false,
  imagePrefix: "{pageTitle}/",
  disallowedChars: "[]#^",
  turndownEscape: true,
};
