import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import type MarkdownloadPlugin from "./main";

export interface MarkdownloadSettings {
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
  // Obsidian-specific
  defaultSaveLocation: string;
}

export const DEFAULT_SETTINGS: MarkdownloadSettings = {
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
  defaultSaveLocation: "",
};

export class MarkdownloadSettingTab extends PluginSettingTab {
  plugin: MarkdownloadPlugin;

  constructor(app: App, plugin: MarkdownloadPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── Default save location ──────────────────────────────────────────────
    new Setting(containerEl)
      .setName("Default save location")
      .setDesc(
        "Vault folder where clipped pages are saved by default (leave empty for root)."
      )
      .addText((text) =>
        text
          .setPlaceholder("e.g. Clippings")
          .setValue(this.plugin.settings.defaultSaveLocation)
          .onChange(async (value) => {
            this.plugin.settings.defaultSaveLocation = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Title template ─────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName("Title / filename template")
      .setDesc(
        "Template for the filename. Supports {pageTitle}, {date:FORMAT}, {hostname}, etc."
      )
      .addText((text) =>
        text
          .setPlaceholder("{pageTitle}")
          .setValue(this.plugin.settings.title)
          .onChange(async (value) => {
            this.plugin.settings.title = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Templates ─────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Templates" });

    new Setting(containerEl)
      .setName("Include front/back matter")
      .setDesc("Wrap clipped content with the frontmatter and backmatter templates.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeTemplate)
          .onChange(async (value) => {
            this.plugin.settings.includeTemplate = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Frontmatter template")
      .setDesc(
        "YAML/text prepended to the clipped markdown. Supports {pageTitle}, {byline}, {date:FORMAT}, {keywords}, {baseURI}, {excerpt}, etc."
      )
      .addTextArea((ta) => {
        ta.setValue(this.plugin.settings.frontmatter).onChange(async (value) => {
          this.plugin.settings.frontmatter = value;
          await this.plugin.saveSettings();
        });
        ta.inputEl.rows = 8;
        ta.inputEl.style.width = "100%";
        ta.inputEl.style.fontFamily = "monospace";
      });

    new Setting(containerEl)
      .setName("Backmatter template")
      .setDesc("Text appended after the clipped markdown.")
      .addTextArea((ta) => {
        ta.setValue(this.plugin.settings.backmatter).onChange(async (value) => {
          this.plugin.settings.backmatter = value;
          await this.plugin.saveSettings();
        });
        ta.inputEl.rows = 4;
        ta.inputEl.style.width = "100%";
        ta.inputEl.style.fontFamily = "monospace";
      });

    // ── Markdown formatting ───────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Markdown formatting" });

    new Setting(containerEl)
      .setName("Heading style")
      .setDesc("ATX uses # characters; Setext uses underline characters.")
      .addDropdown((dd) =>
        dd
          .addOption("atx", "ATX  (# Heading)")
          .addOption("setext", "Setext  (Heading\\n=======)")
          .setValue(this.plugin.settings.headingStyle)
          .onChange(async (value) => {
            this.plugin.settings.headingStyle = value as "atx" | "setext";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Horizontal rule style")
      .setDesc('Characters used for <hr>. Common values: ___, ---, ***')
      .addText((text) =>
        text
          .setPlaceholder("___")
          .setValue(this.plugin.settings.hr)
          .onChange(async (value) => {
            this.plugin.settings.hr = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Bullet list marker")
      .addDropdown((dd) =>
        dd
          .addOption("-", "- (hyphen)")
          .addOption("*", "* (asterisk)")
          .addOption("+", "+ (plus)")
          .setValue(this.plugin.settings.bulletListMarker)
          .onChange(async (value) => {
            this.plugin.settings.bulletListMarker = value as "-" | "*" | "+";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Code block style")
      .addDropdown((dd) =>
        dd
          .addOption("fenced", "Fenced (``` ... ```)")
          .addOption("indented", "Indented (4 spaces)")
          .setValue(this.plugin.settings.codeBlockStyle)
          .onChange(async (value) => {
            this.plugin.settings.codeBlockStyle = value as "fenced" | "indented";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Code fence character")
      .addDropdown((dd) =>
        dd
          .addOption("```", "Backtick (```)")
          .addOption("~~~", "Tilde (~~~)")
          .setValue(this.plugin.settings.fence)
          .onChange(async (value) => {
            this.plugin.settings.fence = value as "```" | "~~~";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Emphasis (italic) delimiter")
      .addDropdown((dd) =>
        dd
          .addOption("_", "_ (underscore)")
          .addOption("*", "* (asterisk)")
          .setValue(this.plugin.settings.emDelimiter)
          .onChange(async (value) => {
            this.plugin.settings.emDelimiter = value as "_" | "*";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Strong (bold) delimiter")
      .addDropdown((dd) =>
        dd
          .addOption("**", "** (double asterisk)")
          .addOption("__", "__ (double underscore)")
          .setValue(this.plugin.settings.strongDelimiter)
          .onChange(async (value) => {
            this.plugin.settings.strongDelimiter = value as "**" | "__";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Link style")
      .addDropdown((dd) =>
        dd
          .addOption("inlined", "Inlined  ([text](url))")
          .addOption("referenced", "Referenced  ([text][id])")
          .addOption("stripLinks", "Strip links (text only)")
          .setValue(this.plugin.settings.linkStyle)
          .onChange(async (value) => {
            this.plugin.settings.linkStyle = value as
              | "inlined"
              | "referenced"
              | "stripLinks";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Link reference style")
      .setDesc("Only applies when Link style is 'Referenced'.")
      .addDropdown((dd) =>
        dd
          .addOption("full", "Full  ([text][id])")
          .addOption("collapsed", "Collapsed  ([text][])")
          .addOption("shortcut", "Shortcut  ([text])")
          .setValue(this.plugin.settings.linkReferenceStyle)
          .onChange(async (value) => {
            this.plugin.settings.linkReferenceStyle = value as
              | "full"
              | "collapsed"
              | "shortcut";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Escape special characters")
      .setDesc(
        "Escape Markdown special characters (e.g. *, _, [). Disable for cleaner prose output."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.turndownEscape)
          .onChange(async (value) => {
            this.plugin.settings.turndownEscape = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Images ────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Images" });

    new Setting(containerEl)
      .setName("Image style")
      .setDesc(
        "How images are rendered in the clipped markdown. 'Obsidian' uses ![[filename]] wikilink style."
      )
      .addDropdown((dd) =>
        dd
          .addOption("markdown", "Markdown  (![alt](src))")
          .addOption("originalSource", "Original source URL")
          .addOption("base64", "Base64 encoded (embed)")
          .addOption("noImage", "Strip images")
          .addOption("obsidian", "Obsidian ![[file]]  (with folder)")
          .addOption("obsidian-nofolder", "Obsidian ![[file]]  (filename only)")
          .setValue(this.plugin.settings.imageStyle)
          .onChange(async (value) => {
            this.plugin.settings.imageStyle = value as MarkdownloadSettings["imageStyle"];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Image reference style")
      .setDesc("Only applies when Image style is Markdown.")
      .addDropdown((dd) =>
        dd
          .addOption("inlined", "Inlined")
          .addOption("referenced", "Referenced")
          .setValue(this.plugin.settings.imageRefStyle)
          .onChange(async (value) => {
            this.plugin.settings.imageRefStyle = value as "inlined" | "referenced";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Download images to vault")
      .setDesc(
        "Fetch images and save them alongside the clipped note. Only applies when Image style is Markdown or Obsidian."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.downloadImages)
          .onChange(async (value) => {
            this.plugin.settings.downloadImages = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Image subfolder prefix")
      .setDesc(
        "Subfolder (relative to the note) where downloaded images are saved. Supports {pageTitle} etc."
      )
      .addText((text) =>
        text
          .setPlaceholder("{pageTitle}/")
          .setValue(this.plugin.settings.imagePrefix)
          .onChange(async (value) => {
            this.plugin.settings.imagePrefix = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Filenames ─────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Filenames" });

    new Setting(containerEl)
      .setName("Disallowed filename characters")
      .setDesc(
        "Characters to strip from generated filenames (in addition to the default illegal set)."
      )
      .addText((text) =>
        text
          .setPlaceholder("[]#^")
          .setValue(this.plugin.settings.disallowedChars)
          .onChange(async (value) => {
            this.plugin.settings.disallowedChars = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Import / Export ───────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Import / Export settings" });

    new Setting(containerEl)
      .setName("Export settings")
      .setDesc("Download your current settings as a JSON file.")
      .addButton((btn) =>
        btn
          .setButtonText("Export")
          .onClick(() => {
            const json = JSON.stringify(this.plugin.settings, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "markdownload-settings.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          })
      );

    new Setting(containerEl)
      .setName("Import settings")
      .setDesc("Load settings from a previously exported JSON file.")
      .addButton((btn) =>
        btn
          .setButtonText("Import")
          .onClick(() => new ImportSettingsModal(this.app, async (json) => {
            try {
              const parsed = JSON.parse(json);
              this.plugin.settings = Object.assign(
                {},
                DEFAULT_SETTINGS,
                parsed
              );
              await this.plugin.saveSettings();
              this.display();
              new Notice("MarkDownload: settings imported.");
            } catch (err) {
              console.error("MarkDownload: settings import error:", err);
              new Notice(`MarkDownload: invalid settings JSON – ${String(err)}`);
            }
          }).open())
      );
  }
}

// ─── Import modal ─────────────────────────────────────────────────────────────

class ImportSettingsModal extends Modal {
  private readonly onImport: (json: string) => void;
  private json = "";
  private textArea: HTMLTextAreaElement | null = null;

  constructor(app: App, onImport: (json: string) => void) {
    super(app);
    this.onImport = onImport;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Import settings" });

    // File picker row
    new Setting(contentEl)
      .setName("Choose file")
      .setDesc("Select a markdownload-settings.json file from your device.")
      .addButton((btn) =>
        btn.setButtonText("Browse…").onClick(() => {
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = ".json,application/json";
          fileInput.addEventListener("change", () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
              const text = e.target?.result as string ?? "";
              this.json = text;
              if (this.textArea) {
                this.textArea.value = text;
              }
            };
            reader.onerror = () => {
              new Notice("MarkDownload: could not read the selected file.");
            };
            reader.readAsText(file);
          });
          fileInput.click();
        })
      );

    // Manual paste row
    new Setting(contentEl)
      .setName("Or paste JSON")
      .setDesc("Paste the contents of your exported markdownload-settings.json file.")
      .addTextArea((ta) => {
        ta.setPlaceholder('{ "headingStyle": "atx", ... }')
          .onChange((v) => { this.json = v; });
        ta.inputEl.rows = 10;
        ta.inputEl.style.width = "100%";
        ta.inputEl.style.fontFamily = "monospace";
        this.textArea = ta.inputEl;
        setTimeout(() => ta.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Import")
          .setCta()
          .onClick(() => {
            if (!this.json.trim()) return;
            this.close();
            this.onImport(this.json);
          })
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );
  }

  onClose() {
    this.textArea = null;
    this.contentEl.empty();
  }
}
