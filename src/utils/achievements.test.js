/**
 * achievements.test.js — Rozet sistemi testleri
 * Kapsam: ACHIEVEMENTS listesi, checkNew fonksiyonu
 */

import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, checkNew } from './achievements.js';

// ─── ACHIEVEMENTS listesi ────────────────────────────────────────────────────
describe('ACHIEVEMENTS listesi', () => {
  it('13 rozet olmalı', () => {
    expect(ACHIEVEMENTS).toHaveLength(13);
  });

  it('her rozetin gerekli alanları var', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id,       `${a.id} → id eksik`).toBeTruthy();
      expect(a.category, `${a.id} → category eksik`).toBeTruthy();
      expect(a.icon,     `${a.id} → icon eksik`).toBeTruthy();
      expect(a.label,    `${a.id} → label eksik`).toBeTruthy();
      expect(a.desc,     `${a.id} → desc eksik`).toBeTruthy();
    }
  });

  it('tüm id\'ler benzersiz', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('kategoriler geçerli', () => {
    const validCats = new Set(['streak', 'combo', 'words', 'mastery']);
    for (const a of ACHIEVEMENTS) {
      expect(validCats.has(a.category), `${a.id} → geçersiz kategori: ${a.category}`).toBe(true);
    }
  });

  it('streak rozetleri: 7, 14, 30, 60 gün', () => {
    const streaks = ACHIEVEMENTS
      .filter(a => a.category === 'streak')
      .map(a => Number(a.id.split('_')[1]))
      .sort((a, b) => a - b);
    expect(streaks).toEqual([7, 14, 30, 60]);
  });

  it('combo rozetleri: 5, 10, 20', () => {
    const combos = ACHIEVEMENTS
      .filter(a => a.category === 'combo')
      .map(a => Number(a.id.split('_')[1]))
      .sort((a, b) => a - b);
    expect(combos).toEqual([5, 10, 20]);
  });

  it('words rozetleri: 10, 50, 100', () => {
    const words = ACHIEVEMENTS
      .filter(a => a.category === 'words')
      .map(a => Number(a.id.split('_')[1]))
      .sort((a, b) => a - b);
    expect(words).toEqual([10, 50, 100]);
  });

  it('mastery rozetleri: 1, 20, 50', () => {
    const mastery = ACHIEVEMENTS
      .filter(a => a.category === 'mastery')
      .map(a => Number(a.id.split('_')[1]))
      .sort((a, b) => a - b);
    expect(mastery).toEqual([1, 20, 50]);
  });
});

// ─── checkNew ────────────────────────────────────────────────────────────────
describe('checkNew', () => {
  it('kazanılmış set boş, hiç eşik aşılmamışsa → boş dizi', () => {
    const result = checkNew(new Set(), { streak: 0, combo: 0, totalWords: 0, mastered: 0 });
    expect(result).toHaveLength(0);
  });

  // Streak
  it('streak=7 → streak_7 kazanılır', () => {
    const result = checkNew(new Set(), { streak: 7, combo: 0, totalWords: 0, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('streak_7');
  });

  it('streak=15 → streak_7 ve streak_14 kazanılır', () => {
    const result = checkNew(new Set(), { streak: 15, combo: 0, totalWords: 0, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('streak_7');
    expect(ids).toContain('streak_14');
    expect(ids).not.toContain('streak_30');
  });

  it('streak=30 → streak_7, streak_14, streak_30 kazanılır', () => {
    const result = checkNew(new Set(), { streak: 30, combo: 0, totalWords: 0, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('streak_7');
    expect(ids).toContain('streak_14');
    expect(ids).toContain('streak_30');
  });

  it('streak=60 → tüm streak rozetleri kazanılır', () => {
    const result = checkNew(new Set(), { streak: 60, combo: 0, totalWords: 0, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('streak_60');
  });

  // Combo
  it('combo=5 → combo_5 kazanılır', () => {
    const result = checkNew(new Set(), { streak: 0, combo: 5, totalWords: 0, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('combo_5');
  });

  it('combo=10 → combo_5 ve combo_10 kazanılır', () => {
    const result = checkNew(new Set(), { streak: 0, combo: 10, totalWords: 0, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('combo_5');
    expect(ids).toContain('combo_10');
  });

  it('combo=20 → tüm combo rozetleri kazanılır', () => {
    const result = checkNew(new Set(), { streak: 0, combo: 20, totalWords: 0, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('combo_5');
    expect(ids).toContain('combo_10');
    expect(ids).toContain('combo_20');
  });

  // Words
  it('totalWords=10 → words_10 kazanılır', () => {
    const result = checkNew(new Set(), { streak: 0, combo: 0, totalWords: 10, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('words_10');
  });

  it('totalWords=100 → words_10, words_50, words_100 hepsi kazanılır', () => {
    const result = checkNew(new Set(), { streak: 0, combo: 0, totalWords: 100, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('words_10');
    expect(ids).toContain('words_50');
    expect(ids).toContain('words_100');
  });

  // Mastery
  it('mastered=1 → mastered_1 kazanılır', () => {
    const result = checkNew(new Set(), { streak: 0, combo: 0, totalWords: 0, mastered: 1 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('mastered_1');
  });

  it('mastered=50 → tüm mastery rozetleri kazanılır', () => {
    const result = checkNew(new Set(), { streak: 0, combo: 0, totalWords: 0, mastered: 50 });
    const ids = result.map(a => a.id);
    expect(ids).toContain('mastered_1');
    expect(ids).toContain('mastered_20');
    expect(ids).toContain('mastered_50');
  });

  // Zaten kazanılanlar tekrar gelmez
  it('zaten kazanılan rozetler sonuçta yer almaz', () => {
    const earned = new Set(['streak_7', 'combo_5', 'words_10']);
    const result = checkNew(earned, { streak: 7, combo: 5, totalWords: 10, mastered: 0 });
    expect(result).toHaveLength(0);
  });

  it('kısmen kazanılanlar → sadece yeniler döner', () => {
    const earned = new Set(['streak_7']); // 7 var ama 14 yok
    const result = checkNew(earned, { streak: 14, combo: 0, totalWords: 0, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).not.toContain('streak_7');  // zaten var
    expect(ids).toContain('streak_14');     // yeni
  });

  it('tüm rozetler kazanıldıysa → boş dizi', () => {
    const earned = new Set(ACHIEVEMENTS.map(a => a.id));
    const result = checkNew(earned, { streak: 100, combo: 100, totalWords: 1000, mastered: 500 });
    expect(result).toHaveLength(0);
  });

  // Sınır değerleri
  it('streak=6 (eşiğin altı) → streak_7 kazanılmaz', () => {
    const result = checkNew(new Set(), { streak: 6, combo: 0, totalWords: 0, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).not.toContain('streak_7');
  });

  it('combo=4 → combo_5 kazanılmaz', () => {
    const result = checkNew(new Set(), { streak: 0, combo: 4, totalWords: 0, mastered: 0 });
    const ids = result.map(a => a.id);
    expect(ids).not.toContain('combo_5');
  });

  it('totalWords=9 → words_10 kazanılmaz', () => {
    const result = checkNew(new Set(), { streak: 0, combo: 0, totalWords: 9, mastered: 0 });
    expect(result).toHaveLength(0);
  });
});
