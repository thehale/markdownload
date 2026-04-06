import { getOptions, EXTENSION_DEFAULTS, ExtensionOptions } from "./extension-options";
import { createMenus } from "./context-menus";
import {
  getArticleFromDom,
  convertArticleToMarkdown,
  textReplace,
  generateValidFileName,
  Article,
  TurndownResult,
} from "../shared/converter";
import { mimedb } from "./apache-mime-types";

// ─── Minimal structural types (from webextension-polyfill API shapes) ─────────

/** Minimum shape of a browser Tab needed by this module. */
interface Tab {
  id?: number;
  url?: string;
  title?: string;
}

/** A context menu click info object. */
interface MenuInfo {
  menuItemId: string | number;
  linkUrl?: string;
  linkText?: string;
  selectionText?: string;
  srcUrl?: string;
}

// ─── Startup ──────────────────────────────────────────────────────────────────

browser.runtime.getPlatformInfo().then(async (platformInfo: unknown) => {
  const browserInfo = browser.runtime.getBrowserInfo
    ? await browser.runtime.getBrowserInfo()
    : "Can't get browser info";
  console.info(platformInfo, browserInfo);
});

/** Shape of messages this background script expects from content scripts. */
interface ClipMessage {
  type: string;
  dom?: string;
  selection?: string;
  clipSelection?: boolean;
  markdown?: string;
  title?: string;
  tab?: Tab;
  imageList?: Record<string, string>;
  mdClipsFolder?: string;
}

browser.runtime.onMessage.addListener((rawMessage: unknown) =>
  notify(rawMessage as ClipMessage)
);
createMenus();

// ─── Message handler ──────────────────────────────────────────────────────────

async function notify(message: ClipMessage) {
  if (message.type === "clip") {
    const article = await getArticleFromDom(message.dom ?? "", "");
    if (!article) return;

    if (message.selection && message.clipSelection) {
      article.content = message.selection;
    }

    const { markdown, imageList } = await buildMarkdown(article);
    const title = await formatTitle(article);
    const mdClipsFolder = await formatMdClipsFolder(article);

    await browser.runtime.sendMessage({
      type: "display.md",
      markdown,
      article,
      imageList,
      mdClipsFolder,
    });
  } else if (message.type === "download") {
    downloadMarkdown(
      message.markdown ?? "",
      message.title ?? "",
      message.tab?.id ?? 0,
      message.imageList ?? {},
      message.mdClipsFolder ?? ""
    );
  }
}

// ─── Keyboard commands ────────────────────────────────────────────────────────

browser.commands.onCommand.addListener((command: string) => {
  const tab = browser.tabs.getCurrent();
  if (command === "download_tab_as_markdown") {
    downloadMarkdownFromContext({ menuItemId: "download-markdown-all" }, tab);
  } else if (command === "copy_tab_as_markdown") {
    copyMarkdownFromContext({ menuItemId: "copy-markdown-all" }, tab);
  } else if (command === "copy_selection_as_markdown") {
    copyMarkdownFromContext({ menuItemId: "copy-markdown-selection" }, tab);
  } else if (command === "copy_tab_as_markdown_link") {
    copyTabAsMarkdownLink(tab);
  } else if (command === "copy_selected_tab_as_markdown_link") {
    copySelectedTabAsMarkdownLink(tab);
  } else if (command === "copy_selection_to_obsidian") {
    copyMarkdownFromContext({ menuItemId: "copy-markdown-obsidian" }, tab);
  } else if (command === "copy_tab_to_obsidian") {
    copyMarkdownFromContext({ menuItemId: "copy-markdown-obsall" }, tab);
  }
});

// ─── Context menu click handler ───────────────────────────────────────────────

