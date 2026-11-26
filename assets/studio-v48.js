
const SITE_URL     = "./data/site.json";
const RELEASES_URL = "./data/releases.json";
const NEWS_URL     = "./data/news/news.json";
const STATS_URL    = "./data/stats.json";
const GITHUB_API   = "https://api.github.com/repos/";

let SITE_CONFIG = null;  // data/site.json — продукты и игры студии
let RELEASES    = {};    // id продукта → метаданные последнего релиза GitHub

const DEFAULT_LANG = "en";
const STORAGE_KEY = "mbo_lang";
const MANUAL_KEY = "mbo_lang_manual";
const LANG_FILES = ["en", "ru", "uk", "es", "de", "fr", "pt", "zh"];

let TRANSLATIONS = {};
let currentLang = DEFAULT_LANG;
let NEWS_CACHE = null;

/* Курсор заголовка: зацикленный терминальный спиннер */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function startTitleSpinner() {
  const spinner = document.querySelector(".title-spinner");
  if (!spinner) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    spinner.textContent = SPINNER_FRAMES[0];
    return;
  }

  let frame = 0;
  setInterval(() => {
    spinner.textContent = SPINNER_FRAMES[frame];
    frame = (frame + 1) % SPINNER_FRAMES.length;
  }, 90);
}

// Decorative spinner is hidden in the studio design.

async function fetchLocale(lang) {
  const response = await fetch(`./localization/${lang}.json`);
  if (!response.ok) throw new Error(`Failed to load ${lang}.json`);
  return await response.json();
}

async function loadAllTranslations() {
  const results = await Promise.allSettled(
    LANG_FILES.map(async (lang) => {
      const data = await fetchLocale(lang);
      return { lang, data };
    })
  );

  TRANSLATIONS = {};
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      TRANSLATIONS[result.value.lang] = result.value.data;
    } else {
      console.error("Failed to load locale:", result.reason);
    }
  });
}

function detectBrowserLang() {
  const available = LANG_FILES;
  const candidates = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || navigator.userLanguage || ""];

  for (const raw of candidates) {
    const short = String(raw).toLowerCase().split("-")[0];
    if (available.includes(short)) return short;
  }
  return null;
}

function getLang() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
}

function setLang(code) {
  if (!TRANSLATIONS[code]) code = DEFAULT_LANG;
  currentLang = code;
  localStorage.setItem(STORAGE_KEY, code);
  document.documentElement.lang = code;
  applyTranslations();
  renderLangMenu();
  updateLangButton();
}

function t(key) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS[DEFAULT_LANG] || {};
  const fallback = TRANSLATIONS[DEFAULT_LANG] || {};
  return dict[key] || fallback[key] || key;
}

function fillTemplate(str, vars) {
  return String(str == null ? "" : str).replace(/\{(\w+)\}/g, (m, k) =>
    (vars && vars[k] != null) ? String(vars[k]) : m
  );
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Убирает ведущие эмодзи/символы из подписей кнопок — в дизайне только ASCII */
function cleanLabel(str) {
  return String(str == null ? "" : str)
    .replace(/^[^\p{L}\p{N}\[]+/u, "")
    .trim();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const value = fillTemplate(t(key), { year: new Date().getFullYear() });
    if (value.includes('<') || value.includes('&')) {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  });
  renderProducts();
  renderGames();
  renderCurrentGameDetail();
  refreshDocs();
  if (STATS) {
    renderGrowthFacts();
    renderGrowthRange();
    renderGrowth();
  }

  const growthTabs = document.querySelector(".growth-tabs");
  if (growthTabs) {
    growthTabs.setAttribute("aria-label", t("growth.tablist"));
  }
  // Если вкладка новостей открыта — перерисовываем на текущем языке
  const newsPage = document.getElementById("page-news");
  if (newsPage && !newsPage.classList.contains("hidden")) {
    renderNews();
  }
  updateThemeButton();
  renderThemeMenu();
  if (lightboxArt.length) renderLightbox(lightboxIndex);
}

function renderLangMenu() {
  const menu = document.getElementById('langMenu');
  menu.innerHTML = '';
  Object.entries(TRANSLATIONS).forEach(([code, dict]) => {
    const btn = document.createElement('button');
    btn.className = 'lang-item' + (code === currentLang ? ' active' : '');
    btn.setAttribute('role', 'menuitem');
    btn.innerHTML = `<span class="flag">[${escapeHtml(code)}]</span><span>${escapeHtml(dict._name || code)}</span>`;
    btn.onclick = () => {
      setLang(code);
      localStorage.setItem(MANUAL_KEY, "1");
      closeLangMenu();
    };
    menu.appendChild(btn);
  });
}

function updateLangButton() {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS[DEFAULT_LANG] || {};
  document.getElementById('langFlag').textContent = String(currentLang).toUpperCase();
  document.getElementById('langLabel').textContent = dict._name || currentLang;
}

function closeLangMenu() {
  document.getElementById('langMenu').classList.remove('open');
  document.getElementById('langBtn').setAttribute('aria-expanded', 'false');
}

document.getElementById('langBtn').addEventListener('click', e => {
  e.stopPropagation();
  const menu = document.getElementById('langMenu');
  const open = !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  document.getElementById('langBtn').setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', () => { closeLangMenu(); closeThemeMenu(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeLangMenu(); closeThemeMenu(); }
});

/* ============ ТЕМА: системная / тёмная / светлая ============ */

const THEME_KEY = "mbo_theme";
const THEME_OPTIONS = [
  ["system", "◐"],
  ["dark", "●"],
  ["light", "○"]
];

function getThemePref() {
  const saved = localStorage.getItem(THEME_KEY);
  return THEME_OPTIONS.some(([key]) => key === saved) ? saved : "system";
}

function systemTheme() {
  return (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches)
    ? "light"
    : "dark";
}

/* Если переводов ещё нет — короткие английские подписи вместо ключей */
function themeLabel(key) {
  const value = t("theme." + key);
  if (value !== "theme." + key) return value;
  return { system: "System", dark: "Dark", light: "Light" }[key] || key;
}

function applyTheme(pref) {
  const resolved = (pref === "light" || pref === "dark") ? pref : systemTheme();
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  updateThemeButton();
}

function setTheme(pref) {
  localStorage.setItem(THEME_KEY, pref);
  applyTheme(pref);
  renderThemeMenu();
}

function updateThemeButton() {
  const pref = getThemePref();
  const icon = document.getElementById("themeIcon");
  const label = document.getElementById("themeLabel");
  const btn = document.getElementById("themeBtn");
  const option = THEME_OPTIONS.find(([key]) => key === pref) || THEME_OPTIONS[0];
  if (icon) icon.textContent = option[1];
  if (label) label.textContent = themeLabel(pref);
  if (btn) btn.setAttribute("aria-label", t("theme.aria"));
}

function renderThemeMenu() {
  const menu = document.getElementById("themeMenu");
  if (!menu) return;
  const pref = getThemePref();
  menu.innerHTML = "";
  THEME_OPTIONS.forEach(([key, icon]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-item" + (key === pref ? " active" : "");
    btn.setAttribute("role", "menuitem");
    btn.innerHTML = `<span class="flag">${icon}</span><span>${escapeHtml(themeLabel(key))}</span>`;
    btn.onclick = () => { setTheme(key); closeThemeMenu(); };
    menu.appendChild(btn);
  });
}

function closeThemeMenu() {
  const menu = document.getElementById("themeMenu");
  const btn = document.getElementById("themeBtn");
  if (menu) menu.classList.remove("open");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

const themeBtnEl = document.getElementById("themeBtn");
if (themeBtnEl) {
  themeBtnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = document.getElementById("themeMenu");
    const open = !menu.classList.contains("open");
    closeLangMenu();
    menu.classList.toggle("open", open);
    themeBtnEl.setAttribute("aria-expanded", String(open));
  });
}

