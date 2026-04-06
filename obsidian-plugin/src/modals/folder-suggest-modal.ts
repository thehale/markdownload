import { App, SuggestModal, TFolder } from "obsidian";

export class FolderSuggestModal extends SuggestModal<TFolder> {
  private readonly onChoose: (folderPath: string) => void;

  constructor(app: App, onChoose: (folderPath: string) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Type to filter folders...");
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
