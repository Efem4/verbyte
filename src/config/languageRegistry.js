/**
 * languageRegistry.js — Native
 * Web versiyonuyla aynı API, fetch() ile aynı Cloudflare CDN'den veri çeker.
 */

// ── Sabitler ──────────────────────────────────────────────────────────────────
export const LEVEL_COLORS = {
  A1: '#C4B0CC',
  A2: '#AA93BA',
  B1: '#9076A8',
  B2: '#765A96',
  C1: '#5C3D84',
};

export const UNLOCK_THRESHOLD = 0.7;
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

export const LANGS = [
  { code: 'fr', flag: '🇫🇷', label: 'Français',  wordKey: 'fr', languageLabel: 'Fransızca' },
  { code: 'en', flag: '🇬🇧', label: 'English',   wordKey: 'en', languageLabel: 'İngilizce' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch',   wordKey: 'de', languageLabel: 'Almanca'   },
];

const BASE = 'https://re-tuel.com/verbyte/';

// ── Fetch helper ──────────────────────────────────────────────────────────────
function fetchJson(path) {
  return fetch(`${BASE}${path}`).then(r => {
    if (!r.ok) throw new Error(`fetchJson ${path} → ${r.status}`);
    return r.json();
  });
}

// ── Shared categories ─────────────────────────────────────────────────────────
let _sharedCatsPromise = null;
let sharedCategories = [];

async function getSharedCategories() {
  if (sharedCategories.length) return sharedCategories;
  if (!_sharedCatsPromise) {
    _sharedCatsPromise = fetchJson('data/shared/categories.json').then(data => {
      sharedCategories = data;
      return data;
    });
  }
  return _sharedCatsPromise;
}

// ── Cache ─────────────────────────────────────────────────────────────────────
const _cache = {};
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

// ── Merge ─────────────────────────────────────────────────────────────────────
function mergeLevel(code, level, wordsData, cats) {
  const cache = ensureCache(code);
  if (cache.loadedLevels.has(level)) return;

  const usedCats = new Set(wordsData.words.map(w => w.cat));
  const newCats = cats
    .filter(c => c.cefr === level && usedCats.has(c.id))
    .map(c => ({ id: c.id, label: c.label, emoji: c.emoji, level: c.cefr }));

  const existingIds = new Set(cache.categories.map(c => c.id));
  for (const cat of newCats) {
    if (!existingIds.has(cat.id)) cache.categories.push(cat);
  }

  for (const w of wordsData.words) {
    if (!cache.vocabulary[w.cat]) cache.vocabulary[w.cat] = [];
    cache.vocabulary[w.cat].push({
      id:      w.id,
      [code]:  w.word,
      tr:      w.tr,
      example: w.example,
      cefr:    w.cefr,
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
      const meta = cats.find(c => c.id === catId) ?? { label: catId, emoji: '' };
      existing = { id: catId, label: meta.label, emoji: meta.emoji ?? '', sentences: [] };
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
export function getConfig(code) {
  const meta = LANGS.find(l => l.code === code) ?? LANGS[0];
  const cache = ensureCache(code);
  return {
    ...meta,
    categories:         [...cache.categories],
    vocabulary:         { ...cache.vocabulary },
    words:              [...cache.words],
    sentenceCategories: [...cache.sentenceCategories],
    loadedLevels:       new Set(cache.loadedLevels),
    loadedSentLevels:   new Set(cache.loadedSentLevels),
    levelColors:        LEVEL_COLORS,
    threshold:          UNLOCK_THRESHOLD,
    progressKey:        `${meta.code}_progress`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Tek seviye yükle */
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

/** Level yüklü mü? */
export function isLevelLoaded(code, level) {
  return _cache[code]?.loadedLevels.has(level) ?? false;
}

/** Cümle seviyesi yükle */
export async function loadSentenceLevel(code, level) {
  const key = `sent_${code}_${level}`;
  const cache = ensureCache(code);
  if (cache.loadedSentLevels.has(level)) return cache.sentenceCategories;
  if (_pending[key]) return _pending[key];

  _pending[key] = (async () => {
    const [sentData, cats] = await Promise.all([
      fetchJson(`data/${code}/sentences-${level}.json`),
      getSharedCategories(),
    ]);
    mergeSentenceLevel(code, level, sentData, cats);
    delete _pending[key];
    return cache.sentenceCategories;
  })();

  return _pending[key];
}

/** Yüklü levellerin cümlelerini çek */
export async function loadSentenceCategories(code) {
  const cache = ensureCache(code);
  await Promise.all([...cache.loadedLevels].map(l => loadSentenceLevel(code, l)));
  return cache.sentenceCategories;
}