if (window.matchMedia) {
  const schemeQuery = window.matchMedia("(prefers-color-scheme: light)");
  const onSchemeChange = () => { if (getThemePref() === "system") applyTheme("system"); };
  if (schemeQuery.addEventListener) schemeQuery.addEventListener("change", onSchemeChange);
  else if (schemeQuery.addListener) schemeQuery.addListener(onSchemeChange);
}

applyTheme(getThemePref());
renderThemeMenu();

/* ============================================================
   MOTION — появление блоков при прокрутке (один раз, мягко)
   ============================================================ */
const revealObserver = ("IntersectionObserver" in window)
  ? new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -32px 0px" })
  : null;

function setupReveal(root) {
  if (!revealObserver) return;
  const scope = root || document;
  scope.querySelectorAll("[data-reveal]:not(.is-revealed)").forEach((el, i) => {
    el.style.setProperty("--reveal-delay", `${Math.min(i, 4) * 45}ms`);
    revealObserver.observe(el);
  });
}

setupReveal(document);

/* Заполнение прогресса проигрывается заново при каждом входе на вкладку */
function replayMeters() {
  document.querySelectorAll(".game-card .meter-fill").forEach((fill) => {
    fill.style.transition = "none";
    fill.style.transform = "scaleX(0)";
    void fill.offsetWidth;
    fill.style.transition = "";
    fill.style.transform = "";
  });
}

function switchPage(key, el) {
  if (key !== "doc" && window.location.hash.indexOf("#docs/") === 0) {
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (e) {}
  }
  closeLightbox();
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const page = document.getElementById('page-' + key);
  if (page) {
    page.classList.remove('hidden');
    void page.offsetWidth;
  }

  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  else {
    document.querySelectorAll('.nav-item').forEach(i => {
      if (i.dataset.page === key) i.classList.add('active');
    });
  }

  // Плавная прокрутка включена для ссылок, но смена вкладки должна стартовать сразу сверху
  const scrollRoot = document.documentElement;
  const prevBehavior = scrollRoot.style.scrollBehavior;
  scrollRoot.style.scrollBehavior = "auto";
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  } catch (e) {
    window.scrollTo(0, 0);
  }
  scrollRoot.style.scrollBehavior = prevBehavior;

  setupReveal(page);
  if (key === 'games') replayMeters();
  if (key === "about" && typeof STATS !== "undefined" && STATS) {renderGrowthFacts();renderGrowth();}

  if (key === 'news') loadNews();
  if (key === 'docs') renderDocsArchive();
}
function switchPageByKey(key) { switchPage(key, null); }

/* ============ АВТОМАТИЗАЦИЯ: КОНФИГ + РЕЛИЗЫ GITHUB ============ */

async function fetchJson(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { cache: "no-cache", signal: controller.signal });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function pickAsset(assets, pattern) {
  const zips = (assets || []).filter(a => /\.zip$/i.test(a.name || ""));
  const hit = zips.find(a => (a.name || "").toLowerCase()
    .includes(String(pattern || "windows").toLowerCase()));
  return hit || zips[0] || null;
}

async function loadSiteConfig() {
  try {
    SITE_CONFIG = await fetchJson(SITE_URL);
  } catch (e) {
    console.error("Не удалось загрузить site.json:", e);
    SITE_CONFIG = { products: [], games: [] };
  }
  renderTerminalList();
}

async function loadReleases() {
  // 1) Сначала читаем кэш, который обновляет GitHub Action (data/releases.json)
  try {
    const data = await fetchJson(RELEASES_URL);
    if (data && data.products) { RELEASES = data.products; return; }
  } catch (e) {
    console.warn("releases.json недоступен, пробуем GitHub API напрямую");
  }

  // 2) Fallback: живой запрос к GitHub API (без токена лимит 60 запросов/час)
  const live = {};
  await Promise.all(((SITE_CONFIG && SITE_CONFIG.products) || []).map(async (p) => {
    try {
      const releasePath = p.includePrereleases ? "/releases?per_page=20" : "/releases/latest";
      const response = await fetchJson(GITHUB_API + p.repo + releasePath);
      const r = p.includePrereleases ? response.find(release => !release.draft && release.published_at) : response;
      if (!r) return;
      const asset = p.includePrereleases ? null : pickAsset(r.assets, p.assetPattern);
      live[p.id] = {
        version: r.tag_name,
        publishedAt: r.published_at,
        htmlUrl: r.html_url,
        downloadUrl: asset ? asset.browser_download_url : r.html_url,
        body: r.body || ""
      };
    } catch (e) {
      console.warn("GitHub API недоступен для", p.repo, e);
    }
  }));
  if (Object.keys(live).length) RELEASES = live;
}

function productRelease(p) {
  const r = RELEASES[p.id] || {};
  return {
    version: r.version || p.fallbackVersion || "",
    publishedAt: r.publishedAt || "",
    htmlUrl: r.htmlUrl || p.fallbackDownload || `https://github.com/${p.repo}/releases`,
    downloadUrl: r.downloadUrl || p.fallbackDownload || `https://github.com/${p.repo}/releases`,
    body: r.body || ""
  };
}

function applyProductMeta() {
  const products = (SITE_CONFIG && SITE_CONFIG.products) || [];
  const statProducts = document.getElementById("statProducts");
  if (statProducts) statProducts.textContent = String(products.length).padStart(2, "0");
}

function renderTerminalList() {
  const el = document.getElementById("terminalList");
  if (!el) return;
  const products = (SITE_CONFIG && SITE_CONFIG.products) || [];
  el.textContent = products.length
    ? products.map(p => "  " + p.name).join("\n")
    : "  no products";
}

/* ============ ПРОЕКТЫ (из data/site.json) ============ */

// Фичи продукта: сначала данные из site.json, затем старые ключи локализации
function productFeatures(p) {
  const inline = pickLocalized(p.features);
  if (Array.isArray(inline) && inline.length) return inline;

  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS[DEFAULT_LANG] || {};
  const fallback = TRANSLATIONS[DEFAULT_LANG] || {};
  const keys = [];
  for (let i = 1; ; i++) {
    const key = `${p.id}.f${i}`;
    if (!(key in dict) && !(key in fallback)) break;
    keys.push(key);
  }
  return keys.map(key => t(key));
}

