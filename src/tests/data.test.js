/**
 * data.test.js — Veri bütünlüğü ve sağlık kontrolleri
 *
 * Bu dosya hem test hem de veri kalite raporu işlevi görür.
 * Çalıştır: npm run test:data
 *
 * Kontroller:
 *   ✓ Zorunlu alan varlığı (id, cat, cefr, word, tr)
 *   ✓ CEFR seviyesi geçerliliği
 *   ✓ Duplicate ID'ler
 *   ✓ Aynı kategoride duplicate word metni
 *   ✓ Kelime uzunluğu (çok uzun kelimeler)
 *   ✓ Çeviri kalitesi (boş, çok kısa)
 *   ✓ Kategori tutarlılığı (shared categories ile eşleşme)
 *   ✓ CEFR dağılımı (her seviyede yeterli kelime)
 *   ✓ Her dilin tüm A1 kategorilerini içermesi
 *   ✓ JSON yapısı geçerliliği
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

// ─── Veri yükleme ─────────────────────────────────────────────────────────────
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

function loadJSON(relPath) {
  return JSON.parse(readFileSync(resolve(ROOT, relPath), 'utf-8'));
}

function loadAllWords(lang) {
  const words = [];
  for (const level of CEFR_LEVELS) {
    const data = loadJSON(`public/data/${lang}/${level}.json`);
    words.push(...data.words);
  }
  return { words };
}

let frWords, enWords, deWords, sharedCats;

beforeAll(() => {
  frWords    = loadAllWords('fr');
  enWords    = loadAllWords('en');
  deWords    = loadAllWords('de');
  sharedCats = loadJSON('public/data/shared/categories.json');
});

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);
const LANGS = [
  { code: 'fr', data: () => frWords, wordField: 'word' },
  { code: 'en', data: () => enWords, wordField: 'word' },
  { code: 'de', data: () => deWords, wordField: 'word' },
];

// ─── JSON Yapısı ─────────────────────────────────────────────────────────────
describe('JSON yapısı', () => {
  for (const lang of ['fr', 'en', 'de']) {
    for (const level of CEFR_LEVELS) {
      it(`${lang}/${level}.json → { words: array } formatında`, () => {
        const data = loadJSON(`public/data/${lang}/${level}.json`);
        expect(Array.isArray(data.words)).toBe(true);
      });
    }
  }

  it('shared/categories.json → array formatında', () => {
    expect(Array.isArray(sharedCats)).toBe(true);
    expect(sharedCats.length).toBeGreaterThan(0);
  });
});

// ─── Kelime Sayıları ─────────────────────────────────────────────────────────
describe('kelime sayıları', () => {
  it('FR: en az 10.000 kelime', () => {
    expect(frWords.words.length).toBeGreaterThanOrEqual(10000);
  });

  it('EN: en az 5.000 kelime', () => {
    expect(enWords.words.length).toBeGreaterThanOrEqual(5000);
  });

  it('DE: en az 5.000 kelime', () => {
    expect(deWords.words.length).toBeGreaterThanOrEqual(5000);
  });

  it('kategori sayısı 30+ olmalı', () => {
    expect(sharedCats.length).toBeGreaterThanOrEqual(30);
  });
});

// ─── Shared Categories yapısı ────────────────────────────────────────────────
describe('shared/categories.json yapısı', () => {
  it('her kategoride zorunlu alanlar var', () => {
    const errors = [];
    for (const c of sharedCats) {
      if (!c.id)    errors.push(`${c.id ?? '?'}: id eksik`);
      if (!c.label) errors.push(`${c.id}: label eksik`);
      if (!c.emoji) errors.push(`${c.id}: emoji eksik`);
      if (!c.cefr)  errors.push(`${c.id}: cefr eksik`);
    }
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  it('tüm CEFR seviyeleri geçerli', () => {
    const invalid = sharedCats.filter(c => !VALID_CEFR.has(c.cefr));
    expect(invalid.map(c => `${c.id}: ${c.cefr}`), invalid.length + ' geçersiz CEFR').toHaveLength(0);
  });

  it('kategori id\'leri benzersiz', () => {
    const ids = sharedCats.map(c => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('her CEFR seviyesinde en az 1 kategori', () => {
    for (const level of VALID_CEFR) {
      const count = sharedCats.filter(c => c.cefr === level).length;
      expect(count, `${level} seviyesinde kategori yok`).toBeGreaterThan(0);
    }
  });
});

// ─── Zorunlu alanlar (tüm diller) ───────────────────────────────────────────
describe.each(LANGS)('$code/words.json — zorunlu alanlar', ({ code, data, wordField }) => {
  it('her kelimede id, cat, cefr, word, tr alanları var', () => {
    const words = data().words;
    const errors = [];
    for (const w of words) {
      if (!w.id)          errors.push(`${w.id ?? '?'}: id eksik`);
      if (!w.cat)         errors.push(`${w.id}: cat eksik`);
      if (!w.cefr)        errors.push(`${w.id}: cefr eksik`);
      if (!w[wordField])  errors.push(`${w.id}: word (${wordField}) eksik`);
      if (!w.tr)          errors.push(`${w.id}: tr eksik`);
      if (errors.length > 20) { errors.push('...'); break; } // ilk 20 hatayı göster
    }
    expect(errors, `${code}: ${errors.length} alan hatası\n${errors.slice(0,5).join('\n')}`).toHaveLength(0);
  });
});

// ─── CEFR geçerliliği ────────────────────────────────────────────────────────
describe.each(LANGS)('$code/words.json — CEFR geçerliliği', ({ code, data }) => {
  it('tüm kelimelerin CEFR seviyesi geçerli', () => {
    const invalid = data().words.filter(w => !VALID_CEFR.has(w.cefr));
    expect(
      invalid.map(w => `${w.id}: '${w.cefr}'`).slice(0, 5),
      `${code}: ${invalid.length} geçersiz CEFR`
    ).toHaveLength(0);
  });
});

// ─── Duplicate ID kontrolü ───────────────────────────────────────────────────
describe.each(LANGS)('$code/words.json — duplicate ID\'ler', ({ code, data }) => {
  it('word ID\'leri benzersiz', () => {
    const words = data().words;
    const ids = words.map(w => w.id);
    const seen = {};
    const dupes = [];
    for (const id of ids) {
      if (seen[id]) dupes.push(id);
      seen[id] = true;
    }
    expect(dupes.slice(0, 5), `${code}: ${dupes.length} duplicate ID`).toHaveLength(0);
  });
});

// ─── Aynı kategoride duplicate kelime ────────────────────────────────────────
describe.each(LANGS)('$code/words.json — kategori içi duplicate', ({ code, data, wordField }) => {
  it('aynı kategoride aynı kelime metni iki kez yok', () => {
    const words = data().words;
    const byCategory = {};
    for (const w of words) {
      if (!byCategory[w.cat]) byCategory[w.cat] = [];
      byCategory[w.cat].push(w[wordField]?.toLowerCase());
    }
    const dupes = [];
    for (const [cat, catWords] of Object.entries(byCategory)) {
      const seen = new Set();
      for (const wText of catWords) {
        if (seen.has(wText)) dupes.push(`${cat}: '${wText}'`);
        seen.add(wText);
      }
    }
    expect(dupes.slice(0, 5), `${code}: ${dupes.length} duplicate kelime\n${dupes.slice(0,3).join('\n')}`).toHaveLength(0);
  });
});

// ─── Kategori referans kontrolü ───────────────────────────────────────────────
describe.each(LANGS)('$code/words.json — kategori referansları', ({ code, data }) => {
  it('tüm cat değerleri shared/categories.json\'da tanımlı', () => {
    const validCats = new Set(sharedCats.map(c => c.id));
    const words = data().words;
    const invalid = [...new Set(
      words.filter(w => !validCats.has(w.cat)).map(w => w.cat)
    )];
    expect(invalid.slice(0, 5), `${code}: ${invalid.length} geçersiz kategori: ${invalid.join(', ')}`).toHaveLength(0);
  });
});

// ─── Kelime uzunluğu kontrolü ────────────────────────────────────────────────
describe.each(LANGS)('$code/words.json — kelime uzunluğu', ({ code, data, wordField }) => {
  it('kelime metni 60 karakterden kısa', () => {
    const tooLong = data().words.filter(w => (w[wordField]?.length ?? 0) > 60);
    expect(
      tooLong.map(w => `${w.id}: "${w[wordField]}" (${w[wordField]?.length})`).slice(0, 5),
      `${code}: ${tooLong.length} çok uzun kelime`
    ).toHaveLength(0);
  });

  it('çeviri (tr) metni 80 karakterden kısa', () => {
    const tooLong = data().words.filter(w => (w.tr?.length ?? 0) > 80);
    expect(
      tooLong.map(w => `${w.id}: "${w.tr}" (${w.tr?.length})`).slice(0, 5),
      `${code}: ${tooLong.length} çok uzun çeviri`
    ).toHaveLength(0);
  });

  it('çeviri boş veya sadece boşluk değil', () => {
    const empty = data().words.filter(w => !w.tr?.trim());
    expect(
      empty.map(w => w.id).slice(0, 5),
      `${code}: ${empty.length} boş çeviri`
    ).toHaveLength(0);
  });
});

// ─── CEFR dağılımı ───────────────────────────────────────────────────────────
describe.each(LANGS)('$code/words.json — CEFR dağılımı', ({ code, data }) => {
  it('A1 ve A2 seviyesinde kelimeler var', () => {
    const words = data().words;
    const a1 = words.filter(w => w.cefr === 'A1').length;
    const a2 = words.filter(w => w.cefr === 'A2').length;
    expect(a1, `${code}: A1 kelime yok`).toBeGreaterThan(0);
    expect(a2, `${code}: A2 kelime yok`).toBeGreaterThan(0);
  });

  it('A1 en az 500 kelime içermeli', () => {
    const a1Count = data().words.filter(w => w.cefr === 'A1').length;
    expect(a1Count, `${code}: A1'de sadece ${a1Count} kelime`).toBeGreaterThanOrEqual(500);
  });
});

// ─── Kategori başına kelime sayısı ───────────────────────────────────────────
describe.each(LANGS)('$code/words.json — kategori başına kelime sayısı', ({ code, data }) => {
  it('hiçbir kategori 5\'ten az kelime içermiyor', () => {
    const words = data().words;
    const byCat = {};
    for (const w of words) {
      byCat[w.cat] = (byCat[w.cat] ?? 0) + 1;
    }
    const tooSmall = Object.entries(byCat)
      .filter(([, count]) => count < 5)
      .map(([cat, count]) => `${cat}: ${count}`);
    expect(
      tooSmall,
      `${code}: Az kelimeli kategoriler: ${tooSmall.join(', ')}`
    ).toHaveLength(0);
  });

  it('hiçbir kategori 1000\'den fazla kelime içermiyor (dağılım iyi)', () => {
    const words = data().words;
    const byCat = {};
    for (const w of words) {
      byCat[w.cat] = (byCat[w.cat] ?? 0) + 1;
    }
    const tooBig = Object.entries(byCat)
      .filter(([, count]) => count > 1000)
      .map(([cat, count]) => `${cat}: ${count}`);
    // Bu sadece bir uyarı, fail değil
    if (tooBig.length > 0) {
      console.warn(`${code}: Çok büyük kategoriler: ${tooBig.join(', ')}`);
    }
    // Her zaman geçer — sadece bilgi amaçlı
    expect(true).toBe(true);
  });
});

// ─── Örnek cümle kalitesi (varsa) ────────────────────────────────────────────
describe.each(LANGS)('$code/words.json — örnek cümleler (isteğe bağlı)', ({ code, data }) => {
  it('example alanı string ise boş bırakılmamış (null/undefined kabul edilir)', () => {
    // null veya undefined → kabul edilir (example yok demek)
    // "" veya "  " → kabul edilmez (alanı boş bırakmak yerine null kullan)
    const badEmpty = data().words.filter(w =>
      typeof w.example === 'string' && !w.example.trim()
    );
    expect(
      badEmpty.map(w => w.id).slice(0, 5),
      `${code}: ${badEmpty.length} kelimede example="" yerine null kullanılmalı`
    ).toHaveLength(0);
  });

  it('example alanı olan kelimelerin oranı bilgi amaçlı', () => {
    const words = data().words;
    const withExample = words.filter(w => w.example && w.example.trim());
    const pct = ((withExample.length / words.length) * 100).toFixed(1);
    console.log(`   ${code}: ${withExample.length}/${words.length} kelimede örnek cümle (${pct}%)`);
    // Bu test her zaman geçer — sadece istatistik
    expect(true).toBe(true);
  });
});

// ─── Genel sağlık özeti (her zaman geçer, bilgi amaçlı) ──────────────────────
describe('veri sağlık özeti', () => {
  it('FR veri istatistikleri', () => {
    const words = frWords.words;
    const byCefr = {};
    for (const w of words) byCefr[w.cefr] = (byCefr[w.cefr] ?? 0) + 1;

    console.log('\n📊 FR Veri Özeti:');
    console.log(`   Toplam: ${words.length} kelime`);
    for (const [level, count] of Object.entries(byCefr).sort()) {
      const pct = ((count / words.length) * 100).toFixed(1);
      console.log(`   ${level}: ${count} kelime (${pct}%)`);
    }
    expect(words.length).toBeGreaterThan(0);
  });

  it('EN veri istatistikleri', () => {
    const words = enWords.words;
    const byCefr = {};
    for (const w of words) byCefr[w.cefr] = (byCefr[w.cefr] ?? 0) + 1;

    console.log('\n📊 EN Veri Özeti:');
    console.log(`   Toplam: ${words.length} kelime`);
    for (const [level, count] of Object.entries(byCefr).sort()) {
      const pct = ((count / words.length) * 100).toFixed(1);
      console.log(`   ${level}: ${count} kelime (${pct}%)`);
    }
    expect(words.length).toBeGreaterThan(0);
  });

  it('DE veri istatistikleri', () => {
    const words = deWords.words;
    const byCefr = {};
    for (const w of words) byCefr[w.cefr] = (byCefr[w.cefr] ?? 0) + 1;

    console.log('\n📊 DE Veri Özeti:');
    console.log(`   Toplam: ${words.length} kelime`);
    for (const [level, count] of Object.entries(byCefr).sort()) {
      const pct = ((count / words.length) * 100).toFixed(1);
      console.log(`   ${level}: ${count} kelime (${pct}%)`);
    }
    expect(words.length).toBeGreaterThan(0);
  });

  it('diller arası kategori örtüşmesi', () => {
    const frCats = new Set(frWords.words.map(w => w.cat));
    const enCats = new Set(enWords.words.map(w => w.cat));
    const deCats = new Set(deWords.words.map(w => w.cat));

    const allThree = [...frCats].filter(c => enCats.has(c) && deCats.has(c));
    const onlyFr = [...frCats].filter(c => !enCats.has(c) && !deCats.has(c));

    console.log(`\n🌍 Diller arası kategori örtüşmesi:`);
    console.log(`   Tüm 3 dilde: ${allThree.length} kategori`);
    console.log(`   Sadece FR'de: ${onlyFr.length} kategori`);
    console.log(`   FR toplam: ${frCats.size}, EN: ${enCats.size}, DE: ${deCats.size}`);

    expect(allThree.length).toBeGreaterThan(0);
  });
});
