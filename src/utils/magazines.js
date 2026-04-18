// ─── KEYS ────────────────────────────────────────────────
const MISSED_KEY  = (lang) => `verbyte_missed_mag_${lang}`;
const PERF_KEY    = (lang) => `verbyte_perf_mag_${lang}`;
const WEEKLY_KEY  = (lang) => `verbyte_weekly_refresh_${lang}`;

function todayStr() { return new Date().toDateString(); }

function weekStr() {
  const d = new Date();
  const day = d.getDay(); // 0=Pazar
  d.setDate(d.getDate() - day); // haftanın başı (Pazar)
  return d.toDateString();
}

// ─── MISSED SARJÖRÜ ──────────────────────────────────────

// Missed sarjörünü oku
export function getMissedMagazine(lang) {
  try {
    const raw = JSON.parse(localStorage.getItem(MISSED_KEY(lang)));
    return raw?.wordIds || [];
  } catch { return []; }
}

// Gün değişince: dünkü missedIds → bugünkü sarjör
// App açılışında çağrılır; date !== today ise rotate eder
export function rotateMissedIfNewDay(lang) {
  try {
    const raw = JSON.parse(localStorage.getItem(MISSED_KEY(lang)));
    if (raw?.date === todayStr()) return; // zaten bugün rotate edilmiş

    // Circular import olmaması için doğrudan localStorage'dan oku
    const slotRaw = JSON.parse(localStorage.getItem(`verbyte_today_slot_${lang}`));
    const missedIds = slotRaw?.missedIds || [];

    localStorage.setItem(MISSED_KEY(lang), JSON.stringify({
      date: todayStr(),
      wordIds: missedIds,
    }));
  } catch { /* localStorage erişim hatası — sessizce geç */ }
}

// ─── PERFORMANS SARJÖRÜ ──────────────────────────────────

// Performans sarjörünü oku
export function getPerfMagazine(lang) {
  try {
    const raw = JSON.parse(localStorage.getItem(PERF_KEY(lang)));
    return raw?.wordIds || [];
  } catch { return []; }
}

// Haftalık yeniden oluşturma gerekli mi?
export function shouldRebuildPerf(lang) {
  try {
    const lastWeek = localStorage.getItem(WEEKLY_KEY(lang));
    return lastWeek !== weekStr();
  } catch { return true; }
}

// Performans sarjörünü yeniden oluştur (haftalık)
// vocabulary : { catId: [words] }
// wordKey    : 'fr' | 'en' | 'de'
export function buildPerfMagazine(lang, vocabulary, wordKey) {
  // Circular import olmaması için doğrudan localStorage'dan oku
  let weakCats = [];
  try {
    const statsRaw = JSON.parse(localStorage.getItem(`verbyte_cat_stats_${lang}`)) || {};
    weakCats = Object.entries(statsRaw)
      .filter(([, s]) => s.seenCount >= 5 && (s.accuracy < 0.6 || s.avgTime > 5000))
      .sort((a, b) => a[1].accuracy - b[1].accuracy)
      .map(([catId]) => catId);
  } catch { weakCats = []; }

  // Zayıf kategorilerden kelime topla (max 30)
  const wordIds = [];
  for (const catId of weakCats) {
    const words = vocabulary[catId] || [];
    for (const w of words) {
      if (wordIds.length >= 30) break;
      wordIds.push(w.id ?? w[wordKey]);
    }
    if (wordIds.length >= 30) break;
  }

  localStorage.setItem(PERF_KEY(lang), JSON.stringify({
    week: weekStr(),
    wordIds,
  }));
  localStorage.setItem(WEEKLY_KEY(lang), weekStr());

  return wordIds;
}

// ─── TAZE SARJÖRÜ ────────────────────────────────────────

// Hiç görülmemiş kelimeleri döndür
// vocabulary : { catId: [words] }
// progress   : { catId: { wordKey: { interval, due, reps } } }
// wordKey    : 'fr' | 'en' | 'de'
// limit      : kaç kelime lazım
export function getFreshWords(vocabulary, progress, wordKey, limit) {
  const fresh = [];

  for (const [catId, words] of Object.entries(vocabulary)) {
    if (fresh.length >= limit * 3) break; // fazla taramayı önle
    const catProgress = progress[catId] || {};

    for (const word of words) {
      if (fresh.length >= limit * 3) break;
      const key = word[wordKey] ?? word.fr ?? word.en;
      if (!catProgress[key]) {
        fresh.push(word.id ?? key);
      }
    }
  }

  // Fisher-Yates karıştır ve limit kadar döndür
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }

  return fresh.slice(0, limit);
}