function renderProducts() {
  const list = document.getElementById("projectsList");
  if (!list) return;

  const products = (SITE_CONFIG && SITE_CONFIG.products) || [];
  if (!products.length) {
    list.innerHTML = `<div class="empty">${escapeHtml(t("projects.empty"))}</div>`;
    return;
  }

  list.innerHTML = products.map((p, i) => {
    const r = productRelease(p);
    const hasDownload = Boolean((RELEASES[p.id] && RELEASES[p.id].downloadUrl) || p.fallbackDownload);

    const meta = [p.platform, p.license]
      .filter(Boolean)
      .map(v => escapeHtml(v))
      .join(" · ");

    const features = productFeatures(p)
      .map(text => `<li><span class="plus" aria-hidden="true">+</span><span>${escapeHtml(text)}</span></li>`)
      .join("");

    return `
      <article class="card product-showcase" data-product="${escapeHtml(p.id)}" data-reveal>
        <header class="card-head">
          <span class="product-icon" aria-hidden="true">${p.id==="launcher"?"◇":p.id==="packer"?"▣":"▦"}</span>
          <h2 class="card-title">${escapeHtml(p.name)}</h2>
          <span class="card-meta">${meta}</span>${r.version ? `<span class="product-version">${escapeHtml(r.version)}</span>` : ""}
        </header>

        <p class="card-desc">${escapeHtml(pickLocalized(p.desc) || "")}</p>

        <ul class="feature-list">${features}</ul>

        <div class="card-actions">
          ${hasDownload
            ? `<a class="btn btn-primary" href="${r.downloadUrl}" target="_blank" rel="noopener">${escapeHtml(cleanLabel(pickLocalized(p.download) || "Download .zip"))}</a>`
            : `<span class="btn btn-disabled" aria-disabled="true">${escapeHtml(t("games.status.dev"))}</span>`}
          <a class="btn" href="https://github.com/${p.repo}" target="_blank" rel="noopener">${escapeHtml(t("common.github"))}</a>
          ${(!hasDownload || r.htmlUrl !== r.downloadUrl)
            ? `<a class="btn btn-quiet" href="${r.htmlUrl}" target="_blank" rel="noopener">${escapeHtml(t("common.releases"))}</a>`
            : ""}
        </div>
      </article>`;
  }).join("");

  setupReveal(list);
}

/* ============ ИГРЫ (из data/site.json) ============ */

function renderGames() {
  const list = document.getElementById("gamesList");
  if (!list) return;

  const games = (SITE_CONFIG && SITE_CONFIG.games) || [];
  if (!games.length) {
    list.innerHTML = `<div class="empty">${escapeHtml(t("games.empty"))}</div>`;
    return;
  }

  list.innerHTML = games.map(g => {
    const cover = g.cover
      ? `<img class="cover-img" src="${g.cover}" alt="${escapeHtml(g.name)}" loading="lazy" decoding="async" onerror="this.remove()">`
      : "";

    const unknown=({ru:"Не объявлено",uk:"Не оголошено",de:"Nicht angekündigt",fr:"Non annoncé",es:"Sin anunciar",pt:"Não anunciado",zh:"待公布"}[currentLang]||"TBA");
    const meta = [
      ["games.label.release", g.release],
      ["games.label.genre", pickLocalized(g.genre)],
      ["games.label.platform", pickLocalized(g.platform)]
    ]
      .map(([key,val])=>[key,val||unknown])
      .map(([key, val]) =>
        `<span class="meta-item"><span class="meta-key">${escapeHtml(t(key))}</span>${escapeHtml(String(val))}</span>`
      )
      .join("");

    let progress = `<div class="progress progress-unknown"><div class="progress-head"><span>${escapeHtml(t("games.progress"))}</span><span class="progress-pct">—</span></div><div class="meter" role="img" aria-label="${escapeHtml(unknown)}"></div></div>`;
    if (typeof g.progress === "number") {
      const pct = Math.min(100, Math.max(0, g.progress));

      progress = `
        <div class="progress">
          <div class="progress-head">
            <span>${escapeHtml(t("games.progress"))}</span>
            <span class="progress-pct">${pct}%</span>
          </div>
          <div class="meter" role="img" aria-label="${escapeHtml(t("games.progress"))}: ${pct}%">
            <span class="meter-fill" style="--meter-pct:${pct}%"></span>
          </div>
        </div>`;
    }

        const follow = g.link
      ? `<a class="btn ${g.id === "jack-revenant" ? "btn-primary" : ""}" href="${g.link}" target="_blank" rel="noopener">${escapeHtml(g.id === "jack-revenant" ? (currentLang === "ru" ? "Сайт игры ↗" : "Website ↗") : cleanLabel(t("games.follow")))}</a>`
      : "";

    return `
      <article class="card game-card" data-game="${escapeHtml(g.id)}"
        data-reveal>
        <div class="game-cover">
          <span class="cover-fallback" aria-hidden="true">✦</span>
          ${cover}
          <span class="status">${escapeHtml(t("games.status." + (g.status || "dev")))}</span>
        </div>
        <div class="game-body">
          <header class="card-head">
            <h2 class="card-title">${escapeHtml(g.name)}</h2>
            
          </header>
          <div class="game-meta">${meta}</div>
          <p class="game-desc">${escapeHtml(pickLocalized(g.desc) || "")}</p>
          ${progress}
          <div class="card-actions">
            ${g.id !== "jack-revenant" ? `<button type="button" class="btn btn-primary" onclick="openGame('${escapeHtml(g.id)}')">${escapeHtml(({ru:"Подробнее",uk:"Докладніше",de:"Details",fr:"Détails",es:"Detalles",pt:"Detalhes",zh:"详情"}[currentLang]||"Explore"))} ↗</button>` : ""}
            ${follow}
          </div>
        </div>
      </article>`;
  }).join("");

  setupReveal(list);
}

/* ============ СТРАНИЦА ИГРЫ (подробности и концепт-арты) ============ */

let CURRENT_GAME_ID = null;
let currentDetailArt = [];

function openGame(id, event) {
  if (event && event.target.closest("a, button")) return;
  if(id==="jack-revenant"){window.location.href="https://jack-revenant-website.vercel.app/#case";return;}
  const game = ((SITE_CONFIG && SITE_CONFIG.games) || []).find(g => g.id === id);
  if (!game) return;

  CURRENT_GAME_ID = id;
  renderGameDetail(game);
  switchPage("game-detail", null);
  document.querySelectorAll(".nav-item").forEach(i => {
    i.classList.toggle("active", i.dataset.page === "games");
  });
}

function renderCurrentGameDetail() {
  if (!CURRENT_GAME_ID) return;
  const game = ((SITE_CONFIG && SITE_CONFIG.games) || []).find(g => g.id === CURRENT_GAME_ID);
  if (game) renderGameDetail(game);
}

function renderGameDetail(game) {
  const root = document.getElementById("gameDetailRoot");
  if (!root || !game) return;

  const details = game.details || {};

  const meta = [
    ["games.label.release", game.release],
    ["games.label.genre", pickLocalized(game.genre)],
    ["games.label.platform", pickLocalized(game.platform)]
  ]
    .filter(m => m[1])
    .map(([key, val]) =>
      `<span class="meta-item"><span class="meta-key">${escapeHtml(t(key))}</span>${escapeHtml(String(val))}</span>`
    )
    .join("");

  const art = (details.art || []).filter(item => item && item.src);
  const artHtml = art.length
    ? `<div class="art-grid">${art.map((item, i) => {
        const caption = pickLocalized(item.caption) || "";
        return `
        <button class="art-item" type="button" data-art-index="${i}" aria-label="${escapeHtml(caption || game.name)}">
          <span class="art-thumb">
            <img src="${escapeHtml(item.src)}" alt="${escapeHtml(caption || game.name)}" loading="lazy" decoding="async">
          </span>
          <span class="art-caption">${escapeHtml(caption)}</span>
        </button>`;
      }).join("")}</div>`
    : `<p class="detail-empty">${escapeHtml(t("game.art.empty"))}</p>`;

  // Плитки рисуются каждый раз заново — запоминаем список для галереи
  currentDetailArt = art;

  root.innerHTML = `
    <div class="page-head" data-reveal>
      <button class="back-link" type="button" onclick="switchPageByKey('games')">${escapeHtml(t("game.back"))}</button>
      <div class="eyebrow"><span class="br">[</span> ~/games/${escapeHtml(game.id)} <span class="br">]</span></div>
      <h1 class="page-title">${escapeHtml(game.name)}</h1>
      <p class="page-sub">${escapeHtml(pickLocalized(details.tagline) || pickLocalized(game.desc) || "")}</p>
    </div>

    <div class="stack">
      <article class="card" data-reveal>
        <header class="card-head">
          <span class="index">[ ${escapeHtml(t("games.status." + (game.status || "dev")))} ]</span>
          <span class="card-meta">${escapeHtml(game.release || "")}</span>
        </header>
        <div class="game-meta">${meta}</div>
        <p class="card-desc">${escapeHtml(pickLocalized(details.about) || pickLocalized(game.desc) || "")}</p>
      </article>

      <section class="detail-section" data-reveal>
        <h2 class="detail-section-title">${escapeHtml(t("game.art"))}</h2>
        ${artHtml}
      </section>
    </div>`;

  setupReveal(root);
}

