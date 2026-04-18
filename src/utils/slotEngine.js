import {
  getMissedMagazine, rotateMissedIfNewDay,
  getPerfMagazine, shouldRebuildPerf, buildPerfMagazine,
  getFreshWords
} from './magazines.js';
import { getTodaySlot, initTodaySlot } from './todaySlot.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// wordId → word objesi çözümle
function resolveWords(wordIds, vocabulary) {
  const map = {};
  for (const words of Object.values(vocabulary)) {
    for (const w of words) {
      if (w.id) map[w.id] = w;
    }
  }
  return wordIds.map(id => map[id]).filter(Boolean);
}

// Ana fonksiyon — App açılışında çağrılır
// Döner: { words: [...], isNew: boolean }
// isNew: true → slot bugün yeni oluşturuldu
export function getDailySlot(lang, vocabulary, progress, wordKey, dailyLimit = 10) {
  // Gün değiştiyse missed sarjörünü rotate et
  rotateMissedIfNewDay(lang);

  // Bugünkü slot zaten var mı? (boş slot = bozuk sayılır, yeniden oluştur)
  const existing = getTodaySlot(lang);
  if (existing && existing.wordIds.length > 0) {
    const words = resolveWords(existing.wordIds, vocabulary);
    return { words, isNew: false };
  }

  // --- Yeni slot oluştur ---

  // 1. Performans sarjörü — haftalık rebuild
  if (shouldRebuildPerf(lang)) {
    buildPerfMagazine(lang, vocabulary, wordKey);
  }

  // 2. 3 sarjörden çek
  const missed = getMissedMagazine(lang);
  const perf   = getPerfMagazine(lang);
  const missedSlots = Math.min(missed.length, Math.floor(dailyLimit * 0.4));
  const perfSlots   = Math.min(perf.length,   Math.floor(dailyLimit * 0.3));
  const freshLimit  = dailyLimit - missedSlots - perfSlots;
  const fresh = getFreshWords(vocabulary, progress, wordKey, freshLimit);

  // 3. Karıştır
  const slotIds = shuffle([
    ...missed.slice(0, missedSlots),
    ...perf.slice(0, perfSlots),
    ...fresh,
  ]);

  // 4. Kaydet
  initTodaySlot(lang, slotIds);

  const words = resolveWords(slotIds, vocabulary);
  return { words, isNew: true };
}

// Bugünkü slot'tan kalan kelimeler (görülmemiş)
export function getRemainingSlotWords(lang, vocabulary) {
  const slot = getTodaySlot(lang);
  if (!slot) return [];
  const remaining = slot.wordIds.filter(id => !slot.studiedIds.includes(id));
  return resolveWords(remaining, vocabulary);
}

// Slot tamamlandı mı?
export { isTodaySlotDone } from './todaySlot.js';
