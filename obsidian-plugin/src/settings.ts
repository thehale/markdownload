import { App, PluginSettingTab, Setting } from "obsidian";
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

    // ── Android share ─────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: "Android share integration" });

    const shareDesc = containerEl.createDiv();
    shareDesc.innerHTML = `
      <p>On Android, you can share URLs directly to Obsidian using the 
      <code>obsidian://markdownload?url=…</code> URI scheme.</p>
      <p>To add a <strong>Share to MarkDownload</strong> shortcut on Android:</p>
      <ol>
        <li>Install an automation app such as 
          <a href="https://play.google.com/store/apps/details?id=net.dinglisch.android.taskerm">Tasker</a> or 
          <a href="https://play.google.com/store/apps/details?id=com.joaomgcd.autotools">MacroDroid</a>.</li>
        <li>Create an action that opens the URL 
          <code>obsidian://markdownload?url=%s</code> where <code>%s</code> is the shared URL.</li>
        <li>Register it as a share target so any browser's <em>Share</em> button shows it.</li>
      </ol>
      <p>You can also trigger the handler from any app that supports custom URL schemes (e.g. HTTP Shortcuts, Tasker, Automate).</p>
    `;
    shareDesc.style.fontSize = "0.875em";
    shareDesc.style.color = "var(--text-muted)";
    shareDesc.style.lineHeight = "1.6";
  }
}