/* ============ LIGHTBOX — полноэкранный просмотр артов ============ */

let lightboxArt = [];
let lightboxIndex = 0;
let lightboxReturnFocus = null;
let lightboxTouchX = null;

function openLightbox(art, index) {
  const box = document.getElementById("lightbox");
  if (!box || !art || !art.length) return;

  lightboxArt = art;
  lightboxReturnFocus = document.activeElement;
  renderLightbox(index);
  box.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  const closeBtn = document.getElementById("lightboxClose");
  if (closeBtn) closeBtn.focus({ preventScroll: true });
}

function renderLightbox(index) {
  const total = lightboxArt.length;
  if (!total) return;

  lightboxIndex = ((index % total) + total) % total;
  const item = lightboxArt[lightboxIndex];
  const caption = pickLocalized(item.caption) || "";

  const img = document.getElementById("lightboxImage");
  const cap = document.getElementById("lightboxCaption");
  const count = document.getElementById("lightboxCount");
  const prev = document.getElementById("lightboxPrev");
  const next = document.getElementById("lightboxNext");

  if (img) { img.src = item.src; img.alt = caption; }
  if (cap) cap.textContent = caption;
  if (count) count.textContent = `${lightboxIndex + 1} / ${total}`;

  const single = total < 2;
  if (prev) prev.hidden = single;
  if (next) next.hidden = single;
}

function stepLightbox(delta) {
  if (!lightboxArt.length) return;
  renderLightbox(lightboxIndex + delta);
}

function closeLightbox() {
  const box = document.getElementById("lightbox");
  if (!box || box.classList.contains("hidden")) return;

  box.classList.add("hidden");
  document.body.style.overflow = "";

  const img = document.getElementById("lightboxImage");
  if (img) img.removeAttribute("src");

  lightboxArt = [];
  lightboxTouchX = null;

  if (lightboxReturnFocus && typeof lightboxReturnFocus.focus === "function") {
    lightboxReturnFocus.focus({ preventScroll: true });
  }
  lightboxReturnFocus = null;
}

// Один слушатель на контейнер: работает и после перерисовки страницы игры
const detailRootEl = document.getElementById("gameDetailRoot");
if (detailRootEl) {
  detailRootEl.addEventListener("click", (e) => {
    const tile = e.target.closest("[data-art-index]");
    if (!tile || !currentDetailArt.length) return;
    openLightbox(currentDetailArt, Number(tile.dataset.artIndex));
  });
}

const lightboxEl = document.getElementById("lightbox");
if (lightboxEl) {
  const closeBtn = document.getElementById("lightboxClose");
  const prevBtn = document.getElementById("lightboxPrev");
  const nextBtn = document.getElementById("lightboxNext");

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (prevBtn) prevBtn.addEventListener("click", () => stepLightbox(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => stepLightbox(1));

  // Клик мимо изображения закрывает просмотр
  lightboxEl.addEventListener("click", (e) => {
    if (e.target === lightboxEl) closeLightbox();
  });

  // Свайп на телефоне
  lightboxEl.addEventListener("touchstart", (e) => {
    lightboxTouchX = e.changedTouches[0].clientX;
  }, { passive: true });
  lightboxEl.addEventListener("touchend", (e) => {
    if (lightboxTouchX == null) return;
    const dx = e.changedTouches[0].clientX - lightboxTouchX;
    lightboxTouchX = null;
    if (Math.abs(dx) > 40) stepLightbox(dx < 0 ? 1 : -1);
  }, { passive: true });
}

document.addEventListener("keydown", (e) => {
  const box = document.getElementById("lightbox");
  if (!box || box.classList.contains("hidden")) return;
  if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); stepLightbox(-1); }
  else if (e.key === "ArrowRight") { e.preventDefault(); stepLightbox(1); }
});

/* ============ НОВОСТИ ============ */

// Выбор значения из объекта переводов по текущему языку
function pickLocalized(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value[currentLang] || value[DEFAULT_LANG] || Object.values(value)[0] || "";
  }
  return String(value);
}

async function loadNews() {
  const container = document.getElementById("newsList");
  if (!container) return;

  // Если ещё не загружали — показываем "загрузка" и фетчим
  if (!NEWS_CACHE) {
    container.innerHTML = `<div class="empty">${escapeHtml(t("news.loading"))}</div>`;
    try {
      const res = await fetch(NEWS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("news.json not found");
      const data = await res.json();
      NEWS_CACHE = Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("Failed to load news:", e);
      container.innerHTML = `<div class="empty">${escapeHtml(t("news.error"))}</div>`;
      return;
    }
  }
  renderNews();
}

// Автоматические новости из релизов GitHub (публикуются без ручного редактирования)
// Если ручная новость уже освещает продукт (поле "products": ["launcher"]),
// авто-новость для него не дублируется. Версии в заголовке не показываем.
function autoReleaseNews() {
  const covered = new Set();
  (NEWS_CACHE || []).forEach(item =>
    (item.products || []).forEach(id => covered.add(id))
  );

  const products = (SITE_CONFIG && SITE_CONFIG.products) || [];
  return products.filter(p => !covered.has(p.id)).map(p => {
    const r = productRelease(p);
    if (!r.publishedAt && !r.version) return null;

    const vars = { product: p.name };
    const titleTemplate = String(t("news.release.title")).replace(/\s*\{version\}/g, "").trim();
    const text = (currentLang === DEFAULT_LANG && r.body)
      ? r.body.replace(/\r/g, "").trim().slice(0, 600)
      : fillTemplate(t("news.release.text"), vars);

    return {
      date: r.publishedAt ? String(r.publishedAt).slice(0, 10) : "",
      tag: t("news.release.tag"),
      title: fillTemplate(titleTemplate, vars),
      text,
      link: r.htmlUrl
    };
  }).filter(Boolean);
}

function renderNews() {
  const container = document.getElementById("newsList");
  if (!container) return;

  // Ручные новости (news.json) + автоматические из релизов GitHub
  const all = [...(NEWS_CACHE || []), ...autoReleaseNews()];

  if (all.length === 0) {
    container.innerHTML = `<div class="empty">${escapeHtml(t("news.empty"))}</div>`;
    return;
  }

  // Сортировка по дате (новые сверху)
  const sorted = [...all].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return db - da;
  });

  container.innerHTML = sorted.map(item => {
    const title = escapeHtml(pickLocalized(item.title));
    const text = escapeHtml(pickLocalized(item.text));
    const tagRaw = pickLocalized(item.tag);
    const tag = tagRaw ? `<span class="news-tag">[ ${escapeHtml(tagRaw)} ]</span>` : "";
    const link = item.link
      ? `<a class="news-link" href="${item.link}" target="_blank" rel="noopener">${escapeHtml(t("news.release.more"))} ↗</a>`
      : "";
    const image = item.image
      ? `<div class="news-media"><img src="${escapeHtml(item.image)}" alt="${title}" loading="lazy" decoding="async" onerror="this.parentElement.remove()"></div>`
      : "";

    return `
      <article class="news-item" data-reveal>
        ${image}
        <div class="news-body">
          <div class="news-meta">
            ${item.date ? `<span class="news-date">${escapeHtml(item.date)}</span>` : ""}
            ${tag}
          </div>
          <h3 class="news-title">${title}</h3>
          <div class="news-text">${text}</div>
          ${link}
        </div>
      </article>`;
  }).join("");

  setupReveal(container);
}

