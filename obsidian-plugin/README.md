# MarkDownload — Obsidian Plugin

Clip any web page to Markdown and save it directly to your Obsidian vault.  
This is a full port of the [MarkDownload browser extension](https://github.com/deathau/markdownload) into a native Obsidian plugin.

---

## Features

- **Clip URL command** — opens a dialog asking for a URL and a vault folder, fetches the page, converts it to Markdown via the same Readability + Turndown pipeline used by the browser extension, then saves the note and opens it.
- **Settings page** — all formatting options from the browser extension are available: heading style, code block style, link style, image style, templates (frontmatter/backmatter with variable substitution), image downloading, and more.
- **Android share integration** — register the `obsidian://markdownload?url=…` URI scheme as an Android share target so you can share URLs from any browser or app directly into your vault.

---

## Installation

### Manual (recommended for testing)

1. Copy the three plugin files into your vault's plugins folder:
   ```
   <vault>/.obsidian/plugins/markdownload/main.js
   <vault>/.obsidian/plugins/markdownload/manifest.json
   <vault>/.obsidian/plugins/markdownload/styles.css
   ```
2. In Obsidian → **Settings → Community plugins → Installed plugins**, enable **MarkDownload**.

### Building from source

```bash
cd obsidian-plugin
npm install
npm run build        # produces main.js (minified)
npm run dev          # watch mode with source maps
```

---

## Usage

### Clip a URL

1. Open the command palette (`Ctrl/Cmd+P`).
2. Run **MarkDownload: Clip URL to Markdown**.
3. Enter the URL and optionally choose a vault folder.
4. The plugin fetches the page, converts it, saves the note, and opens it.

### Android share

The plugin registers an `obsidian://markdownload` URI handler.  
To use it as an Android share target:

1. Install an automation app such as [HTTP Shortcuts](https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts), [Tasker](https://play.google.com/store/apps/details?id=net.dinglisch.android.taskerm), or [MacroDroid](https://play.google.com/store/apps/details?id=com.joaomgcd.autotools).
2. Create a share action that opens:
   ```
   obsidian://markdownload?url={shared_url}
   ```
   replacing `{shared_url}` with the variable your automation app provides for the shared text/URL.
3. Register this action as an Android share target.

You can also pass an optional `folder` parameter to override the default save location:
```
obsidian://markdownload?url=https://example.com/article&folder=Clippings/Articles
```

---

## Template variables

The frontmatter/backmatter templates and the filename template support the following variables:

| Variable | Description |
|---|---|
| `{pageTitle}` | Document `<title>` |
| `{title}` | Readability-extracted article title |
| `{byline}` | Author / byline |
| `{excerpt}` | Short description / meta description |
| `{keywords}` | Comma-joined meta keywords |
| `{baseURI}` | Full URL of the clipped page |
| `{hostname}` | Hostname (e.g. `example.com`) |
| `{date:FORMAT}` | Current date using [Moment.js format](https://momentjs.com/docs/#/displaying/format/) |

Each variable also supports case modifiers: `:lower`, `:upper`, `:kebab`, `:snake`, `:camel`, `:pascal`, `:obsidian-cal`.

---

## License

MIT — see [LICENSE](../LICENSE).
