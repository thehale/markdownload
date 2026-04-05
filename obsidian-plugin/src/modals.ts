import {
  App,
  Modal,
  Setting,
  SuggestModal,
  TFolder,
} from "obsidian";

// ─── Clip URL modal ───────────────────────────────────────────────────────────

export class ClipUrlModal extends Modal {
  private url = "";
  private saveLocation: string;
  private readonly onSubmit: (url: string, saveLocation: string) => void;

  constructor(
    app: App,
    defaultSaveLocation: string,
    onSubmit: (url: string, saveLocation: string) => void
  ) {
    super(app);
    this.saveLocation = defaultSaveLocation;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Clip URL to Markdown" });

    // URL input
    new Setting(contentEl)
      .setName("URL")
      .setDesc("Web page to clip")
      .addText((text) => {
        text
          .setPlaceholder("https://example.com/article")
          .onChange((value) => {
            this.url = value.trim();
          });
        // Auto-focus on open
        setTimeout(() => text.inputEl.focus(), 50);
      });

    // Save-location input with folder-browse button
    let saveLocationInput: HTMLInputElement;
    new Setting(contentEl)
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

    // Action buttons
    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Clip")
          .setCta()
          .onClick(() => this.submit())
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );

    // Allow Enter to submit
    contentEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submit();
    });
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

// ─── Folder suggestion modal ──────────────────────────────────────────────────

export class FolderSuggestModal extends SuggestModal<TFolder> {
  private readonly onChoose: (folderPath: string) => void;

  constructor(app: App, onChoose: (folderPath: string) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Type to filter folders…");
  }

  getSuggestions(query: string): TFolder[] {
    const folders: TFolder[] = [];
    const lowerQuery = query.toLowerCase();

    const walk = (folder: TFolder) => {
      if (folder.path.toLowerCase().includes(lowerQuery)) {
        folders.push(folder);
      }
      for (const child of folder.children) {
        if (child instanceof TFolder) walk(child);
      }
    };

    for (const child of this.app.vault.getRoot().children) {
      if (child instanceof TFolder) walk(child);
    }

    return folders;
  }

  renderSuggestion(folder: TFolder, el: HTMLElement) {
    el.createEl("div", { text: folder.path || "/" });
  }

  onChooseSuggestion(folder: TFolder) {
    this.onChoose(folder.path);
  }
}