/* ============ ГРАФИК РОСТА (data/stats.json) ============ */

let STATS = null;
let growthSeries = "commits";
let growthTotalShown = 0;
let growthTotalSeries = null;
let growthTotalFrame = 0;

async function loadStats() {
  const panel = document.getElementById("growthPanel");
  try {
    STATS = await fetchJson(STATS_URL);
    if(STATS?.totals && STATS?.series){STATS.totals.releases=Math.max(3,STATS.totals.releases||0);STATS.totals.plannedGames=2;const month="2026-11-01";const releases=STATS.series.releases;if(Array.isArray(releases)){const p=releases.find(p=>p.date===month);if(p)p.value=Math.max(3,p.value||0);else releases.push({date:month,value:3});}STATS.series.game=[{date:month,value:2}];}
  } catch (e) {
    console.warn("stats.json недоступен, график скрыт:", e);
    STATS = null;
  }

  if (!panel) return;
  if (!STATS || !STATS.series) {
    panel.hidden = true;
    return;
  }

  renderGrowthFacts();
  renderGrowthRange();
  renderGrowth();
}

/* Даты берём как есть, без сдвига часового пояса */
function growthDate(value) {
  const parts = String(value).split("-").map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

function formatGrowthDay(value) {
  return growthDate(value).toLocaleDateString(currentLang, { day: "numeric", month: "short", year: "numeric" });
}

function formatGrowthMonth(value) {
  return growthDate(value).toLocaleDateString(currentLang, { month: "short" });
}

function growthNumber(value) {
  return Number(value).toLocaleString(currentLang);
}

/* Единица измерения с правильным склонением: 1 коммит, 2 коммита, 94 коммита */
function growthUnit(series, value) {
  if(series === "game") return ""; const base = "growth.unit." + series;
  if (series === "game") return t(base);

  const count = Number(value);
  const pick = (key) => {
    const text = t(key);
    return text === key ? t(base) : text;
  };

  if (currentLang === "ru" || currentLang === "uk") {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return pick(base + ".one");
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return pick(base + ".few");
    return t(base);
  }

  return count === 1 ? pick(base + ".one") : t(base);
}

function renderGrowthRange() {
  const el = document.getElementById("growthRange");
  if (!el || !STATS || !STATS.range) return;
  el.textContent = `${formatGrowthDay(STATS.range.from)} — ${formatGrowthDay(STATS.range.to)}`;
}

function renderGrowthFacts() {
  const host = document.getElementById("growthFacts");
  if (!host || !STATS || !STATS.totals) return;

  const totals = STATS.totals;
  const items = [
    ["growth.stat.commits", (Object.keys(activityResults).length===activityRepos.length ? growthNumber(Object.values(activityResults).reduce((sum,m)=>sum+Object.values(m).reduce((a,b)=>a+b,0),0)) : "≥"+growthNumber(Math.max(totals.commits||0,Object.values(activitySnapshot).reduce((a,b)=>a+b,0),Object.values(activityResults).reduce((sum,m)=>sum+Object.values(m).reduce((a,b)=>a+b,0),0))))],
    ["growth.stat.releases", growthNumber(totals.releases)],
    ["growth.stat.docs", growthNumber(totals.docs)],
    ["growth.stat.game", growthNumber(totals.plannedGames ?? 2)]
  ];

  host.innerHTML = items.map(([key, value]) => `
          <div class="growth-fact">
            <span class="growth-fact-value">${escapeHtml(String(value))}</span>
            <span class="growth-fact-label">${escapeHtml(key === "growth.stat.game" ? ({ru:"Игры в планах",uk:"Ігри в планах",de:"Geplante Spiele",fr:"Jeux prévus",es:"Juegos previstos",pt:"Jogos planejados",zh:"计划中的游戏"}[currentLang] || "Planned games") : t(key))}</span>
          </div>`).join("");
  const home=document.getElementById("homeFacts");if(home)home.innerHTML=host.innerHTML;
}

function setGrowthSeries(name) {
  if (["commits", "releases", "game"].indexOf(name) === -1) return;
  growthSeries = name;
  document.querySelectorAll(".growth-tab").forEach(tab => {
    const active = tab.dataset.series === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  renderGrowth();
}

/* Рисуем SVG вручную: сглаженная линия, заливка, сетка, ховер */
const activitySnapshot={"2026-11-26":44,"2026-11-23":1,"2026-11-19":7,"2026-11-16":8,"2026-11-13":3,"2026-11-12":1,"2026-11-09":10,"2026-11-08":1,"2026-11-07":1,"2026-11-05":1,"2026-10-21":14,"2026-10-18":3,"2026-10-15":5,"2026-10-04":1};
let activityData=activitySnapshot, activityFrom="2026-10-04",activityTo="2026-11-26",activityComplete=false,activityRequested=false;
const activityRepos=[["Studio website","Made-by-One/Made-by-One.github.io"],["Devers-Workmods","Made-by-One/Devers-Workmods"],["Devers-Launcher","Made-by-One/Devers-Launcher"],["Devers-Packer","Made-by-One/Devers-Packer"]];
let activityFilter="all",activityResults={};
document.addEventListener("pointerdown",e=>{const picker=document.querySelector(".activity-picker[open]");if(picker&&!picker.contains(e.target))picker.open=false;});
function selectActivity(){const keys=activityFilter==="all"?activityRepos.map(x=>x[1]):[activityFilter];const map={};let complete=true;for(const key of keys){const result=activityResults[key];if(!result){complete=false;continue}for(const [d,n] of Object.entries(result))map[d]=(map[d]||0)+n}activityData=map;activityComplete=complete;}
function restoreActivityCache(){try{const c=JSON.parse(localStorage.getItem("mbo.activity.v5")||"null");if(!c||!c.results||typeof c.from!=="string"||typeof c.to!=="string")return false;activityResults=c.results;activityFrom=c.from;activityTo=c.to;selectActivity();return Date.now()-c.saved<900000&&Object.keys(c.results).length===activityRepos.length}catch{return false}}
async function refreshActivity(){
 if(activityRequested)return;activityRequested=true;if(restoreActivityCache()){renderGrowthFacts();renderGrowth();return;}
 try{const res=await fetch('./data/activity.json');if(res.ok){const c=await res.json();if(c.results&&activityRepos.every(x=>c.results[x[1]])&&Date.now()-Date.parse(c.to)<172800000){activityResults=c.results;activityFrom=c.from;activityTo=c.to;selectActivity();renderGrowthFacts();renderGrowth();return;}}}catch{}
 const until=new Date(),since=new Date(until);since.setUTCDate(since.getUTCDate()-364);since.setUTCHours(0,0,0,0);
 await Promise.all(activityRepos.map(async ([name,repo])=>{try{const map={};for(let page=1;page<=10;page++){const res=await fetch("https://api.github.com/repos/"+repo+"/commits?per_page=100&page="+page+"&since="+encodeURIComponent(since.toISOString())+"&until="+encodeURIComponent(until.toISOString()));if(!res.ok)throw Error("GitHub "+res.status);const rows=await res.json();if(!Array.isArray(rows))throw Error("Invalid response");for(const c of rows){const d=c.commit?.committer?.date?.slice(0,10);if(d)map[d]=(map[d]||0)+1}if(rows.length<100){activityResults[repo]=map;return}}}catch(e){console.warn(repo,e)}}));
 if(Object.keys(activityResults).length){activityFrom=since.toISOString().slice(0,10);activityTo=until.toISOString().slice(0,10);selectActivity();try{localStorage.setItem('mbo.activity.v5',JSON.stringify({results:activityResults,from:activityFrom,to:activityTo,saved:Date.now()}))}catch{}renderGrowthFacts();renderGrowth();}
}
function renderGrowth(){
 const host=document.getElementById("growthChart");if(!host)return;
 const labels=({ru:["Активность студии","Коммиты сайта за последние 12 месяцев · UTC","Меньше","Больше","Нет данных","Коммиты","Снимок последних 100 коммитов"],uk:["Активність студії","Коміти сайту за останні 12 місяців · UTC","Менше","Більше","Немає даних","Коміти","Знімок останніх 100 комітів"],de:["Studioaktivität","Website-Commits der letzten 12 Monate · UTC","Weniger","Mehr","Keine Daten","Commits","Letzte 100 Commits"],fr:["Activité du studio","Commits du site sur 12 mois · UTC","Moins","Plus","Aucune donnée","Commits","100 derniers commits"],es:["Actividad del estudio","Commits del sitio en 12 meses · UTC","Menos","Más","Sin datos","Commits","Últimos 100 commits"],pt:["Atividade do estúdio","Commits do site em 12 meses · UTC","Menos","Mais","Sem dados","Commits","Últimos 100 commits"],zh:["工作室活动","过去12个月的网站提交 · UTC","少","多","无数据","提交","最近100次提交"]}[currentLang]||["Studio activity","Website commits over the last 12 months · UTC","Less","More","No data","Commits","Latest 100 commits snapshot"]);
 document.getElementById("growthTitle").textContent=labels[0];document.querySelector("#growthPanel .growth-sub").textContent=({ru:"Коммиты проектов за последние 12 месяцев · UTC",uk:"Коміти проєктів за 12 місяців · UTC",de:"Projekt-Commits der letzten 12 Monate · UTC",fr:"Commits des projets sur 12 mois · UTC",es:"Commits de proyectos en 12 meses · UTC",pt:"Commits dos projetos em 12 meses · UTC",zh:"过去12个月的项目提交 · UTC"}[currentLang]||"Project commits over the last 12 months · UTC");document.querySelector("#growthPanel .growth-tabs").hidden=true;
 const end=new Date(activityTo+"T00:00:00Z"),first=new Date(end);first.setUTCDate(first.getUTCDate()-364);const begin=new Date(first);begin.setUTCDate(begin.getUTCDate()-(begin.getUTCDay()+6)%7);
 const total=Object.values(activityData).reduce((a,b)=>a+b,0);document.getElementById("growthTotal").textContent=(activityComplete?"":"≥")+growthNumber(total);document.getElementById("growthTotalLabel").textContent=labels[5];
 let cells="",months="",lastMonth=-1,lastLabelWeek=-4;const fmt=new Intl.DateTimeFormat(currentLang,{month:"short",timeZone:"UTC"}),dayFmt=new Intl.DateTimeFormat(currentLang,{dateStyle:"long",timeZone:"UTC"});
 for(let i=0;i<371;i++){const d=new Date(begin);d.setUTCDate(d.getUTCDate()+i);if(d>end)break;const key=d.toISOString().slice(0,10),week=Math.floor(i/7),row=i%7;if(row===0&&d.getUTCMonth()!==lastMonth&&week-lastLabelWeek>=3){lastLabelWeek=week;months+='<span style="grid-column:'+(week+1)+'">'+escapeHtml(fmt.format(d))+'</span>';lastMonth=d.getUTCMonth()}const known=d>=first&&key>=activityFrom&&(activityComplete||(!Object.keys(activityResults).length&&activityFilter==="all"&&key!==activityFrom)),n=activityData[key]||0,level=!known&&!n?"unknown":n===0?0:n<=2?1:n<=5?2:n<=9?3:4;const label=dayFmt.format(d)+" · "+(known?labels[5]+": "+n:labels[4]+(n?" (≥"+n+")":""));cells+='<button type="button" class="activity-cell" data-level="'+level+'" style="grid-column:'+(week+1)+';grid-row:'+(row+1)+'" aria-label="'+escapeHtml(label)+'" title="'+escapeHtml(label)+'"></button>'}
 const options=[['all',({ru:"Все проекты",uk:"Усі проєкти",de:"Alle Projekte",fr:"Tous les projets",es:"Todos los proyectos",pt:"Todos os projetos",zh:"所有项目"}[currentLang]||"All projects")],...activityRepos.map(([n,r])=>[r,n])];
 host.innerHTML='<details class="activity-picker"><summary><span class="activity-picker-icon">✦</span><span>'+escapeHtml(options.find(x=>x[0]===activityFilter)?.[1]||options[0][1])+'</span><span class="activity-chevron" aria-hidden="true">⌄</span></summary><div class="activity-options">'+options.map(([v,n])=>'<button type="button" data-repo="'+escapeHtml(v)+'" aria-pressed="'+(v===activityFilter)+'">'+escapeHtml(n)+'<span aria-hidden="true">'+(v===activityFilter?'✓':'')+'</span></button>').join("")+'</div></details><div class="activity-scroll"><div class="activity-months">'+months+'</div><div class="activity-grid">'+cells+'</div></div><p class="activity-detail" aria-live="polite">'+escapeHtml(activityComplete?document.querySelector("#growthPanel .growth-sub").textContent:Object.keys(activityResults).length?labels[4]+" · "+Object.keys(activityResults).length+"/"+activityRepos.length:labels[6])+'</p><div class="activity-legend">'+escapeHtml(labels[2])+[0,1,2,3,4].map(n=>'<i class="activity-cell" data-level="'+n+'"></i>').join("")+escapeHtml(labels[3])+'</div>';
 const picker=host.querySelector(".activity-picker");picker.addEventListener("keydown",e=>{if(e.key==="Escape"){picker.open=false;picker.querySelector("summary").focus()}});
 picker.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{activityFilter=btn.dataset.repo;if(!Object.keys(activityResults).length&&activityFilter==="all"){activityData=activitySnapshot;activityComplete=false}else selectActivity();renderGrowth();host.querySelector("summary").focus({preventScroll:true})}));
 const scroller=host.querySelector(".activity-scroll");requestAnimationFrame(()=>{scroller.scrollLeft=scroller.scrollWidth});
 host.querySelectorAll("button.activity-cell").forEach(b=>b.addEventListener("click",()=>{host.querySelector(".activity-detail").textContent=b.getAttribute("aria-label")}));
 if(!activityRequested)refreshActivity();
}

function formatGrowthTotal(value) {
  return growthNumber(Math.round(value));
}

function animateGrowthTotal(target) {
  const el = document.getElementById("growthTotal");
  if (!el) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sameSeries = growthTotalSeries === growthSeries;
  const from = (reduceMotion || !sameSeries) ? 0 : growthTotalShown;
  growthTotalSeries = growthSeries;
  cancelAnimationFrame(growthTotalFrame);

  if (reduceMotion) {
    growthTotalShown = target;
    el.textContent = formatGrowthTotal(target);
    return;
  }

  const duration = 950;
  const started = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    growthTotalShown = from + (target - from) * eased;
    el.textContent = formatGrowthTotal(progress < 1 ? growthTotalShown : target);
    if (progress < 1) {
      growthTotalFrame = requestAnimationFrame(tick);
    } else {
      growthTotalShown = target;
    }
  };
  growthTotalFrame = requestAnimationFrame(tick);
}

