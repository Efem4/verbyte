/**
 * srs.test.js — SRS motoru için kapsamlı testler
 * Kapsam: isDue, isMastered, updateEntry, getDailyLimit,
 *         buildQueue, buildSmartQueue, getDueCount,
 *         getMasteredCount, migrateProgress, formatDuration
 */

import { describe, it, expect } from 'vitest';
import {
  isDue,
  isMastered,
  updateEntry,
  calcMultiplier,
  getDailyLimit,
  buildQueue,
  buildSmartQueue,
  getDueCount,
  getMasteredCount,
  migrateProgress,
  formatDuration,
  MASTERED_THRESHOLD,
} from './srs.js';

// ─── Sabitler ────────────────────────────────────────────────────────────────
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

// Test için örnek kelimeler
const WORDS = [
  { fr: 'bonjour', tr: 'merhaba' },
  { fr: 'merci',   tr: 'teşekkür' },
  { fr: 'oui',     tr: 'evet' },
  { fr: 'non',     tr: 'hayır' },
  { fr: 'chat',    tr: 'kedi' },
];
const WORD_KEY = 'fr';

// ─── isDue ───────────────────────────────────────────────────────────────────
describe('isDue', () => {
  it('null entry → her zaman göster (yeni kelime)', () => {
    expect(isDue(null)).toBe(true);
  });

  it('undefined entry → her zaman göster', () => {
    expect(isDue(undefined)).toBe(true);
  });

  it('gelecekte vadesi olan → gösterme', () => {
    expect(isDue({ due: NOW + DAY, interval: 7, reps: 1 })).toBe(false);
  });

  it('geçmişte vadesi olan → göster', () => {
    expect(isDue({ due: NOW - DAY, interval: 7, reps: 1 })).toBe(true);
  });

  it('tam şu an vadesi olan → göster', () => {
    expect(isDue({ due: NOW - 1, interval: 7, reps: 1 })).toBe(true);
  });
});

// ─── isMastered ──────────────────────────────────────────────────────────────
describe('isMastered', () => {
  it('null → mastered değil', () => {
    expect(isMastered(null)).toBeFalsy();
  });

  it('undefined → mastered değil', () => {
    expect(isMastered(undefined)).toBeFalsy();
  });

  it(`interval < ${MASTERED_THRESHOLD} → mastered değil`, () => {
    expect(isMastered({ interval: 14, due: NOW + 14 * DAY, reps: 5 })).toBe(false);
  });

  it(`interval === ${MASTERED_THRESHOLD} → mastered`, () => {
    expect(isMastered({ interval: MASTERED_THRESHOLD, due: NOW + MASTERED_THRESHOLD * DAY, reps: 6 })).toBe(true);
  });

  it('interval > threshold → mastered', () => {
    expect(isMastered({ interval: 60, due: NOW + 60 * DAY, reps: 8 })).toBe(true);
  });
});

// ─── calcMultiplier ──────────────────────────────────────────────────────────
describe('calcMultiplier', () => {
  it('refleks (<1sn) → 0.75', () => expect(calcMultiplier(500, false)).toBe(0.75));
  it('hızlı (1-3sn) → 1.20', () => expect(calcMultiplier(2000, false)).toBe(1.20));
  it('normal (3-7sn) → 1.00', () => expect(calcMultiplier(5000, false)).toBe(1.00));
  it('yavaş (7sn+) → 0.80', () => expect(calcMultiplier(8000, false)).toBe(0.80));
  it('çevirdi → max 0.70', () => expect(calcMultiplier(2000, true)).toBe(0.70));
  it('yavaş + çevirdi → 0.70 (min)', () => expect(calcMultiplier(9000, true)).toBe(0.70));
});