browser.contextMenus.onClicked.addListener((info: MenuInfo, tab: Tab | undefined) => {
  if (info.menuItemId.toString().startsWith("copy-markdown")) {
    copyMarkdownFromContext(info, tab);
  } else if (
    info.menuItemId === "download-markdown-alltabs" ||
    info.menuItemId === "tab-download-markdown-alltabs"
  ) {
    downloadMarkdownForAllTabs(info);
  } else if (info.menuItemId.toString().startsWith("download-markdown")) {
    downloadMarkdownFromContext(info, tab);
  } else if (info.menuItemId.toString().startsWith("copy-tab-as-markdown-link-all")) {
    copyTabAsMarkdownLinkAll(tab);
  } else if (info.menuItemId.toString().startsWith("copy-tab-as-markdown-link-selected")) {
    copySelectedTabAsMarkdownLink(tab);
  } else if (info.menuItemId.toString().startsWith("copy-tab-as-markdown-link")) {
    copyTabAsMarkdownLink(tab);
  } else if (
    info.menuItemId.toString().startsWith("toggle-") ||
    info.menuItemId.toString().startsWith("tabtoggle-")
  ) {
    toggleSetting(info.menuItemId.toString().split("-")[1]);
  }
});

// ─── Settings toggle ──────────────────────────────────────────────────────────

async function toggleSetting(
  setting: string,
  options: ExtensionOptions | null = null
): Promise<void> {
  if (options === null) {
    await toggleSetting(setting, await getOptions());
    return;
  }
  (options as unknown as Record<string, unknown>)[setting] = !(
    options as unknown as Record<string, unknown>
  )[setting];
  await browser.storage.sync.set(options as unknown as Record<string, unknown>);

  if (setting === "includeTemplate") {
    browser.contextMenus.update("toggle-includeTemplate", {
      checked: options.includeTemplate,
    });
    try {
      browser.contextMenus.update("tabtoggle-includeTemplate", {
        checked: options.includeTemplate,
      });
    } catch {
      // ignore — tab context menus not supported on all browsers
    }
  }

  if (setting === "downloadImages") {
    browser.contextMenus.update("toggle-downloadImages", {
      checked: options.downloadImages,
    });
    try {
      browser.contextMenus.update("tabtoggle-downloadImages", {
        checked: options.downloadImages,
      });
    } catch {
      // ignore
    }
  }
}

// ─── Content-script helpers ───────────────────────────────────────────────────

async function ensureScripts(tabId: number): Promise<void> {
  const results = await browser.tabs.executeScript(tabId, {
    code: "typeof getSelectionAndDom === 'function';",
  });
  if (!results || results[0] !== true) {
    await browser.tabs.executeScript(tabId, {
      file: "/contentScript/contentScript.js",
    });
  }
}

async function getArticleFromContent(
  tabId: number,
  selection = false
): Promise<Article | null> {
  const results = await browser.tabs.executeScript(tabId, {
    code: "getSelectionAndDom()",
  });

  type DomResult = { dom?: string; selection?: string };
  const result = results?.[0] as DomResult | undefined;

  if (result?.dom) {
    const article = getArticleFromDom(result.dom, "");
    if (!article) return null;

    if (selection && result.selection) {
      article.content = result.selection;
    }
    return article;
  }
  return null;
}

// ─── Markdown conversion ──────────────────────────────────────────────────────

async function buildMarkdown(
  article: Article,
  downloadImages: boolean | null = null
): Promise<TurndownResult> {
  const options = await getOptions();
  if (downloadImages !== null) options.downloadImages = downloadImages;

  const title = await formatTitle(article);
  const result = convertArticleToMarkdown(article, options, title);

  if (options.downloadImages && options.downloadMode === "downloadsApi") {
    return preDownloadImages(result.imageList, result.markdown);
  }
  return result;
}

// ─── Title / folder formatting ────────────────────────────────────────────────

async function formatTitle(article: Article): Promise<string> {
  const options = await getOptions();
  let title = textReplace(
    options.title,
    article,
    options.disallowedChars + "/"
  );
  title = title
    .split("/")
    .map((s) => generateValidFileName(s, options.disallowedChars))
    .join("/");
  return title;
}