/* Рисуем только когда график попал в кадр: анимация не тратится впустую */
function playGrowthAnimation() {
  const panel = document.getElementById("growthPanel");
  const canvas = document.getElementById("growthCanvas");
  if (!panel || !canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    canvas.classList.add("is-drawn");
    const svg = canvas.querySelector(".growth-svg");
    if (svg) svg.classList.add("is-drawn");
    return;
  }

  const start = () => {
    canvas.classList.add("is-drawn");
    const svg = canvas.querySelector(".growth-svg");
    if (svg) svg.classList.add("is-drawn");

    const rect = canvas.querySelector(".growth-reveal-rect");

    requestAnimationFrame(() => {
      if (rect) rect.style.transform = "scaleX(1)";
      const motion = document.getElementById("growthPenMotion");
      const fade = document.getElementById("growthPenFade");
      if (motion && motion.beginElement) {
        motion.beginElement();
        if (fade) fade.beginElement();
      }
    });
  };

  if (!("IntersectionObserver" in window)) {
    start();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      start();
    }
  }, { threshold: 0.2 });
  observer.observe(panel);
}

/* Плашка активной вкладки переезжает к выбранной метрике */
function syncGrowthPill() {
  const tabs = document.querySelector(".growth-tabs");
  if (!tabs) return;
  const pill = tabs.querySelector(".growth-pill");
  const active = tabs.querySelector(".growth-tab.active");
  if (!pill || !active) return;

  const box = tabs.getBoundingClientRect();
  const tab = active.getBoundingClientRect();
  if (!tab.width) return;

  pill.style.width = tab.width.toFixed(1) + "px";
  pill.style.height = tab.height.toFixed(1) + "px";
  pill.style.top = (tab.top - box.top - tabs.clientTop).toFixed(1) + "px";
  pill.style.transform = `translateX(${(tab.left - box.left - tabs.clientLeft).toFixed(1)}px)`;
  pill.classList.add("is-ready");

  if (!syncGrowthPill.bound) {
    syncGrowthPill.bound = true;
    window.addEventListener("resize", syncGrowthPill);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncGrowthPill);
  }
}

