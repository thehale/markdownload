import { Plugin } from "obsidian";
import {
  DEFAULT_SETTINGS,
  MarkdownloadSettings,
  MarkdownloadSettingTab,
} from "./settings";
import { clipUrl } from "./clipper";
import { ClipUrlModal } from "./modals";

export default class MarkdownloadPlugin extends Plugin {
  settings!: MarkdownloadSettings;

  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "clip-url",
      name: "Clip URL",
      callback: () => this.showClipUrlModal(),
    });
    this.registerObsidianProtocolHandler(
      "markdownload",
      async (params: Record<string, string>) => {
        const url = params.url || params.text || params.clip;
        if (url) {
          if (params.folder) {
            await clipUrl(this, url, params.folder);
          } else {
            this.showClipUrlModal(url);
          }
        } else {
          this.showClipUrlModal();
        }
      }
    );
    this.addSettingTab(new MarkdownloadSettingTab(this.app, this));
  }

  onunload() {}

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

  showClipUrlModal(initialUrl?: string) {
    new ClipUrlModal(
      this.app,
      this.settings.defaultSaveLocation,
      async (url, saveLocation) => {
        await clipUrl(this, url, saveLocation);
      },
      initialUrl
    ).open();
  }
}

