![Logo Devers](data/Devers.png)
[![Made by](https://img.shields.io/badge/Made%20by-One%20Studio-black)](https://made-by-one.github.io/)

# made-by-one.github.io

Studio site for Made by One. Static HTML/CSS/JS, no build step, hosted on GitHub Pages.

## Content

All product and game content lives in **`data/site.json`**:

- `studio` — name, GitHub and itch.io links
- `products[]` — `id`, `name`, `repo`, `license`, `platform`, `status`, `fallbackDownload`, plus localized `desc`, `features` and `download` objects keyed by language (`en`, `ru`, `uk`, `es`, `de`, `fr`, `pt`, `zh`)
- `games[]` — `name`, `cover`, `status`, `progress`, `release`, `link`, plus localized `desc`, `genre` and `platform`

News lives in **`data/news/news.json`** (same localized-object format). An optional `image` field adds a photo banner above the text, e.g. `"image": "./data/news/launch.jpg"`; put the file in `data/news/`. Release news is generated automatically from GitHub: `data/releases.json` is refreshed by `scripts/sync-releases.mjs`.

Interface strings (navigation, buttons, page headings) live in `localization/<lang>.json`. A missing translation falls back to English.

## Editing

Content is plain JSON. Edit `data/site.json`, `data/news/news.json` or `localization/<lang>.json` and commit — nothing is generated or compiled.

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