function bindGrowthHover(points, px, py, W, H) {
  const canvas = document.getElementById("growthCanvas");
  const marker = document.getElementById("growthMarker");
  const hoverDot = document.getElementById("growthHoverDot");
  const tooltip = document.getElementById("growthTooltip");
  if (!canvas || !marker || !hoverDot || !tooltip) return;

  const hide = () => {
    marker.classList.remove("show");
    hoverDot.classList.remove("show");
    tooltip.classList.remove("show");
  };

  const move = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const xInView = (event.clientX - rect.left) * (W / rect.width);

    let best = -1;
    let bestDistance = Infinity;
    points.forEach((point, i) => {
      if (typeof point.value !== "number") return;
      const distance = Math.abs(px(i) - xInView);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    if (best === -1) return;

    const point = points[best];
    const x = px(best);
    const y = py(point.value);

    marker.setAttribute("x1", x.toFixed(1));
    marker.setAttribute("x2", x.toFixed(1));
    marker.classList.add("show");

    hoverDot.style.left = ((x / W) * 100).toFixed(2) + "%";
    hoverDot.style.top = ((y / H) * 100).toFixed(2) + "%";
    hoverDot.classList.add("show");

    tooltip.style.left = ((x / W) * 100).toFixed(2) + "%";
    tooltip.style.top = ((y / H) * 100).toFixed(2) + "%";
    // У краёв и у верхней точки подсказку сдвигаем внутрь, чтобы не обрезалась
    const shiftX = (x / W) < 0.12 ? "-4px" : (x / W) > 0.88 ? "calc(-100% + 4px)" : "-50%";
    const shiftY = (y / H) < 0.3 ? "14px" : "-118%";
    tooltip.style.transform = `translate(${shiftX}, ${shiftY})`;
    tooltip.innerHTML = `<span class="growth-tooltip-date">${escapeHtml(formatGrowthMonth(point.date))}</span>
      <span class="growth-tooltip-value">${escapeHtml(growthNumber(point.value))} <span>${escapeHtml(growthUnit(growthSeries, point.value))}</span></span>`;
    tooltip.classList.add("show");
  };

  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", move);
  canvas.addEventListener("pointerleave", hide);
}

/* ============ ДОКУМЕНТАЦИЯ: АРХИВ ПРОГРАММ И РАЗДЕЛЫ ============ */

const DOCS_DIR = "./data/docs/";
const DOCS_INDEX_URL = DOCS_DIR + "index.json";

let DOCS_INDEX = null;
let CURRENT_DOC = null;          // { programId, sectionId }
const DOC_CACHE = new Map();     // "lang:program:section" → HTML

async function loadDocsIndex() {
  if (DOCS_INDEX) return DOCS_INDEX;
  DOCS_INDEX = await fetchJson(DOCS_INDEX_URL);
  return DOCS_INDEX;
}

function docPrograms() {
  return (DOCS_INDEX && Array.isArray(DOCS_INDEX.programs)) ? DOCS_INDEX.programs : [];
}

function docProgram(id) {
  return docPrograms().find(p => p.id === id) || null;
}

function docSections(program) {
  return Array.isArray(program.sections) ? program.sections : [];
}

/* Названия разделов лежат в индексе: порядок совпадает с program.sections */
function docTitle(program, sectionId) {
  const titles = program.titles || {};
  const list = titles[currentLang] || titles[DEFAULT_LANG] || [];
  const index = docSections(program).indexOf(sectionId);
  return list[index] || sectionId;
}

function docMeta(program) {
  return [program.version ? "v" + program.version : "", program.license || ""]
    .filter(Boolean)
    .join(" · ");
}

/* Архив документации: по карточке на программу, внутри — все её разделы */
async function renderDocsArchive() {
  const root = document.getElementById("docsArchive");
  if (!root) return;

  try {
    await loadDocsIndex();
  } catch (e) {
    console.error("Failed to load the docs index:", e);
    root.innerHTML = `<div class="empty">${escapeHtml(t("docs.error"))}</div>`;
    return;
  }

  const programs = docPrograms();
  if (!programs.length) {
    root.innerHTML = `<div class="empty">${escapeHtml(t("docs.error"))}</div>`;
    return;
  }

  root.innerHTML = programs.map(program => {
    const sections = docSections(program);
    const entries = sections.map((id, i) => `
          <button class="doc-entry" type="button" onclick="openDoc('${escapeHtml(program.id)}', '${escapeHtml(id)}')">
            <span class="doc-entry-index">${String(i + 1).padStart(2, "0")}</span>
            <span class="doc-entry-title">${escapeHtml(docTitle(program, id))}</span>
            <span class="doc-entry-arrow" aria-hidden="true">→</span>
          </button>`).join("");

    const product = ((SITE_CONFIG && SITE_CONFIG.products) || [])
      .find(item => item.id === program.id);
    const summary = product ? pickLocalized(product.desc) : pickLocalized(program.summary);

    return `
        <article class="card docs-program" data-reveal>
          <header class="card-head">
            <span class="index">[ ${escapeHtml(program.status || "docs")} ]</span>
            <h2 class="card-title">${escapeHtml(program.name)}</h2>
            <span class="card-meta">${escapeHtml(docMeta(program))}</span>
          </header>

          <div class="game-meta">
            <span class="meta-item"><span class="meta-key">${escapeHtml(t("docs.sections"))}</span>${sections.length}</span>
            ${program.platform ? `<span class="meta-item"><span class="meta-key">${escapeHtml(t("games.label.platform"))}</span>${escapeHtml(program.platform)}</span>` : ""}
          </div>

          <p class="card-desc">${escapeHtml(summary)}</p>

          <div class="doc-entries">${entries}</div>

          <div class="card-actions">
            <a class="btn" href="${escapeHtml(program.repo)}" target="_blank" rel="noopener">${escapeHtml(t("common.github"))}</a>
            <a class="btn btn-quiet" href="${escapeHtml(program.releases || program.repo + "/releases")}" target="_blank" rel="noopener">${escapeHtml(t("common.releases"))}</a>
          </div>
        </article>`;
  }).join("");

  setupReveal(root);
}

/* Каркас страницы раздела: сайдбар со всеми разделами программы */
function docShell(program, sectionId) {
  const links = docSections(program).map(id => `
          <a href="#" class="${id === sectionId ? "active" : ""}"
            onclick="openDoc('${escapeHtml(program.id)}', '${escapeHtml(id)}'); return false;">${escapeHtml(docTitle(program, id))}</a>`).join("");

  return `<div class="docs">
    <aside class="docs-aside">
      <button class="back-link" type="button" onclick="switchPageByKey('docs')">← ${escapeHtml(t("docs.all"))}</button>
      <div>
        <div class="docs-aside-label">${escapeHtml(t("docs.title"))}</div>
        <div class="docs-doc-name">${escapeHtml(program.name)}</div>
        <div class="docs-doc-meta">${escapeHtml(docMeta(program))}</div>
      </div>
      <nav class="docs-nav" aria-label="${escapeHtml(t("docs.sections"))}">${links}
      </nav>
      <a class="docs-aside-link" href="${escapeHtml(program.repo)}" target="_blank" rel="noopener">${escapeHtml(t("common.github"))}</a>
    </aside>
    <article class="docs-article" id="docBody">
      <div class="docs-loading">${escapeHtml(t("docs.loading"))}</div>
    </article>
  </div>`;
}

async function fetchDocSection(program, sectionId, lang) {
  const res = await fetch(`${DOCS_DIR}${program.id}.${lang}.${sectionId}.html`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`docs ${lang}/${sectionId} → HTTP ${res.status}`);
  return await res.text();
}

async function renderDocSection(program, sectionId) {
  const body = document.getElementById("docBody");
  if (!body) return;

  const key = `${currentLang}:${program.id}:${sectionId}`;
  let html = DOC_CACHE.get(key);

  if (!html) {
    try {
      html = await fetchDocSection(program, sectionId, currentLang);
    } catch (e) {
      // Нет перевода — показываем английский раздел
      try {
        html = await fetchDocSection(program, sectionId, DEFAULT_LANG);
      } catch (fallbackError) {
        console.error("Failed to load a doc section:", fallbackError);
        body.innerHTML = `<div class="empty">${escapeHtml(t("docs.error"))}</div>`;
        return;
      }
    }
    DOC_CACHE.set(key, html);
  }

  // Быстрое переключение: рисуем только актуальный раздел
  if (!CURRENT_DOC || CURRENT_DOC.programId !== program.id || CURRENT_DOC.sectionId !== sectionId) return;

  const sections = docSections(program);
  const index = sections.indexOf(sectionId);
  const prev = index > 0 ? sections[index - 1] : null;
  const next = index >= 0 && index < sections.length - 1 ? sections[index + 1] : null;

  // Заголовок раздела становится заголовком страницы
  const titled = html
    .replace('<h2 class="doc-h2">', '<h1 class="doc-h2 doc-page-title">')
    .replace("</h2>", "</h1>");

  const pager = `
        <div class="doc-pager">
          ${prev
            ? `<button class="btn btn-quiet" type="button" onclick="openDoc('${escapeHtml(program.id)}', '${escapeHtml(prev)}')">← ${escapeHtml(docTitle(program, prev))}</button>`
            : "<span></span>"}
          ${next
            ? `<button class="btn" type="button" onclick="openDoc('${escapeHtml(program.id)}', '${escapeHtml(next)}')">${escapeHtml(docTitle(program, next))} →</button>`
            : ""}
        </div>`;

  body.innerHTML = titled + pager;
}

async function openDoc(programId, sectionId) {
  try {
    await loadDocsIndex();
  } catch (e) {
    console.error("Failed to load the docs index:", e);
    return;
  }

  const program = docProgram(programId);
  if (!program) return;

  const sections = docSections(program);
  if (!sections.length) return;
  if (!sectionId || sections.indexOf(sectionId) === -1) sectionId = sections[0];

  CURRENT_DOC = { programId: program.id, sectionId };

  const root = document.getElementById("docRoot");
  if (root) root.innerHTML = docShell(program, sectionId);

  switchPage("doc", null);
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === "docs");
  });

  try {
    history.replaceState(null, "", `#docs/${program.id}/${sectionId}`);
  } catch (e) {}

  await renderDocSection(program, sectionId);
}