async function formatMdClipsFolder(article: Article): Promise<string> {
  const options = await getOptions();
  if (!options.mdClipsFolder || options.downloadMode !== "downloadsApi")
    return "";

  let folder = textReplace(
    options.mdClipsFolder,
    article,
    options.disallowedChars
  );
  folder = folder
    .split("/")
    .map((s) => generateValidFileName(s, options.disallowedChars))
    .join("/");
  if (!folder.endsWith("/")) folder += "/";
  return folder;
}

async function formatObsidianFolder(article: Article): Promise<string> {
  const options = await getOptions();
  if (!options.obsidianFolder) return "";

  let folder = textReplace(
    options.obsidianFolder,
    article,
    options.disallowedChars
  );
  folder = folder
    .split("/")
    .map((s) => generateValidFileName(s, options.disallowedChars))
    .join("/");
  if (!folder.endsWith("/")) folder += "/";
  return folder;
}

// ─── Image pre-download ───────────────────────────────────────────────────────

async function preDownloadImages(
  imageList: Record<string, string>,
  markdown: string
): Promise<TurndownResult> {
  const options = await getOptions();
  const newImageList: Record<string, string> = {};

  await Promise.all(
    Object.entries(imageList).map(
      ([src, filename]) =>
        new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", src);
          xhr.responseType = "blob";
          xhr.onload = async function () {
            const blob = xhr.response as Blob;

            if (options.imageStyle === "base64") {
              const reader = new FileReader();
              reader.onloadend = function () {
                markdown = markdown.split(src).join(reader.result as string);
                resolve();
              };
              reader.readAsDataURL(blob);
            } else {
              let newFilename = filename;
              if (newFilename.endsWith(".idunno")) {
                const ext = mimedb[blob.type] ?? "bin";
                newFilename = filename.replace(".idunno", "." + ext);
                if (!options.imageStyle.startsWith("obsidian")) {
                  markdown = markdown
                    .split(
                      filename.split("/").map((s) => encodeURIComponent(s)).join("/")
                    )
                    .join(
                      newFilename.split("/").map((s) => encodeURIComponent(s)).join("/")
                    );
                } else {
                  markdown = markdown.split(filename).join(newFilename);
                }
              }

              const blobUrl = URL.createObjectURL(blob);
              newImageList[blobUrl] = newFilename;
              resolve();
            }
          };
          xhr.onerror = () =>
            reject(new Error("Network error downloading " + src));
          xhr.send();
        })
    )
  );

  return { imageList: newImageList, markdown };
}

// ─── Download helpers ─────────────────────────────────────────────────────────

