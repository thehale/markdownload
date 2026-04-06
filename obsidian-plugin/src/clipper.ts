import { Notice, TFile, normalizePath, requestUrl } from "obsidian";
import type MarkdownloadPlugin from "./main";
import {
  Article,
  convertArticleToMarkdown,
  generateValidFileName,
  getArticleFromDom,
  textReplace,
} from "./converter";

/**
 * Fetches a URL, parses it with Readability, converts to Markdown, and saves
 * the result to the vault.
 */
export async function clipUrl(
  plugin: MarkdownloadPlugin,
  url: string,
  saveLocation: string
): Promise<void> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  new Notice("MarkDownload: fetching...");

  try {
    const html = await fetchPage(url);
    if (!html) return;

    const article = getArticleFromDom(html, url);
    if (!article) {
      new Notice("MarkDownload: could not parse page content.");
      return;
    }

    const title = buildTitle(article, plugin.settings);
    const { markdown, imageList } = convertArticleToMarkdown(
      article,
      plugin.settings,
      title
    );

    const filePath = buildFilePath(saveLocation, title);
    await ensureFolderExists(plugin, saveLocation ? normalizePath(saveLocation) : "");
    await writeNote(plugin, filePath, markdown);

    if (plugin.settings.downloadImages && Object.keys(imageList).length > 0) {
      await downloadImages(
        plugin,
        imageList,
        saveLocation ? normalizePath(saveLocation) : ""
      );
    }

    await openNote(plugin, filePath);
    new Notice(`MarkDownload: saved to ${filePath}`);
  } catch (err) {
    console.error("MarkDownload error:", err);
    new Notice(`MarkDownload: unexpected error - ${String(err)}`);
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await requestUrl({
      url,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Obsidian MarkDownload/1.0)",
      },
    });
    return response.text;
  } catch (fetchErr) {
    console.error("MarkDownload fetch error:", fetchErr);
    new Notice(`MarkDownload: failed to fetch URL.\n${String(fetchErr)}`);
    return null;
  }
}

// ── Filename / path helpers ───────────────────────────────────────────────────

function buildTitle(
  article: Article,
  settings: MarkdownloadPlugin["settings"]
): string {
  let title = textReplace(
    settings.title,
    article,
    settings.disallowedChars + "/"
  );
  title = title
    .split("/")
    .map((s) => generateValidFileName(s, settings.disallowedChars))
    .join("/");
  return title || "Untitled";
}

function buildFilePath(saveLocation: string, title: string): string {
  const folderPath = saveLocation ? normalizePath(saveLocation) : "";
  return normalizePath(folderPath ? `${folderPath}/${title}.md` : `${title}.md`);
}

// ── Vault operations ──────────────────────────────────────────────────────────

async function writeNote(
  plugin: MarkdownloadPlugin,
  filePath: string,
  content: string
): Promise<void> {
  const existing = plugin.app.vault.getAbstractFileByPath(filePath);
  if (existing instanceof TFile) {
    await plugin.app.vault.modify(existing, content);
  } else {
    await plugin.app.vault.create(filePath, content);
  }
}

async function openNote(
  plugin: MarkdownloadPlugin,
  filePath: string
): Promise<void> {
  const file = plugin.app.vault.getAbstractFileByPath(filePath);
  if (file instanceof TFile) {
    const leaf = plugin.app.workspace.getLeaf();
    await leaf.openFile(file);
  }
}

export async function ensureFolderExists(
  plugin: MarkdownloadPlugin,
  folderPath: string
): Promise<void> {
  const parts = folderPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!plugin.app.vault.getAbstractFileByPath(current)) {
      await plugin.app.vault.createFolder(current);
    }
  }
}

export async function downloadImages(
  plugin: MarkdownloadPlugin,
  imageList: Record<string, string>,
  folderPath: string
): Promise<void> {
  for (const [src, filename] of Object.entries(imageList)) {
    try {
      const response = await requestUrl(src);
      const fullPath = normalizePath(
        folderPath ? `${folderPath}/${filename}` : filename
      );

      const imageDir = fullPath.contains("/")
        ? fullPath.substring(0, fullPath.lastIndexOf("/"))
        : "";
      if (imageDir) {
        await ensureFolderExists(plugin, imageDir);
      }

      const existing = plugin.app.vault.getAbstractFileByPath(fullPath);
      if (existing instanceof TFile) {
        await plugin.app.vault.modifyBinary(existing, response.arrayBuffer);
      } else {
        await plugin.app.vault.createBinary(fullPath, response.arrayBuffer);
      }
    } catch (imgErr) {
      console.error(
        `MarkDownload: failed to download image ${src}:`,
        imgErr
      );
    }
  }
}