// ─── updateEntry ─────────────────────────────────────────────────────────────
describe('updateEntry', () => {
  it('yanlış cevap → interval 1 güne düşer, reps değişmez', () => {
    const entry = updateEntry({ interval: 14, due: NOW + 14 * DAY, reps: 4 }, false);
    expect(entry.interval).toBe(1);
    expect(entry.reps).toBe(4); // yanlışta reps artmaz
  });

  it('yanlış cevap — hiç görülmemiş kelime (entry=undefined)', () => {
    const entry = updateEntry(undefined, false);
    expect(entry.interval).toBe(1);
    expect(entry.reps).toBe(0); // başlangıç 0, artmaz
  });

  it('yanlış cevap → ease cezalandırılır (min 1.3)', () => {
    const entry = updateEntry({ interval: 7, due: NOW, reps: 3, ease: 1.4 }, false);
    expect(entry.ease).toBeCloseTo(1.3);
  });

  it('doğru cevap — ilk kez görülen kelime (interval=0) → interval=1', () => {
    const entry = updateEntry(undefined, true);
    expect(entry.interval).toBe(1);
    expect(entry.reps).toBe(1);
    expect(entry.due).toBeGreaterThan(NOW);
  });

  it('doğru cevap — interval=1, normal (3sn) → ~3 gün', () => {
    // timeMs=3000 → multiplier=1.00, Math.round(3 * 1.00) = 3
    const entry = updateEntry({ interval: 1, due: NOW, reps: 1 }, true, 3000, false);
    expect(entry.interval).toBe(3);
  });

  it('doğru cevap — interval=1, hızlı (2sn) → ~4 gün', () => {
    // timeMs=2000 → multiplier=1.20, Math.round(3 * 1.20) = 4
    const entry = updateEntry({ interval: 1, due: NOW, reps: 1 }, true, 2000, false);
    expect(entry.interval).toBe(4);
  });

  it('doğru cevap — interval=1, yavaş (8sn) → ~2 gün', () => {
    // timeMs=8000 → multiplier=0.80, Math.round(3 * 0.80) = 2
    const entry = updateEntry({ interval: 1, due: NOW, reps: 1 }, true, 8000, false);
    expect(entry.interval).toBe(2);
  });

  it('doğru cevap — ease artar (hızlı cevap)', () => {
    // multiplier=1.20 > 1 → ease += 0.1
    const entry = updateEntry({ interval: 3, due: NOW, reps: 2, ease: 2.5 }, true, 2000, false);
    expect(entry.ease).toBeCloseTo(2.6);
  });

  it('doğru cevap — ease azalır (yavaş cevap)', () => {
    // multiplier=0.80 ≤ 1 → ease -= 0.1
    const entry = updateEntry({ interval: 3, due: NOW, reps: 2, ease: 2.5 }, true, 8000, false);
    expect(entry.ease).toBeCloseTo(2.4);
  });

  it('ease min 1.3, max 4.0 sınırları korunur', () => {
    const low  = updateEntry({ interval: 1, due: NOW, reps: 1, ease: 1.3 }, true, 8000, false);
    const high = updateEntry({ interval: 1, due: NOW, reps: 1, ease: 4.0 }, true, 2000, false);
    expect(low.ease).toBeGreaterThanOrEqual(1.3);
    expect(high.ease).toBeLessThanOrEqual(4.0);
  });

  it('due tarihi gelecekte olmalı', () => {
    const entry = updateEntry(undefined, true);
    expect(entry.due).toBeGreaterThan(NOW);
  });

  it('reps doğru cevapta artar, yanlışta artmaz', () => {
    let e = updateEntry(undefined, true);
    expect(e.reps).toBe(1);
    e = updateEntry(e, true);
    expect(e.reps).toBe(2);
    e = updateEntry(e, false);
    expect(e.reps).toBe(2); // yanlışta artmaz
  });

  it('default parametrelerle (eski imza) geriye dönük uyumlu', () => {
    // updateEntry(entry, correct) — timeMs=3000, wasFlipped=false varsayılan
    const entry = updateEntry({ interval: 1, due: NOW, reps: 1 }, true);
    expect(entry.interval).toBeGreaterThanOrEqual(1);
    expect(entry.reps).toBe(2);
  });
});

// ─── getDailyLimit ───────────────────────────────────────────────────────────
describe('getDailyLimit', () => {
  it('firstUseDate yoksa → 10', () => {
    expect(getDailyLimit(null)).toBe(10);
    expect(getDailyLimit(undefined)).toBe(10);
  });

  it('bugün başlandıysa (0 gün) → 10', () => {
    const today = new Date().toISOString();
    expect(getDailyLimit(today)).toBe(10);
  });

  it('2 gün önce → 10', () => {
    const twoDaysAgo = new Date(NOW - 2 * DAY).toISOString();
    expect(getDailyLimit(twoDaysAgo)).toBe(10);
  });

  it('4 gün önce → 15', () => {
    const fourDaysAgo = new Date(NOW - 4 * DAY).toISOString();
    expect(getDailyLimit(fourDaysAgo)).toBe(15);
  });

  it('6 gün önce → 15', () => {
    const sixDaysAgo = new Date(NOW - 6 * DAY).toISOString();
    expect(getDailyLimit(sixDaysAgo)).toBe(15);
  });

  it('10 gün önce → 20', () => {
    const tenDaysAgo = new Date(NOW - 10 * DAY).toISOString();
    expect(getDailyLimit(tenDaysAgo)).toBe(20);
  });

  it('30 gün önce → 20', () => {
    const thirtyDaysAgo = new Date(NOW - 30 * DAY).toISOString();
    expect(getDailyLimit(thirtyDaysAgo)).toBe(20);
  });
});

