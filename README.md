![Logo Devers](data/Devers.png)
[![Made by](https://img.shields.io/badge/Made%20by-One%20Studio-black)](https://made-by-one.github.io/)

# made-by-one.github.io

Studio site for Made by One. Static HTML/CSS/JS, no build step, hosted on GitHub Pages.

## Content

All product and game content lives in **`data/site.json`**:

- `studio` — name, GitHub and itch.io links
- `products[]` — `id`, `name`, `repo`, `license`, `platform`, `status`, `fallbackDownload`, plus localized `desc`, `features` and `download` objects keyed by language (`en`, `ru`, `uk`, `es`, `de`, `fr`, `pt`, `zh`)
- `games[]` — `name`, `cover`, `status`, `progress`, `release`, `link`, plus localized `desc`, `genre` and `platform`

News lives in **`data/news/news.json`** (same localized-object format). Release news is generated automatically from GitHub: `data/releases.json` is refreshed by `scripts/sync-releases.mjs`.

Interface strings (navigation, buttons, page headings) live in `localization/<lang>.json`. A missing translation falls back to English.

### Fast editing

Open **`editor.html`** in a browser (locally through a static server, or on the deployed site). It reads `site.json` and `news.json`, lets you edit studio info, add or remove products, games and news, and edit every translation. Save the downloaded files back into `data/` and `data/news/` and commit.

## Local preview

```bash
python3 -m http.server 3000
# http://localhost:3000
```

## Release sync

```bash
GITHUB_TOKEN=... node scripts/sync-releases.mjs
```

Writes the latest GitHub release metadata for every product into `data/releases.json`. The site also falls back to the GitHub API when that file is unavailable.
