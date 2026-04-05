import {
  Notice,
  Plugin,
  TFile,
  TFolder,
  normalizePath,
  requestUrl,
} from "obsidian";
import {
  DEFAULT_SETTINGS,
  MarkdownloadSettings,
  MarkdownloadSettingTab,
} from "./settings";
import {
  Article,
  convertArticleToMarkdown,
  generateValidFileName,
  getArticleFromDom,
  textReplace,
} from "./converter";
import { ClipUrlModal } from "./modals";

export default class MarkdownloadPlugin extends Plugin {
  settings!: MarkdownloadSettings;

  async onload() {
    await this.loadSettings();

    // ── Command: clip a URL ──────────────────────────────────────────────
    this.addCommand({
      id: "clip-url",
      name: "Clip URL",
      callback: () => this.showClipUrlModal(),
    });

    // ── Protocol handler ─────────────────────────────────────────────────
    // Handles obsidian://markdownload?url=https://...
    // This is also the entry-point for the Android share integration:
    // any app that can open a URI can share a URL to this handler.
    this.registerObsidianProtocolHandler(
      "markdownload",
      async (params: Record<string, string>) => {
        // Accept ?url=, ?text=, or ?clip= for flexibility
        const url = params.url || params.text || params.clip;
        if (url) {
          if (params.folder) {
            await this.clipUrl(url, params.folder);
          } else {
            // URL provided but no folder – ask where to save
            this.showClipUrlModal(url);
          }
        } else {
          // No URL in the params – fall through to the interactive modal
          this.showClipUrlModal();
        }
      }
    );

    // ── Settings tab ─────────────────────────────────────────────────────
    this.addSettingTab(new MarkdownloadSettingTab(this.app, this));
  }

  onunload() {
    // nothing to clean up
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  showClipUrlModal(initialUrl?: string) {
    new ClipUrlModal(
      this.app,
      this.settings.defaultSaveLocation,
      async (url, saveLocation) => {
        await this.clipUrl(url, saveLocation);
      },
      initialUrl
    ).open();
  }

  // ── Core clip flow ────────────────────────────────────────────────────────

  async clipUrl(url: string, saveLocation: string) {
    // Normalise URL
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    new Notice("MarkDownload: fetching…");

    try {
      // ── 1. Fetch the page ───────────────────────────────────────────────
      let html: string;
      try {
        const response = await requestUrl({
          url,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; Obsidian MarkDownload/1.0)",
          },
        });
        html = response.text;
      } catch (fetchErr) {
        console.error("MarkDownload fetch error:", fetchErr);
        new Notice(
          `MarkDownload: failed to fetch URL.\n${String(fetchErr)}`
        );
        return;
      }

      // ── 2. Parse & extract article ──────────────────────────────────────
      const article: Article | null = getArticleFromDom(html, url);
      if (!article) {
        new Notice("MarkDownload: could not parse page content.");
        return;
      }

      // ── 3. Build the filename ───────────────────────────────────────────
      let title = textReplace(
        this.settings.title,
        article,
        this.settings.disallowedChars + "/"
      );
      title = title
        .split("/")
        .map((s) => generateValidFileName(s, this.settings.disallowedChars))
        .join("/");
      if (!title) title = "Untitled";

      // ── 4. Convert to Markdown ──────────────────────────────────────────
      const { markdown, imageList } = convertArticleToMarkdown(
        article,
        this.settings,
        title
      );

      // ── 5. Determine save path ──────────────────────────────────────────
      const folderPath = saveLocation ? normalizePath(saveLocation) : "";
      const filePath = normalizePath(
        folderPath ? `${folderPath}/${title}.md` : `${title}.md`
      );

      // ── 6. Ensure folder exists ─────────────────────────────────────────
      if (folderPath) {
        await this.ensureFolderExists(folderPath);
      }

      // ── 7. Write the note ───────────────────────────────────────────────
      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile instanceof TFile) {
        await this.app.vault.modify(existingFile, markdown);
      } else {
        await this.app.vault.create(filePath, markdown);
      }

      // ── 8. Download images if requested ────────────────────────────────
      if (
        this.settings.downloadImages &&
        Object.keys(imageList).length > 0
      ) {
        await this.downloadImages(imageList, folderPath);
      }

      // ── 9. Open the note ────────────────────────────────────────────────
      const savedFile = this.app.vault.getAbstractFileByPath(filePath);
      if (savedFile instanceof TFile) {
        const leaf = this.app.workspace.getLeaf();
        await leaf.openFile(savedFile);
      }

      new Notice(`MarkDownload: saved to ${filePath}`);
    } catch (err) {
      console.error("MarkDownload error:", err);
      new Notice(`MarkDownload: unexpected error – ${String(err)}`);
    }
  }

  // ── Vault helpers ─────────────────────────────────────────────────────────

  async ensureFolderExists(folderPath: string) {
    const parts = folderPath.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  async downloadImages(
    imageList: Record<string, string>,
    folderPath: string
  ) {
    for (const [src, filename] of Object.entries(imageList)) {
      try {
        const response = await requestUrl(src);
        const fullPath = normalizePath(
          folderPath ? `${folderPath}/${filename}` : filename
        );

        // Ensure any subdirectory exists
        const imageDir = fullPath.contains("/")
          ? fullPath.substring(0, fullPath.lastIndexOf("/"))
          : "";
        if (imageDir) {
          await this.ensureFolderExists(imageDir);
        }

        const existingFile =
          this.app.vault.getAbstractFileByPath(fullPath);
        if (existingFile instanceof TFile) {
          await this.app.vault.modifyBinary(
            existingFile,
            response.arrayBuffer
          );
        } else {
          await this.app.vault.createBinary(fullPath, response.arrayBuffer);
        }
      } catch (imgErr) {
        console.error(`MarkDownload: failed to download image ${src}:`, imgErr);
        // Continue with remaining images even if one fails
      }
    }
  }
}