// ─── buildQueue ──────────────────────────────────────────────────────────────
describe('buildQueue', () => {
  it('progress boşsa → tüm kelimeler yeni olarak döner', () => {
    const q = buildQueue(WORDS, WORD_KEY, null);
    expect(q).toHaveLength(WORDS.length);
  });

  it('tüm kelimeler mastered (gelecekte) → boş queue', () => {
    const catProgress = {};
    for (const w of WORDS) {
      catProgress[w[WORD_KEY]] = { interval: 60, due: NOW + 60 * DAY, reps: 8 };
    }
    const q = buildQueue(WORDS, WORD_KEY, catProgress);
    expect(q).toHaveLength(0);
  });

  it('vadesi gelenler önce gelir', () => {
    // bonjour = due, merci = yeni
    const catProgress = {
      bonjour: { interval: 7, due: NOW - DAY, reps: 3 }, // vadesi geldi
    };
    const q = buildQueue(WORDS, WORD_KEY, catProgress);
    // bonjour index=0 ilk olmalı
    expect(q[0]).toBe(0);
  });

  it('hem due hem fresh kelimeler dahil olur', () => {
    const catProgress = {
      bonjour: { interval: 7, due: NOW - DAY, reps: 3 }, // due
      merci:   { interval: 7, due: NOW + DAY, reps: 3 }, // not due
    };
    const q = buildQueue(WORDS, WORD_KEY, catProgress);
    // merci not-due + not mastered → hariç edilir (isMastered değil ama due da değil)
    // bonjour due → dahil
    // oui, non, chat → fresh → dahil
    expect(q).toContain(0); // bonjour
    expect(q).not.toContain(1); // merci (not due, not mastered... ama mastered değil, sadece not due)
    // Dikkat: buildQueue'da mastered+not-due dışarıda, ama merci mastered değil ve not-due
    // buildQueue logic: if(!entry) fresh, else if(isDue) due. Yoksa skip.
    // Yani merci skipped çünkü entry var ve !isDue
    expect(q).toContain(2); // oui (fresh)
  });
});

// ─── buildSmartQueue ─────────────────────────────────────────────────────────
describe('buildSmartQueue', () => {
  it('progress boşsa → newLimit kadar kelime', () => {
    const q = buildSmartQueue(WORDS, WORD_KEY, null, 3);
    expect(q).toHaveLength(3);
  });

  it('newLimit=0 → sadece due kelimeler', () => {
    const catProgress = {
      bonjour: { interval: 7, due: NOW - DAY, reps: 3 },
    };
    const q = buildSmartQueue(WORDS, WORD_KEY, catProgress, 0);
    // Sadece bonjour due, fresh kesilir
    expect(q).toHaveLength(1);
    expect(q[0]).toBe(0);
  });

  it('due kelimeler newLimit\'e dahil değildir (öncelikli)', () => {
    const catProgress = {
      bonjour: { interval: 7, due: NOW - DAY, reps: 3 },
    };
    const q = buildSmartQueue(WORDS, WORD_KEY, catProgress, 2);
    // 1 due + 2 fresh = 3
    expect(q).toHaveLength(3);
    expect(q[0]).toBe(0); // bonjour due → önce
  });

  it('tüm kelimeler mastered ve not-due → döngü modunda tüm kelimeler döner', () => {
    const catProgress = {};
    for (const w of WORDS) {
      catProgress[w[WORD_KEY]] = { interval: 60, due: NOW + 60 * DAY, reps: 8 };
    }
    const q = buildSmartQueue(WORDS, WORD_KEY, catProgress, 10);
    // queue boş → tüm kelimeler döngü
    expect(q).toHaveLength(WORDS.length);
  });

  it('newLimit negatif geçilse → sadece due gelir', () => {
    const catProgress = {
      bonjour: { interval: 3, due: NOW - DAY, reps: 2 },
    };
    const q = buildSmartQueue(WORDS, WORD_KEY, catProgress, -5);
    expect(q).toContain(0);
    // fresh slice(-5) = [] → sadece due
    expect(q).toHaveLength(1);
  });
});