async function downloadMarkdown(
  markdown: string,
  title: string,
  tabId: number,
  imageList: Record<string, string> = {},
  mdClipsFolder = ""
): Promise<void> {
  const options = await getOptions();

  if (options.downloadMode === "downloadsApi" && browser.downloads) {
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" })
    );

    try {
      if (mdClipsFolder && !mdClipsFolder.endsWith("/"))
        mdClipsFolder += "/";

      const id = await browser.downloads.download({
        url,
        filename: mdClipsFolder + title + ".md",
        saveAs: options.saveAs,
      });

      browser.downloads.onChanged.addListener(downloadListener(id, url));

      if (options.downloadImages) {
        const destPath = mdClipsFolder + title.substring(0, title.lastIndexOf("/"));
        const dest = destPath && !destPath.endsWith("/") ? destPath + "/" : destPath;
        for (const [src, filename] of Object.entries(imageList)) {
          const imgId = await browser.downloads.download({
            url: src,
            filename: dest ? dest + filename : filename,
            saveAs: false,
          });
          browser.downloads.onChanged.addListener(downloadListener(imgId, src));
        }
      }
    } catch (err) {
      console.error("Download failed", err);
    }
  } else {
    try {
      await ensureScripts(tabId);
      const filename =
        mdClipsFolder +
        generateValidFileName(title, options.disallowedChars) +
        ".md";
      const code = `downloadMarkdown("${filename}","${base64EncodeUnicode(markdown)}")`;
      await browser.tabs.executeScript(tabId, { code });
    } catch (error) {
      console.error("Failed to execute script:", error);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DownloadDeltaListener = Parameters<typeof browser.downloads.onChanged.addListener>[0];

function downloadListener(id: number, url: string): DownloadDeltaListener {
  const self: DownloadDeltaListener = (delta) => {
    if (delta.id === id && delta.state?.current === "complete") {
      browser.downloads.onChanged.removeListener(self);
      URL.revokeObjectURL(url);
    }
  };
  return self;
}

function base64EncodeUnicode(str: string): string {
  const utf8Bytes = encodeURIComponent(str).replace(
    /%([0-9A-F]{2})/g,
    (_match, p1) => String.fromCharCode(parseInt("0x" + p1, 16))
  );
  return btoa(utf8Bytes);
}

// ─── Context-menu action handlers ────────────────────────────────────────────

async function downloadMarkdownFromContext(
  info: { menuItemId: string | number },
  tab: Tab | Promise<Tab> | undefined
): Promise<void> {
  const resolvedTab = await Promise.resolve(tab);
  if (!resolvedTab?.id) return;

  await ensureScripts(resolvedTab.id);
  const article = await getArticleFromContent(
    resolvedTab.id,
    info.menuItemId === "download-markdown-selection"
  );
  if (!article) return;

  const title = await formatTitle(article);
  const { markdown, imageList } = await buildMarkdown(article);
  const mdClipsFolder = await formatMdClipsFolder(article);
  await downloadMarkdown(markdown, title, resolvedTab.id, imageList, mdClipsFolder);
}

async function copyTabAsMarkdownLink(
  tab: Tab | Promise<Tab> | undefined
): Promise<void> {
  try {
    const resolvedTab = await Promise.resolve(tab);
    if (!resolvedTab?.id) return;

    await ensureScripts(resolvedTab.id);
    const article = await getArticleFromContent(resolvedTab.id);
    if (!article) return;

    const title = await formatTitle(article);
    await browser.tabs.executeScript(resolvedTab.id, {
      code: `copyToClipboard("[${title}](${article.baseURI})")`,
    });
  } catch (error) {
    console.error("Failed to copy as markdown link:", error);
  }
}

async function copyTabAsMarkdownLinkAll(
  tab: Tab | Promise<Tab> | undefined
): Promise<void> {
  try {
    const resolvedTab = await Promise.resolve(tab);
    if (!resolvedTab?.id) return;

    const options = await getOptions();
    options.frontmatter = options.backmatter = "";

    const tabs = await browser.tabs.query({ currentWindow: true });
    const links: string[] = [];
    for (const t of tabs) {
      if (!t.id) continue;
      await ensureScripts(t.id);
      const article = await getArticleFromContent(t.id);
      if (!article) continue;
      const title = await formatTitle(article);
      links.push(`${options.bulletListMarker} [${title}](${article.baseURI})`);
    }

    const markdown = links.join("\n");
    await browser.tabs.executeScript(resolvedTab.id, {
      code: `copyToClipboard(${JSON.stringify(markdown)})`,
    });
  } catch (error) {
    console.error("Failed to copy as markdown link list:", error);
  }
}

async function copySelectedTabAsMarkdownLink(
  tab: Tab | Promise<Tab> | undefined
): Promise<void> {
  try {
    const resolvedTab = await Promise.resolve(tab);
    if (!resolvedTab?.id) return;

    const options = await getOptions();
    options.frontmatter = options.backmatter = "";

    const tabs = await browser.tabs.query({
      currentWindow: true,
      highlighted: true,
    });
    const links: string[] = [];
    for (const t of tabs) {
      if (!t.id) continue;
      await ensureScripts(t.id);
      const article = await getArticleFromContent(t.id);
      if (!article) continue;
      const title = await formatTitle(article);
      links.push(`${options.bulletListMarker} [${title}](${article.baseURI})`);
    }

    const markdown = links.join("\n");
    await browser.tabs.executeScript(resolvedTab.id, {
      code: `copyToClipboard(${JSON.stringify(markdown)})`,
    });
  } catch (error) {
    console.error("Failed to copy selected tabs as markdown links:", error);
  }
}

async function copyMarkdownFromContext(
  info: {
    menuItemId: string | number;
    linkUrl?: string;
    linkText?: string;
    selectionText?: string;
    srcUrl?: string;
  },
  tab: Tab | Promise<Tab> | undefined
): Promise<void> {
  try {
    const resolvedTab = await Promise.resolve(tab);
    if (!resolvedTab?.id) return;

    await ensureScripts(resolvedTab.id);
    const menuItem = info.menuItemId.toString();

    if (menuItem === "copy-markdown-link") {
      const options = await getOptions();
      options.frontmatter = options.backmatter = "";
      const article = await getArticleFromContent(resolvedTab.id, false);
      if (!article) return;
      const title = await formatTitle(article);
      const linkMarkdown = convertArticleToMarkdown(
        {
          ...article,
          content: `<a href="${info.linkUrl}">${
            info.linkText ?? info.selectionText ?? ""
          }</a>`,
        },
        { ...options, downloadImages: false },
        title
      ).markdown;
      await browser.tabs.executeScript(resolvedTab.id, {
        code: `copyToClipboard(${JSON.stringify(linkMarkdown)})`,
      });
    } else if (menuItem === "copy-markdown-image") {
      await browser.tabs.executeScript(resolvedTab.id, {
        code: `copyToClipboard("![](${info.srcUrl})")`,
      });
    } else if (menuItem === "copy-markdown-obsidian") {
      const article = await getArticleFromContent(resolvedTab.id, true);
      if (!article) return;
      const title = await formatTitle(article);
      const options = await getOptions();
      const obsidianFolder = await formatObsidianFolder(article);
      const { markdown } = buildMarkdownSync(article, options, title, false);
      await browser.tabs.executeScript(resolvedTab.id, {
        code: `copyToClipboard(${JSON.stringify(markdown)})`,
      });
      await browser.tabs.update(resolvedTab.id, {
        url:
          "obsidian://advanced-uri?vault=" +
          options.obsidianVault +
          "&clipboard=true&mode=new&filepath=" +
          obsidianFolder +
          generateValidFileName(title),
      });
    } else if (menuItem === "copy-markdown-obsall") {
      const article = await getArticleFromContent(resolvedTab.id, false);
      if (!article) return;
      const title = await formatTitle(article);
      const options = await getOptions();
      const obsidianFolder = await formatObsidianFolder(article);
      const { markdown } = buildMarkdownSync(article, options, title, false);
      await browser.tabs.executeScript(resolvedTab.id, {
        code: `copyToClipboard(${JSON.stringify(markdown)})`,
      });
      await browser.tabs.update(resolvedTab.id, {
        url:
          "obsidian://advanced-uri?vault=" +
          options.obsidianVault +
          "&clipboard=true&mode=new&filepath=" +
          obsidianFolder +
          generateValidFileName(title),
      });
    } else {
      const article = await getArticleFromContent(
        resolvedTab.id,
        menuItem === "copy-markdown-selection"
      );
      if (!article) return;
      const { markdown } = await buildMarkdown(article, false);
      await browser.tabs.executeScript(resolvedTab.id, {
        code: `copyToClipboard(${JSON.stringify(markdown)})`,
      });
    }
  } catch (error) {
    console.error("Failed to copy text:", error);
  }
}

async function downloadMarkdownForAllTabs(
  info: { menuItemId: string | number }
): Promise<void> {
  const tabs = await browser.tabs.query({ currentWindow: true });
  tabs.forEach((tab: Tab) => downloadMarkdownFromContext(info, tab));
}

// ─── Synchronous markdown build (for cases where we don't need pre-download) ──

function buildMarkdownSync(
  article: Article,
  options: ExtensionOptions,
  title: string,
  _downloadImages: boolean
): TurndownResult {
  return convertArticleToMarkdown(
    article,
    { ...options, downloadImages: false },
    title
  );
}
