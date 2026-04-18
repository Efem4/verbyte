const STATS_KEY = (lang) => `verbyte_cat_stats_${lang}`;

// Tüm stats'ı oku
export function getCatStats(lang) {
  try { return JSON.parse(localStorage.getItem(STATS_KEY(lang))) || {}; }
  catch { return {}; }
}

// Tek kategori stats'ı
export function getCatStat(lang, catId) {
  return getCatStats(lang)[catId] || {
    seenCount: 0,
    knownCount: 0,
    missedCount: 0,
    totalTime: 0,
    avgTime: 0,
    accuracy: 0,
  };
}

// Kart cevaplandığında güncelle
// correct: true/false, timeMs: kaç ms baktı
export function updateCatStats(lang, catId, correct, timeMs) {
  const all = getCatStats(lang);
  const prev = all[catId] || { seenCount:0, knownCount:0, missedCount:0, totalTime:0 };

  const seenCount  = prev.seenCount + 1;
  const knownCount = prev.knownCount + (correct ? 1 : 0);
  const missedCount = prev.missedCount + (correct ? 0 : 1);
  const totalTime  = prev.totalTime + timeMs;
  const avgTime    = Math.round(totalTime / seenCount);
  const accuracy   = knownCount / seenCount;

  all[catId] = { seenCount, knownCount, missedCount, totalTime, avgTime, accuracy };
  localStorage.setItem(STATS_KEY(lang), JSON.stringify(all));
  return all[catId];
}

// Zayıf kategoriler — performans sarjörü için (Faz 2'de kullanılacak)
// accuracy < threshold VEYA avgTime > timeThreshold
export function getWeakCategories(lang, { accuracyThreshold = 0.6, timeThreshold = 5000 } = {}) {
  const all = getCatStats(lang);
  return Object.entries(all)
    .filter(([, s]) => s.seenCount >= 5 && (s.accuracy < accuracyThreshold || s.avgTime > timeThreshold))
    .sort((a, b) => a[1].accuracy - b[1].accuracy)
    .map(([catId, stats]) => ({ catId, ...stats }));
}
