// Spaced Repetition System (SRS) - Simplified SM-2
// Intervals in days: 1 → 3 → 7 → 14 → 30 → 60
const STEPS = [1, 3, 7, 14, 30, 60];
export const MASTERED_THRESHOLD = 30; // days

// Gün 1-3: 10 kart, Gün 4-7: 15 kart, Gün 8+: 20 kart
export function getDailyLimit(firstUseDate) {
  if (!firstUseDate) return 10;
  const days = Math.floor((Date.now() - new Date(firstUseDate).getTime()) / 86400000);
  if (days < 3) return 10;
  if (days < 7) return 15;
  return 20;
}

const DAY = 24 * 60 * 60 * 1000;

// INPUT:  SRSEntry | null | undefined
// OUTPUT: boolean — true = gösterilmeli
export function isDue(entry) {
  if (!entry) return true; // hiç görülmemiş = her zaman göster
  return entry.due <= Date.now();
}

export function isMastered(entry) {
  return entry && entry.interval >= MASTERED_THRESHOLD;
}

// Davranışsal çarpan: süre (ms) ve kart çevirme durumuna göre
// < 1sn  → 0.75 (refleks, okumadı)
// 1-3sn  → 1.20 (hızlı bildi)
// 3-7sn  → 1.00 (normal)
// 7sn+   → 0.80 (uzun sürdü)
// wasFlipped → maks 0.70
export function calcMultiplier(timeMs, wasFlipped) {
  const secs = timeMs / 1000;
  let m = 1.0;

  if (secs < 1)      m = 0.75;
  else if (secs < 3) m = 1.20;
  else if (secs < 7) m = 1.00;
  else               m = 0.80;

  if (wasFlipped) m = Math.min(m, 0.70);

  return m;
}

// INPUT:  entry: SRSEntry | undefined, correct: boolean,
//         timeMs: number (default 3000), wasFlipped: boolean (default false)
// OUTPUT: yeni SRSEntry — interval, due, reps, ease
// EFFECT: localStorage'a dokunmaz
export function updateEntry(entry, correct, timeMs = 3000, wasFlipped = false) {
  const now = Date.now();
  if (!correct) {
    const ease = Math.max(1.3, (entry?.ease ?? 2.5) - 0.20);
    return {
      interval: 1,
      due: now + 86400000,
      reps: (entry?.reps ?? 0),
      ease,
    };
  }
  const multiplier = calcMultiplier(timeMs, wasFlipped);
  const ease = Math.min(4.0, Math.max(1.3, (entry?.ease ?? 2.5) + (multiplier > 1 ? 0.1 : -0.1)));
  const baseInterval = entry?.interval ?? 0;
  const nextInterval =
    baseInterval === 0 ? 1 :
    baseInterval === 1 ? Math.round(3 * multiplier) :
    Math.round(baseInterval * ease * multiplier);

  return {
    interval: Math.max(1, nextInterval),
    due: now + Math.max(1, nextInterval) * 86400000,
    reps: (entry?.reps ?? 0) + 1,
    ease,
  };
}

// Kategori için kuyruğu oluştur: önce vadesi gelenler, sonra yeni kelimeler
// INPUT:  words: Word[], wordKey: string, catProgress: CatProgress | null
// OUTPUT: number[] — kelime index'leri. Sıra: [vadesi gelenler, yeni kelimeler]
// EFFECT: mastered+not-due kelimeler dışarıda bırakılır
export function buildQueue(words, wordKey, catProgress) {
  const due = [];
  const fresh = [];
  words.forEach((word, idx) => {
    const entry = catProgress?.[word[wordKey]];
    if (!entry) fresh.push(idx);
    else if (isDue(entry)) due.push(idx);
    // mastered + not due → gösterme
  });
  return [...due, ...fresh];
}

// Akıllı günlük kuyruk: due önce (sınırsız), fresh kalan slota (newLimit kadar)
// Boşsa → tüm kelimeler döngüye girer
export function buildSmartQueue(words, wordKey, catProgress, newLimit) {
  const due = [];
  const fresh = [];
  words.forEach((word, idx) => {
    const entry = catProgress?.[word[wordKey]];
    if (!entry) fresh.push(idx);
    else if (isDue(entry)) due.push(idx);
  });
  const freshSlice = fresh.slice(0, Math.max(0, newLimit));
  const queue = [...due, ...freshSlice];
  // Boşsa döngü modu: tüm kelimeler baştan
  if (queue.length === 0) return words.map((_, i) => i);
  return queue;
}

// Kategorideki vadesi gelen tekrar kelime sayısı (yeni kelimeler sayılmaz)
export function getDueCount(words, wordKey, catProgress) {
  return words.filter(w => {
    const entry = catProgress?.[w[wordKey]];
    if (!entry || !entry.reps || entry.reps === 0) return false; // yeni kelime, tekrar değil
    return entry.due <= Date.now();
  }).length;
}

// Kategorideki mastered kelime sayısı
export function getMasteredCount(catProgress) {
  if (!catProgress || Array.isArray(catProgress)) return 0;
  return Object.values(catProgress).filter(isMastered).length;
}

// Sıradaki vadeli kelimenin kaç ms sonra geleceği
export function nextDueMs(catProgress) {
  if (!catProgress || Array.isArray(catProgress)) return null;
  const future = Object.values(catProgress)
    .map(e => e?.due)
    .filter(d => d && d > Date.now());
  if (!future.length) return null;
  return Math.min(...future) - Date.now();
}

// Eski array formatını yeni SRS formatına dönüştür
export function migrateProgress(old) {
  if (!old) return {};
  const result = {};
  for (const [catId, val] of Object.entries(old)) {
    if (Array.isArray(val)) {
      result[catId] = {};
      val.forEach(word => {
        // Zaten bilinen kelimeler: 7 günlük interval, önümüzdeki 3 gün içinde dağıt
        result[catId][word] = {
          interval: 7,
          due: Date.now() + Math.floor(Math.random() * 3) * DAY,
          reps: 3,
        };
      });
    } else {
      result[catId] = val;
    }
  }
  return result;
}

// Formatlanmış süre: "2 saat", "3 gün" gibi
export function formatDuration(ms) {
  const h = ms / (60 * 60 * 1000);
  if (h < 1) return `${Math.ceil(ms / 60000)} dakika`;
  if (h < 24) return `${Math.round(h)} saat`;
  return `${Math.round(h / 24)} gün`;
}