// ─── getDueCount ─────────────────────────────────────────────────────────────
describe('getDueCount', () => {
  it('progress boşsa → 0 döner (yeni kelimeler sayılmaz)', () => {
    expect(getDueCount(WORDS, WORD_KEY, null)).toBe(0);
  });

  it('bazı kelimeler due, bazıları değil', () => {
    const catProgress = {
      bonjour: { interval: 7, due: NOW - DAY, reps: 3 }, // due (tekrar)
      merci:   { interval: 7, due: NOW + DAY, reps: 3 }, // not due
    };
    // Sadece bonjour due → 1 (oui/non/chat yeni kelime, sayılmaz)
    expect(getDueCount(WORDS, WORD_KEY, catProgress)).toBe(1);
  });

  it('tüm kelimeler not-due → 0', () => {
    const catProgress = {};
    for (const w of WORDS) {
      catProgress[w[WORD_KEY]] = { interval: 7, due: NOW + DAY, reps: 3 };
    }
    expect(getDueCount(WORDS, WORD_KEY, catProgress)).toBe(0);
  });

  it('reps=0 olan entry → sayılmaz (yeni kelime)', () => {
    const catProgress = {
      bonjour: { interval: 1, due: NOW - DAY, reps: 0 }, // reps=0 → yeni
    };
    expect(getDueCount(WORDS, WORD_KEY, catProgress)).toBe(0);
  });

  it('reps > 0 ve vadesi gelmiş → sayılır', () => {
    const catProgress = {
      bonjour: { interval: 1, due: NOW - DAY, reps: 1 }, // ilk tekrar, vadesi geldi
      merci:   { interval: 3, due: NOW - DAY, reps: 2 }, // vadesi geldi
    };
    expect(getDueCount(WORDS, WORD_KEY, catProgress)).toBe(2);
  });
});

// ─── getMasteredCount ─────────────────────────────────────────────────────────
describe('getMasteredCount', () => {
  it('null catProgress → 0', () => {
    expect(getMasteredCount(null)).toBe(0);
  });

  it('array formatı (eski) → 0', () => {
    expect(getMasteredCount(['bonjour', 'merci'])).toBe(0);
  });

  it('hiç mastered yoksa → 0', () => {
    const p = { bonjour: { interval: 7, due: NOW + DAY, reps: 3 } };
    expect(getMasteredCount(p)).toBe(0);
  });

  it('bazı kelimeler mastered', () => {
    const p = {
      bonjour: { interval: 60, due: NOW + 60 * DAY, reps: 8 },
      merci:   { interval: 7,  due: NOW + 7 * DAY,  reps: 3 },
      oui:     { interval: 30, due: NOW + 30 * DAY, reps: 6 },
    };
    expect(getMasteredCount(p)).toBe(2); // bonjour + oui
  });

  it('tüm kelimeler mastered', () => {
    const p = {};
    for (const w of WORDS) {
      p[w[WORD_KEY]] = { interval: 60, due: NOW + 60 * DAY, reps: 8 };
    }
    expect(getMasteredCount(p)).toBe(WORDS.length);
  });
});

// ─── migrateProgress ─────────────────────────────────────────────────────────
describe('migrateProgress', () => {
  it('null → boş obje', () => {
    expect(migrateProgress(null)).toEqual({});
  });

  it('eski array formatını SRS formatına dönüştürür', () => {
    const old = {
      greetings: ['bonjour', 'merci'],
    };
    const migrated = migrateProgress(old);
    expect(migrated.greetings).toBeDefined();
    expect(migrated.greetings['bonjour']).toMatchObject({
      interval: 7,
      reps: 3,
    });
    expect(migrated.greetings['merci']).toMatchObject({
      interval: 7,
      reps: 3,
    });
  });

  it('yeni SRS formatı dokunulmadan geçer', () => {
    const modern = {
      greetings: {
        bonjour: { interval: 14, due: NOW + 14 * DAY, reps: 4 },
      },
    };
    const result = migrateProgress(modern);
    expect(result.greetings.bonjour.interval).toBe(14);
  });

  it('karışık format: bazıları eski bazıları yeni', () => {
    const mixed = {
      greetings: ['bonjour'],
      colors: { rouge: { interval: 7, due: NOW + 7 * DAY, reps: 2 } },
    };
    const result = migrateProgress(mixed);
    expect(result.greetings['bonjour'].interval).toBe(7); // migrated
    expect(result.colors['rouge'].interval).toBe(7);       // unchanged
  });
});

// ─── formatDuration ──────────────────────────────────────────────────────────
describe('formatDuration', () => {
  it('1 dakikadan az → dakika cinsinden', () => {
    const result = formatDuration(30 * 1000); // 30 saniye
    expect(result).toMatch(/dakika/);
  });

  it('1 saat → saat cinsinden', () => {
    const result = formatDuration(60 * 60 * 1000);
    expect(result).toMatch(/saat/);
  });

  it('2 saat', () => {
    const result = formatDuration(2 * 60 * 60 * 1000);
    expect(result).toContain('2');
    expect(result).toMatch(/saat/);
  });

  it('1 gün → gün cinsinden', () => {
    const result = formatDuration(24 * 60 * 60 * 1000);
    expect(result).toMatch(/gün/);
  });

  it('3 gün', () => {
    const result = formatDuration(3 * 24 * 60 * 60 * 1000);
    expect(result).toContain('3');
    expect(result).toMatch(/gün/);
  });
});

// ─── MASTERED_THRESHOLD sabiti ───────────────────────────────────────────────
describe('MASTERED_THRESHOLD', () => {
  it('30 gün olmalı', () => {
    expect(MASTERED_THRESHOLD).toBe(30);
  });
});
