const BASE_KEY = 'verbyte_today_slot';

function slotKey(lang) {
  return lang ? `${BASE_KEY}_${lang}` : BASE_KEY;
}

function todayStr() {
  return new Date().toDateString();
}

export function getTodaySlot(lang) {
  try {
    // Yeni per-lang key'i dene
    const raw = JSON.parse(localStorage.getItem(slotKey(lang)));
    if (raw?.date === todayStr()) return raw;

    // Migration: eski lang'siz key → yeni key'e taşı (FR için)
    const old = JSON.parse(localStorage.getItem(BASE_KEY));
    if (old?.date === todayStr()) {
      localStorage.setItem(slotKey(lang), JSON.stringify(old));
      localStorage.removeItem(BASE_KEY);
      return old;
    }

    return null; // eski gün — null döner, yenisi oluşturulacak
  } catch { return null; }
}

export function initTodaySlot(lang, wordIds) {
  const slot = {
    date: todayStr(),
    wordIds,          // bugünün tüm slotu
    studiedIds: [],   // görülenler
    missedIds: [],    // bilmedikleri
  };
  localStorage.setItem(slotKey(lang), JSON.stringify(slot));
  return slot;
}

export function markStudied(wordId, lang) {
  const slot = getTodaySlot(lang);
  if (!slot) return;
  if (!slot.studiedIds.includes(wordId)) slot.studiedIds.push(wordId);
  localStorage.setItem(slotKey(lang), JSON.stringify(slot));
}

export function markMissed(wordId, lang) {
  const slot = getTodaySlot(lang);
  if (!slot) return;
  if (!slot.missedIds.includes(wordId)) slot.missedIds.push(wordId);
  if (!slot.studiedIds.includes(wordId)) slot.studiedIds.push(wordId);
  localStorage.setItem(slotKey(lang), JSON.stringify(slot));
}

export function getTodayStudied(lang) {
  return getTodaySlot(lang)?.studiedIds || [];
}

export function getTodayMissed(lang) {
  return getTodaySlot(lang)?.missedIds || [];
}

export function isTodaySlotDone(lang) {
  const slot = getTodaySlot(lang);
  if (!slot) return false;
  return slot.studiedIds.length >= slot.wordIds.length;
}