function restoreDocRoute() {
  const match = /^#docs\/([a-z0-9._-]+)\/([a-z0-9._-]+)$/i.exec(window.location.hash || "");
  if (!match) return false;
  openDoc(match[1], match[2]);
  return true;
}

function refreshDocs() {
  if (DOCS_INDEX) renderDocsArchive();
  if (!CURRENT_DOC) return;
  const program = docProgram(CURRENT_DOC.programId);
  if (!program) return;
  const root = document.getElementById("docRoot");
  if (root) root.innerHTML = docShell(program, CURRENT_DOC.sectionId);
  renderDocSection(program, CURRENT_DOC.sectionId);
}

window.addEventListener("hashchange", () => { restoreDocRoute(); });

async function init() {
  await Promise.all([
    loadAllTranslations(),
    loadSiteConfig().then(loadReleases),
    loadStats()
  ]);

  const saved = localStorage.getItem(STORAGE_KEY);
  const manual = localStorage.getItem(MANUAL_KEY);
  let langToUse;

  if (manual && saved && TRANSLATIONS[saved]) {
    langToUse = saved;
  } else {
    const detected = detectBrowserLang();
    langToUse = (detected && TRANSLATIONS[detected]) ? detected : DEFAULT_LANG;
  }

  setLang(langToUse);
  applyProductMeta();
  restoreDocRoute();
}

window.addEventListener('load', init);
