/**
 * languageRegistry.js
 * Seviye bazlı lazy loading: her CEFR seviyesi fetch() ile yüklenir.
 * JSON.parse native olduğu için dynamic import()'a göre ~10x daha hızlı parse.
 * İlk açılışta sadece A1 yüklenir, diğer seviyeler kilit açıldıkça eklenir.
 */

// ── Sabitler ─────────────────────────────────────────────────────────────────
export const LEVEL_COLORS = {
  A1: '#C4B0CC',   // --primary (light lavender)
  A2: '#AA93BA',
  B1: '#9076A8',
  B2: '#765A96',
  C1: '#5C3D84',
};

export const UNLOCK_THRESHOLD = 0.7;
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

// Vite'ın base URL'i — dev'de ve prod'da otomatik doğru çalışır
const BASE = import.meta.env.BASE_URL; // '/verbyte/'

// ── Dil meta bilgileri ───────────────────────────────────────────────────────
export const LANGS = [
  { code: 'fr', flag: '🇫🇷', label: 'Français',  sub: 'Fransızca öğren', wordKey: 'fr', languageLabel: 'Fransızca' },
  { code: 'en', flag: '🇬🇧', label: 'English',   sub: 'İngilizce öğren', wordKey: 'en', languageLabel: 'İngilizce' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch',   sub: 'Almanca öğren',   wordKey: 'de', languageLabel: 'Almanca'   },
];

// ── fetch helpers ─────────────────────────────────────────────────────────────
function fetchJson(path) {
  return fetch(`${BASE}${path}`).then(r => {
    if (!r.ok) throw new Error(`fetchJson ${path} → ${r.status}`);
    return r.json();
  });
}

// ── Shared categories (fetch once, cache) ────────────────────────────────────
let _sharedCategoriesPromise = null;
let sharedCategories = [];

async function getSharedCategories() {
  if (sharedCategories.length) return sharedCategories;
  if (!_sharedCategoriesPromise) {
    _sharedCategoriesPromise = fetchJson('data/shared/categories.json').then(data => {
      sharedCategories = data;
      return data;
    });
  }
  return _sharedCategoriesPromise;
}

// ── Önbellek ─────────────────────────────────────────────────────────────────
const _cache = {}; // { fr: { loadedLevels, loadedSentLevels, categories, vocabulary, words, sentenceCategories } }
const _pending = {};

function ensureCache(code) {
  if (!_cache[code]) {
    _cache[code] = {
      loadedLevels:       new Set(),
      loadedSentLevels:   new Set(),
      categories:         [],
      vocabulary:         {},
      words:              [],
      sentenceCategories: [],
    };
  }
  return _cache[code];
}

// ── Merge helpers ─────────────────────────────────────────────────────────────
function mergeLevel(code, level, wordsData, cats) {
  const cache = ensureCache(code);
  if (cache.loadedLevels.has(level)) return;

  const usedCats = new Set(wordsData.words.map(w => w.cat));
  const newCats = cats
    .filter(c => c.cefr === level && usedCats.has(c.id))
    .map(c => ({ id: c.id, label: c.label, emoji: c.emoji, color: c.color, level: c.cefr }));

  const existingIds = new Set(cache.categories.map(c => c.id));
  for (const cat of newCats) {
    if (!existingIds.has(cat.id)) cache.categories.push(cat);
  }

  for (const w of wordsData.words) {
    if (!cache.vocabulary[w.cat]) cache.vocabulary[w.cat] = [];
    cache.vocabulary[w.cat].push({
      id:       w.id,
      [code]:   w.word,
      tr:       w.tr,
      example:  w.example,
      freq:     w.freq,
      audio:    w.audio,
      audioUrl: w.audioUrl ?? null,
      cefr:     w.cefr,
    });
  }

  cache.words.push(...wordsData.words);
  cache.loadedLevels.add(level);
}

function mergeSentenceLevel(code, level, sentencesData, cats) {
  const cache = ensureCache(code);
  if (cache.loadedSentLevels.has(level)) return;

  const sentences = sentencesData.sentences ?? [];
  const groups = {};
  for (const s of sentences) {
    const cat = s.cat ?? 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  }

  for (const [catId, items] of Object.entries(groups)) {
    let existing = cache.sentenceCategories.find(c => c.id === catId);
    if (!existing) {
      const catMeta = cats.find(c => c.id === catId) ?? { label: catId, emoji: '' };
      existing = { id: catId, label: catMeta.label, emoji: catMeta.emoji ?? '', sentences: [] };
      cache.sentenceCategories.push(existing);
    }
    existing.sentences.push(...items.map(s => ({
      id:     s.id,
      [code]: s.text,
      tr:     s.translation ?? '',
      answer: s.answer ?? '',
      tip:    s.hint ?? '',
    })));
  }

  cache.loadedSentLevels.add(level);
}

// ── Config snapshot ───────────────────────────────────────────────────────────
function getConfig(code) {
  const meta = LANGS.find(l => l.code === code) || LANGS[0];
  const cache = ensureCache(code);
  return {
    ...meta,
    categories:         cache.categories,
    vocabulary:         cache.vocabulary,
    words:              cache.words,
    sentenceCategories: cache.sentenceCategories,
    loadedLevels:       new Set(cache.loadedLevels),
    levelColors:        LEVEL_COLORS,
    threshold:          UNLOCK_THRESHOLD,
    progressKey:        `${meta.code}_progress`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Tek bir CEFR seviyesini yükle, merge et, güncel config döndür */
export async function loadLevel(code, level) {
  const key = `${code}_${level}`;
  const cache = ensureCache(code);
  if (cache.loadedLevels.has(level)) return getConfig(code);
  if (_pending[key]) return _pending[key];

  _pending[key] = (async () => {
    const [wordsData, cats] = await Promise.all([
      fetchJson(`data/${code}/${level}.json`),
      getSharedCategories(),
    ]);
    mergeLevel(code, level, wordsData, cats);
    delete _pending[key];
    return getConfig(code);
  })();

  return _pending[key];
}

/** İlk yükleme: sadece A1 */
export async function loadLangConfig(code) {
  return loadLevel(code, 'A1');
}

/** Bir seviyenin kelime verisi yüklü mü? */
export function isLevelLoaded(code, level) {
  return _cache[code]?.loadedLevels.has(level) ?? false;
}

/** Cümleleri seviye bazında lazy yükle */
export async function loadSentenceLevel(code, level) {
  const key = `sent_${code}_${level}`;
  const cache = ensureCache(code);
  if (cache.loadedSentLevels.has(level)) return cache.sentenceCategories;
  if (_pending[key]) return _pending[key];

  _pending[key] = (async () => {
    const [sentencesData, cats] = await Promise.all([
      fetchJson(`data/${code}/sentences-${level}.json`),
      getSharedCategories(),
    ]);
    mergeSentenceLevel(code, level, sentencesData, cats);
    delete _pending[key];
    return cache.sentenceCategories;
  })();

  return _pending[key];
}

/** Yüklü seviyeler için tüm cümleleri yükle */
export async function loadSentenceCategories(code) {
  const cache = ensureCache(code);
  const promises = [...cache.loadedLevels].map(l => loadSentenceLevel(code, l));
  await Promise.all(promises);
  return cache.sentenceCategories;
}

export { sharedCategories, getSharedCategories };
