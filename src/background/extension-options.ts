import { SharedConversionOptions, SHARED_DEFAULTS } from "../shared/default-options";

// ─── Extension-specific options ───────────────────────────────────────────────

export interface ExtensionOptions extends SharedConversionOptions {
  saveAs: boolean;
  mdClipsFolder: string | null;
  downloadMode: "downloadsApi" | "contentLink";
  contextMenus: boolean;
  obsidianIntegration: boolean;
  obsidianVault: string;
  obsidianFolder: string;
}

export const EXTENSION_DEFAULTS: ExtensionOptions = {
  ...SHARED_DEFAULTS,
  saveAs: false,
  mdClipsFolder: null,
  downloadMode: "downloadsApi",
  contextMenus: true,
  obsidianIntegration: false,
  obsidianVault: "",
  obsidianFolder: "",
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

export async function getOptions(): Promise<ExtensionOptions> {
  let options: ExtensionOptions = EXTENSION_DEFAULTS;
  try {
    options = (await browser.storage.sync.get(
      EXTENSION_DEFAULTS as unknown as Record<string, unknown>
    )) as unknown as ExtensionOptions;
  } catch (err) {
    console.error(err);
  }
  if (!browser.downloads) options.downloadMode = "contentLink";
  return options;
}
