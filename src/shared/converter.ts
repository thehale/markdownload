import { moment } from "obsidian";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
// @ts-ignore – no bundled types for turndown-plugin-gfm
import { gfm } from "turndown-plugin-gfm";
import type { SharedConversionOptions } from "./default-options";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MathInfo {
  tex: string;
  inline: boolean;
}

export interface Article {
  title?: string;
  content?: string;
  textContent?: string;
  length?: number;
  excerpt?: string;
  byline?: string;
  dir?: string;
  siteName?: string;
  lang?: string;
  // Extended metadata set by getArticleFromDom
  baseURI: string;
  pageTitle: string;
  hash?: string;
  host?: string;
  origin?: string;
  hostname?: string;
  pathname?: string;
  port?: string;
  protocol?: string;
  search?: string;
  keywords?: string[];
  math: Record<string, MathInfo>;
  [key: string]: unknown;
}

export interface TurndownResult {
  markdown: string;
  imageList: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRandomId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

function cleanAttribute(attribute: string | null): string {
  return attribute ? attribute.replace(/(\n+\s*)+/g, "\n") : "";
}

function validateUri(href: string, baseURI: string): string {
  try {
    new URL(href);
    return href;
  } catch {
    try {
      const baseUri = new URL(baseURI);
      if (href.startsWith("/")) {
        return baseUri.origin + href;
      }
      const basePath = baseUri.href.endsWith("/")
        ? baseUri.href
        : baseUri.href.substring(0, baseUri.href.lastIndexOf("/") + 1);
      return basePath + href;
    } catch {
      return href;
    }
  }
}

export function generateValidFileName(
  title: string,
  disallowedChars = ""
): string {
  if (!title) return title;
  title = String(title);
  const illegalRe = /[/\\?<>:*|":]/g;
  let name = title
    .replace(illegalRe, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (disallowedChars) {
    for (let c of disallowedChars) {
      if (`[\\^$.|?*+()`.includes(c)) c = `\\${c}`;
      name = name.replace(new RegExp(c, "g"), "");
    }
  }
  return name;
}

function getImageFilename(
  src: string,
  options: { imagePrefix?: string; title: string; disallowedChars?: string },
  prependFilePath = true
): string {
  const slashPos = src.lastIndexOf("/");
  const queryPos = src.indexOf("?");
  let filename = src.substring(
    slashPos + 1,
    queryPos > 0 ? queryPos : src.length
  );

  let imagePrefix = options.imagePrefix || "";

  if (prependFilePath && options.title.includes("/")) {
    imagePrefix =
      options.title.substring(0, options.title.lastIndexOf("/") + 1) +
      imagePrefix;
  } else if (prependFilePath) {
    imagePrefix =
      options.title +
      (imagePrefix.startsWith("/") ? "" : "/") +
      imagePrefix;
  }

  if (filename.includes(";base64,")) {
    filename = "image." + filename.substring(0, filename.indexOf(";"));
  }

  const extension = filename.substring(filename.lastIndexOf("."));
  if (extension === filename) {
    filename = filename + ".png";
  }

  filename = generateValidFileName(filename, options.disallowedChars);
  return imagePrefix + filename;
}

// ─── Template substitution ────────────────────────────────────────────────────

export function textReplace(
  string: string,
  article: Article,
  disallowedChars: string | null = null
): string {
  for (const key in article) {
    if (Object.prototype.hasOwnProperty.call(article, key) && key !== "content") {
      let s = String(article[key] ?? "");
      if (s && disallowedChars) s = generateValidFileName(s, disallowedChars);

      string = string
        .replace(new RegExp(`\\{${key}\\}`, "g"), s)
        .replace(new RegExp(`\\{${key}:lower\\}`, "g"), s.toLowerCase())
        .replace(new RegExp(`\\{${key}:upper\\}`, "g"), s.toUpperCase())
        .replace(
          new RegExp(`\\{${key}:kebab\\}`, "g"),
          s.replace(/ /g, "-").toLowerCase()
        )
        .replace(
          new RegExp(`\\{${key}:mixed-kebab\\}`, "g"),
          s.replace(/ /g, "-")
        )
        .replace(
          new RegExp(`\\{${key}:snake\\}`, "g"),
          s.replace(/ /g, "_").toLowerCase()
        )
        .replace(
          new RegExp(`\\{${key}:mixed_snake\\}`, "g"),
          s.replace(/ /g, "_")
        )
        .replace(
          new RegExp(`\\{${key}:obsidian-cal\\}`, "g"),
          s.replace(/ /g, "-").replace(/-{2,}/g, "-")
        )
        .replace(
          new RegExp(`\\{${key}:camel\\}`, "g"),
          s
            .replace(/ ./g, (str) => str.trim().toUpperCase())
            .replace(/^./, (str) => str.toLowerCase())
        )
        .replace(
          new RegExp(`\\{${key}:pascal\\}`, "g"),
          s
            .replace(/ ./g, (str) => str.trim().toUpperCase())
            .replace(/^./, (str) => str.toUpperCase())
        );
    }
  }

  // Replace {date:FORMAT} tokens
  const now = new Date();
  const dateRegex = /\{date:(.+?)\}/g;
  const matches = string.match(dateRegex);
  if (matches) {
    matches.forEach((match) => {
      const format = match.substring(6, match.length - 1);
      const dateString = moment(now).format(format);
      string = string.split(match).join(dateString);
    });
  }

  // Replace {keywords:SEPARATOR} tokens
  const keywordRegex = /\{keywords:?(.*)?}/g;
  const keywordMatches = string.match(keywordRegex);
  if (keywordMatches) {
    keywordMatches.forEach((match) => {
      let separator = match.substring(10, match.length - 1);
      try {
        separator = JSON.parse(
          JSON.stringify(separator).replace(/\\\\/g, "\\")
        );
      } catch {
        // keep original separator
      }
      const keywordsString = (article.keywords || []).join(separator);
      string = string.replace(
        new RegExp(match.replace(/\\/g, "\\\\"), "g"),
        keywordsString
      );
    });
  }

  // Strip any remaining {placeholder} tokens
  string = string.replace(/\{(.*?)}/g, "");
  return string;
}

// ─── DOM → Article (Readability) ─────────────────────────────────────────────

export function getArticleFromDom(
  domString: string,
  baseUrl: string
): Article | null {
  const parser = new DOMParser();
  const dom = parser.parseFromString(domString, "text/html");

  if (dom.documentElement.nodeName === "parsererror") {
    console.error("MarkDownload: error parsing DOM");
    return null;
  }

  const math: Record<string, MathInfo> = {};

  const storeMathInfo = (el: Element, mathInfo: MathInfo) => {
    const randomId = generateRandomId();
    el.id = randomId;
    math[randomId] = mathInfo;
  };

  // MathJax v2
  dom.body
    .querySelectorAll("script[id^=MathJax-Element-]")
    ?.forEach((mathSource) => {
      const typeAttr = mathSource.getAttribute("type");
      storeMathInfo(mathSource, {
        tex: (mathSource as HTMLElement).innerText,
        inline: typeAttr ? !typeAttr.includes("mode=display") : false,
      });
    });

  // MathJax v3
  dom.body
    .querySelectorAll("[markdownload-latex]")
    ?.forEach((mathJax3Node) => {
      const tex = mathJax3Node.getAttribute("markdownload-latex") || "";
      const display = mathJax3Node.getAttribute("display");
      const inline = !(display && display === "true");
      const mathNode = dom.createElement(inline ? "i" : "p");
      mathNode.textContent = tex;
      mathJax3Node.parentNode?.insertBefore(mathNode, mathJax3Node.nextSibling);
      mathJax3Node.parentNode?.removeChild(mathJax3Node);
      storeMathInfo(mathNode, { tex, inline });
    });

  // KaTeX
  dom.body.querySelectorAll(".katex-mathml")?.forEach((kaTeXNode) => {
    const annotation = kaTeXNode.querySelector("annotation");
    if (annotation) {
      storeMathInfo(kaTeXNode, {
        tex: annotation.textContent || "",
        inline: true,
      });
    }
  });

  // Code language hints – highlight.js style
  dom.body
    .querySelectorAll("[class*=highlight-text],[class*=highlight-source]")
    ?.forEach((codeSource) => {
      const langMatch = codeSource.className.match(
        /highlight-(?:text|source)-([a-z0-9]+)/
      );
      const language = langMatch?.[1];
      if (language && codeSource.firstChild?.nodeName === "PRE") {
        (codeSource.firstChild as Element).id = `code-lang-${language}`;
      }
    });

  // Code language hints – language-* class style
  dom.body.querySelectorAll("[class*=language-]")?.forEach((codeSource) => {
    const langMatch = codeSource.className.match(/language-([a-z0-9]+)/);
    const language = langMatch?.[1];
    if (language) {
      (codeSource as HTMLElement).id = `code-lang-${language}`;
    }
  });

  // Preserve <br> inside <pre> (Readability removes them)
  dom.body.querySelectorAll("pre br")?.forEach((br) => {
    br.outerHTML = "<br-keep></br-keep>";
  });

  // codehilite blocks without language class
  dom.body
    .querySelectorAll(".codehilite > pre")
    ?.forEach((codeSource) => {
      if (
        codeSource.firstChild?.nodeName !== "CODE" &&
        !(codeSource as Element).className.includes("language")
      ) {
        (codeSource as HTMLElement).id = "code-lang-text";
      }
    });

  // Strip heading classes (Readability can remove headings with certain class names)
  dom.body
    .querySelectorAll("h1, h2, h3, h4, h5, h6")
    ?.forEach((header) => {
      (header as HTMLElement).className = "";
      header.outerHTML = header.outerHTML;
    });

  // Prevent Readability from removing the <html> element
  dom.documentElement.removeAttribute("class");

  // Ensure <base> is set so Readability resolves relative links correctly
  let base = dom.querySelector("base");
  if (!base) {
    base = dom.createElement("base");
    dom.head?.appendChild(base);
  }
  base.setAttribute("href", baseUrl);

  // Run Readability
  const readabilityArticle = new Readability(dom).parse();
  if (!readabilityArticle) return null;

  const result: Article = {
    ...readabilityArticle,
    baseURI: baseUrl,
    pageTitle: dom.title || readabilityArticle.title || "",
    math,
  };

  // Attach URL components
  try {
    const url = new URL(baseUrl);
    result.hash = url.hash;
    result.host = url.host;
    result.origin = url.origin;
    result.hostname = url.hostname;
    result.pathname = url.pathname;
    result.port = url.port;
    result.protocol = url.protocol;
    result.search = url.search;
  } catch {
    // non-standard URL – skip
  }

  // Keywords and meta tags
  if (dom.head) {
    const keywordsMeta = dom.head.querySelector('meta[name="keywords"]');
    const keywordsContent = keywordsMeta?.getAttribute("content");
    if (keywordsContent) {
      result.keywords = keywordsContent.split(",").map((s) => s.trim());
    }

    dom.head
      .querySelectorAll(
        "meta[name][content], meta[property][content]"
      )
      ?.forEach((meta) => {
        const key =
          meta.getAttribute("name") || meta.getAttribute("property");
        const val = meta.getAttribute("content");
        if (key && val && !result[key]) {
          result[key] = val;
        }
      });
  }

  return result;
}

// ─── Turndown conversion ──────────────────────────────────────────────────────

export function turndownConvert(
  content: string,
  options: SharedConversionOptions & {
    frontmatter: string;
    backmatter: string;
    title: string;
  },
  article: Article
): TurndownResult {
  const tdService = new TurndownService({
    headingStyle: options.headingStyle,
    hr: options.hr,
    bulletListMarker: options.bulletListMarker,
    codeBlockStyle: options.codeBlockStyle,
    fence: options.fence,
    emDelimiter: options.emDelimiter,
    strongDelimiter: options.strongDelimiter,
    // "stripLinks" is not a TurndownService linkStyle – handle via custom rule
    linkStyle:
      options.linkStyle === "stripLinks" ? "inlined" : options.linkStyle,
    linkReferenceStyle: options.linkReferenceStyle,
  });

  if (!options.turndownEscape) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tdService as any).escape = (s: string) => s;
  }

  tdService.use(gfm);
  tdService.keep(["iframe", "sub", "sup", "u", "ins", "del", "small", "big"]);

  const imageList: Record<string, string> = {};

  // ── Images rule ──────────────────────────────────────────────────────────
  tdService.addRule("images", {
    filter(node: HTMLElement) {
      if (node.nodeName === "IMG" && node.getAttribute("src")) {
        const src = node.getAttribute("src")!;
        node.setAttribute("src", validateUri(src, article.baseURI));

        if (options.downloadImages) {
          let imageFilename = getImageFilename(src, options, false);
          if (!imageList[src] || imageList[src] !== imageFilename) {
            let i = 1;
            while (Object.values(imageList).includes(imageFilename)) {
              const parts = imageFilename.split(".");
              if (i === 1) parts.splice(parts.length - 1, 0, String(i++));
              else parts.splice(parts.length - 2, 1, String(i++));
              imageFilename = parts.join(".");
            }
            imageList[src] = imageFilename;
          }

          const obsidianLink = options.imageStyle.startsWith("obsidian");
          const localSrc =
            options.imageStyle === "obsidian-nofolder"
              ? imageFilename.substring(imageFilename.lastIndexOf("/") + 1)
              : imageFilename
                  .split("/")
                  .map((s) => (obsidianLink ? s : encodeURI(s)))
                  .join("/");

          if (
            options.imageStyle !== "originalSource" &&
            options.imageStyle !== "base64"
          ) {
            node.setAttribute("src", localSrc);
          }
        }
        return true;
      }
      return false;
    },
    replacement(
      _content: string,
      node: HTMLElement,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _opts: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      self: any
    ) {
      if (options.imageStyle === "noImage") return "";
      if (options.imageStyle.startsWith("obsidian"))
        return `![[${node.getAttribute("src")}]]`;

      const alt = cleanAttribute(node.getAttribute("alt"));
      const src = node.getAttribute("src") || "";
      const title = cleanAttribute(node.getAttribute("title"));
      const titlePart = title ? ` "${title}"` : "";

      if (options.imageRefStyle === "referenced") {
        const id = self.references.length + 1;
        self.references.push(`[fig${id}]: ${src}${titlePart}`);
        return `![${alt}][fig${id}]`;
      }
      return src ? `![${alt}](${src}${titlePart})` : "";
    },
    references: [] as string[],
    append(this: { references: string[] }) {
      let refs = "";
      if (this.references.length) {
        refs = "\n\n" + this.references.join("\n") + "\n\n";
        this.references = [];
      }
      return refs;
    },
  } as Parameters<typeof tdService.addRule>[1] & {
    references: string[];
    append: (this: { references: string[] }) => string;
  });

  // ── Links rule ───────────────────────────────────────────────────────────
  tdService.addRule("links", {
    filter(node: HTMLElement) {
      if (node.nodeName === "A" && node.getAttribute("href")) {
        const href = node.getAttribute("href")!;
        node.setAttribute("href", validateUri(href, article.baseURI));
        return options.linkStyle === "stripLinks";
      }
      return false;
    },
    replacement(content: string) {
      return content;
    },
  });

  // ── MathJax/KaTeX rule ───────────────────────────────────────────────────
  tdService.addRule("mathjax", {
    filter(node: HTMLElement) {
      return Object.prototype.hasOwnProperty.call(article.math, node.id);
    },
    replacement(_content: string, node: HTMLElement) {
      const mathInfo = article.math[node.id];
      let tex = mathInfo.tex.trim().replace(/\xa0/g, "");
      if (mathInfo.inline) {
        tex = tex.replace(/\n/g, " ");
        return `$${tex}$`;
      }
      return `$$\n${tex}\n$$`;
    },
  });

  // ── Fenced code block helpers ────────────────────────────────────────────
  function repeat(character: string, count: number): string {
    return Array(count + 1).join(character);
  }

  function convertToFencedCodeBlock(
    node: HTMLElement,
    opts: { fence: string }
  ): string {
    node.innerHTML = node.innerHTML.replace(
      /<br-keep><\/br-keep>/g,
      "<br>"
    );
    const langMatch = node.id?.match(/code-lang-(.+)/);
    const language = langMatch?.[1] ?? "";
    const code = node.innerText ?? node.textContent ?? "";
    const fenceChar = opts.fence.charAt(0);
    let fenceSize = 3;
    const fenceInCodeRegex = new RegExp("^" + fenceChar + "{3,}", "gm");
    let match: RegExpExecArray | null;
    while ((match = fenceInCodeRegex.exec(code)) !== null) {
      if (match[0].length >= fenceSize) fenceSize = match[0].length + 1;
    }
    const fence = repeat(fenceChar, fenceSize);
    return `\n\n${fence}${language}\n${code.replace(/\n$/, "")}\n${fence}\n\n`;
  }

  tdService.addRule("fencedCodeBlock", {
    filter(node: HTMLElement, opts: { codeBlockStyle: string }) {
      return (
        opts.codeBlockStyle === "fenced" &&
        node.nodeName === "PRE" &&
        !!node.firstChild &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement(_content: string, node: HTMLElement, opts: { fence: string }) {
      return convertToFencedCodeBlock(node.firstChild as HTMLElement, opts);
    },
  });

  tdService.addRule("pre", {
    filter(node: HTMLElement) {
      return (
        node.nodeName === "PRE" &&
        (!node.firstChild || node.firstChild.nodeName !== "CODE") &&
        !node.querySelector("img")
      );
    },
    replacement(_content: string, node: HTMLElement, opts: { fence: string }) {
      return convertToFencedCodeBlock(node, opts);
    },
  });

  let markdown =
    options.frontmatter +
    tdService.turndown(content) +
    options.backmatter;

  // Strip non-printing characters (mirrors background.js behaviour)
  markdown = markdown.replace(
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff\ufff9-\ufffc]/g,
    ""
  );

  return { markdown, imageList };
}

// ─── Full pipeline: article → markdown ───────────────────────────────────────

export function convertArticleToMarkdown(
  article: Article,
  settings: SharedConversionOptions,
  title: string
): TurndownResult {
  const options = {
    ...settings,
    title,
    frontmatter: "",
    backmatter: "",
  };

  if (settings.includeTemplate) {
    options.frontmatter = textReplace(settings.frontmatter, article) + "\n";
    options.backmatter = "\n" + textReplace(settings.backmatter, article);
  }

  options.imagePrefix = textReplace(
    settings.imagePrefix,
    article,
    settings.disallowedChars
  )
    .split("/")
    .map((s) => generateValidFileName(s, settings.disallowedChars))
    .join("/");

  return turndownConvert(article.content || "", options, article);
}
