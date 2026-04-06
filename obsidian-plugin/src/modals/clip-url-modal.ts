import { App, Modal, Setting } from "obsidian";
import { FolderSuggestModal } from "./folder-suggest-modal";

export class ClipUrlModal extends Modal {
  private url: string;
  private saveLocation: string;
  private readonly onSubmit: (url: string, saveLocation: string) => void;

  constructor(
    app: App,
    defaultSaveLocation: string,
    onSubmit: (url: string, saveLocation: string) => void,
    initialUrl?: string
  ) {
    super(app);
    this.url = initialUrl ?? "";
    this.saveLocation = defaultSaveLocation;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    this.contentEl.createEl("h2", { text: "Clip URL to Markdown" });
    const urlFocused = this.addUrlInput();
    this.addFolderPicker(urlFocused);
    this.addActionButtons();
    this.contentEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submit();
    });
  }

  private addUrlInput(): boolean {
    let focused = false;
    new Setting(this.contentEl)
      .setName("URL")
      .setDesc("Web page to clip")
      .addText((text) => {
        text
          .setPlaceholder("https://example.com/article")
          .setValue(this.url)
          .onChange((value) => {
            this.url = value.trim();
          });
        if (!this.url) {
          focused = true;
          setTimeout(() => text.inputEl.focus(), 50);
        }
      });
    return focused;
  }

  private addFolderPicker(urlFocused: boolean) {
    let saveLocationInput: HTMLInputElement;
    new Setting(this.contentEl)
      .setName("Save to folder")
      .setDesc("Vault folder path (leave empty for root)")
      .addText((text) => {
        saveLocationInput = text.inputEl;
        text
          .setPlaceholder("Clippings")
          .setValue(this.saveLocation)
          .onChange((value) => {
            this.saveLocation = value;
          });
        if (!urlFocused) {
          setTimeout(() => text.inputEl.focus(), 50);
        }
      })
      .addButton((btn) =>
        btn
          .setIcon("folder")
          .setTooltip("Browse vault folders")
          .onClick(() => {
            new FolderSuggestModal(this.app, (folderPath) => {
              this.saveLocation = folderPath;
              if (saveLocationInput) saveLocationInput.value = folderPath;
            }).open();
          })
      );
  }

  private addActionButtons() {
    new Setting(this.contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Clip")
          .setCta()
          .onClick(() => this.submit())
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );
  }

  private submit() {
    if (!this.url) return;
    this.close();
    this.onSubmit(this.url, this.saveLocation);
  }

  onClose() {
    this.contentEl.empty();
  }
}
