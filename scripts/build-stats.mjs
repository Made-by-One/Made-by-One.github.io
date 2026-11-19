#!/usr/bin/env node
/**
 * Собирает реальные данные для графика роста → data/stats.json
 *
 * Запуск:
 *   node scripts/build-stats.mjs
 *
 * Источники:
 *   1. git log этого репозитория — коммиты по месяцам (накопительно)
 *   2. data/releases.json — публичные релизы программ по месяцам (накопительно)
 *   3. data/site.json → games[].progressHistory — прогресс игры по контрольным точкам
 *   4. data/docs/index.json и data/site.json — суммарные счётчики для карточки
 *
 * Ничего не выдумывает: если данных нет, серия остаётся с null и график
 * просто не рисует этот отрезок.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relative) => JSON.parse(readFileSync(join(root, relative), "utf8"));

const site = readJson("data/site.json");
const releases = existsSync(join(root, "data/releases.json"))
  ? readJson("data/releases.json")
  : { products: {} };
const docs = existsSync(join(root, "data/docs/index.json"))
  ? readJson("data/docs/index.json")
  : { programs: [] };

const monthKey = (value) => String(value || "").slice(0, 7);

/* --- 1. Коммиты сайта по месяцам, накопительно --- */
const commitDates = execSync("git log --format=%ad --date=short", { cwd: root, encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .sort();

if (!commitDates.length) throw new Error("git log вернул пустую историю");

const commitCounts = new Map();
for (const date of commitDates) {
  const key = monthKey(date);
  commitCounts.set(key, (commitCounts.get(key) || 0) + 1);
}

const months = [];
const cursor = new Date(monthKey(commitDates[0]) + "-01T00:00:00Z");
const lastMonth = new Date(monthKey(commitDates[commitDates.length - 1]) + "-01T00:00:00Z");
while (cursor <= lastMonth) {
  months.push(cursor.toISOString().slice(0, 7));
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
}

let commitTotal = 0;
const commitSeries = months.map((month) => {
  commitTotal += commitCounts.get(month) || 0;
  return commitTotal;
});

/* --- 2. Релизы программ по месяцам, накопительно --- */
const releaseCounts = new Map();
for (const release of Object.values(releases.products || {})) {
  const key = monthKey(release.publishedAt);
  if (key) releaseCounts.set(key, (releaseCounts.get(key) || 0) + 1);
}
let releaseTotal = 0;
const releaseSeries = months.map((month) => {
  releaseTotal += releaseCounts.get(month) || 0;
  return releaseTotal;
});

/* --- 3. Прогресс игры по контрольным точкам --- */
const trackedGame = (site.games || []).find((game) => Array.isArray(game.progressHistory));
const progressByMonth = new Map();
for (const point of (trackedGame && trackedGame.progressHistory) || []) {
  const key = monthKey(point.date);
  if (key && typeof point.progress === "number") progressByMonth.set(key, point.progress);
}
let progress = null;
const gameSeries = months.map((month) => {
  if (progressByMonth.has(month)) progress = progressByMonth.get(month);
  return progress;
});

/* --- 4. Итоговые счётчики --- */
const docsSections = (docs.programs || []).reduce(
  (sum, program) => sum + (program.sections || []).length,
  0
);
const gameProgress = (site.games || []).reduce(
  (max, game) => (typeof game.progress === "number" ? Math.max(max, game.progress) : max),
  trackedGame && typeof trackedGame.progress === "number" ? trackedGame.progress : 0
);

const points = (values) =>
  months.map((month, index) => ({
    date: month + "-01",
    value: values[index],
  }));

const stats = {
  generatedAt: new Date().toISOString(),
  range: { from: commitDates[0], to: commitDates[commitDates.length - 1] },
  series: {
    commits: points(commitSeries),
    releases: points(releaseSeries),
    game: points(gameSeries),
  },
  totals: {
    commits: commitDates.length,
    releases: releaseTotal,
    docs: docsSections,
    products: (site.products || []).length,
    gameProgress,
  },
};

writeFileSync(join(root, "data", "stats.json"), JSON.stringify(stats, null, 2) + "\n", "utf8");

console.log("data/stats.json обновлён");
console.log("  месяцев:", months.length, "| коммитов:", commitDates.length, "| релизов:", releaseTotal, "| разделов документации:", docsSections);
