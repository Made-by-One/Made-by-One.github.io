#!/usr/bin/env node
/**
 * Синхронизирует метаданные релизов GitHub → data/releases.json
 *
 * Запуск:
 *   node scripts/sync-releases.mjs
 *
 * Что делает:
 *   1. Читает продукты из data/site.json
 *   2. Для каждого продукта запрашивает GitHub API (последний релиз)
 *   3. Выбирает .zip-архив по assetPattern (по умолчанию ищет "Windows")
 *   4. Записывает data/releases.json
 *
 * Если GitHub API недоступен для какого-то продукта — сохраняется
 * предыдущее значение из data/releases.json (если оно было).
 *
 * Токен опционален (GITHUB_TOKEN), но с ним лимит 5000 запросов/час вместо 60.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sitePath = join(root, 'data', 'site.json');
const releasesPath = join(root, 'data', 'releases.json');

const site = JSON.parse(readFileSync(sitePath, 'utf8'));
const previous = existsSync(releasesPath)
  ? JSON.parse(readFileSync(releasesPath, 'utf8'))
  : { products: {} };

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'made-by-one-site-sync',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
};

function pickAsset(assets = [], pattern = 'Windows') {
  const zips = assets.filter((a) => /\.zip$/i.test(a.name || ''));
  const hit = zips.find((a) => (a.name || '').toLowerCase().includes(pattern.toLowerCase()));
  return hit || zips[0] || null;
}

const out = { generatedAt: new Date().toISOString(), products: {} };
let failures = 0;

for (const product of site.products || []) {
  const url = `https://api.github.com/repos/${product.repo}/releases/latest`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const release = await res.json();
    const asset = pickAsset(release.assets, product.assetPattern || 'Windows');

    out.products[product.id] = {
      repo: product.repo,
      version: release.tag_name,
      name: release.name || release.tag_name,
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      downloadUrl: asset ? asset.browser_download_url : release.html_url,
      assetName: asset ? asset.name : null
    };
    console.log(`✔ ${product.repo} → ${release.tag_name}${asset ? ` (${asset.name})` : ' (артефакт не найден)'}`);
  } catch (err) {
    failures++;
    const prev = previous.products?.[product.id];
    if (prev) {
      out.products[product.id] = prev;
      console.warn(`⚠ ${product.repo}: ${err.message} — оставляем прежнее значение ${prev.version}`);
    } else {
      console.warn(`⚠ ${product.repo}: ${err.message} — пропускаем (без прежнего значения)`);
    }
  }
}

writeFileSync(releasesPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`\nЗаписано ${Object.keys(out.products).length} продуктов → data/releases.json`);

if (failures > 0 && Object.keys(previous.products || {}).length === 0) {
  console.error('Все запросы к GitHub API завершились ошибкой и прежних значений нет.');
  process.exit(1);
}
