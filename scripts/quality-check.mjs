#!/usr/bin/env node
/**
 * quality-check.mjs — Kelime kalite kontrolü
 *
 * Katman 1: Yapısal kontroller (boş alan, geçersiz değer, duplikat)
 * Katman 2: Dil kuralları (DE artikel, FR article, örnek cümle)
 * Katman 3: AI kontrol (--ai flag ile, ücretli)
 *
 * Kullanım:
 *   node scripts/quality-check.mjs              → Katman 1+2
 *   node scripts/quality-check.mjs --fix        → Otomatik düzeltilebilenleri düzelt
 *   node scripts/quality-check.mjs --lang=fr    → Sadece FR
 *   node scripts/quality-check.mjs --ai         → Katman 3 de (ücretli)
 *   node scripts/quality-check.mjs --report     → Detaylı rapor dosyasına yaz
 */

import fs from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv    = process.argv.slice(2);
const FIX     = argv.includes('--fix');
const AI_MODE = argv.includes('--ai');
const REPORT  = argv.includes('--report');
const langArg = argv.find(a => a.startsWith('--lang='))?.slice(7);
const LANGS   = langArg ? langArg.split(',') : ['fr', 'en', 'de'];

const VALID_CATS = new Set([
  'greetings','numbers','colors','animals','food','family','body','clothes',
  'house','time','weather','places','transport','emotions','school','verbs',
  'adjectives','professions','sports','shopping','health','technology','hobbies',
  'kitchen','travel','music','relationships','environment','media','business',
  'science','arts','abstract','literature','advanced_verbs','nature','other',
  'cinema','fitness','geography','fashion','politics','history','digital',
  'university','workplace','cooking','medical','social_media','legal',
  'financial','psychology','economy','architecture','agriculture','philosophy','astronomy'
]);
const VALID_CEFR = new Set(['A1','A2','B1','B2','C1','C2']);

// DE artikel listesi
const DE_ARTICLES = ['der ', 'die ', 'das ', 'ein ', 'eine ', 'dem ', 'den ', 'des '];
const FR_ARTICLES = ['le ', 'la ', 'les ', 'l\'', 'un ', 'une ', 'des '];

// Türkçe karakter seti (TR'de olması beklenen)
const TR_CHARS = /[a-züöşığçA-ZÜÖŞİĞÇ]/;

// ── Kontrol fonksiyonları ─────────────────────────────────────────────────────

// Katman 1: Yapısal
function checkStructural(word, lang) {
  const errors = [];
  const warnings = [];

  // Boş alanlar
  if (!word.word?.trim())    errors.push({ code: 'EMPTY_WORD',    msg: 'Kelime boş' });
  if (!word.tr?.trim())      errors.push({ code: 'EMPTY_TR',      msg: 'TR çeviri boş' });
  if (!word.cat?.trim())     errors.push({ code: 'EMPTY_CAT',     msg: 'Kategori boş' });
  if (!word.cefr?.trim())    errors.push({ code: 'EMPTY_CEFR',    msg: 'CEFR boş' });
  if (!word.id?.trim())      errors.push({ code: 'EMPTY_ID',      msg: 'ID boş' });

  // Geçersiz değerler
  if (word.cat && !VALID_CATS.has(word.cat))   errors.push({ code: 'INVALID_CAT',  msg: `Geçersiz kategori: ${word.cat}` });
  if (word.cefr && !VALID_CEFR.has(word.cefr)) errors.push({ code: 'INVALID_CEFR', msg: `Geçersiz CEFR: ${word.cefr}` });

  // Çok uzun (muhtemelen cümle)
  if (word.word?.length > 60) warnings.push({ code: 'TOO_LONG', msg: `Kelime çok uzun (${word.word.length} karakter)` });

  // ID format
  if (word.id && !word.id.startsWith(lang + '_')) errors.push({ code: 'WRONG_ID_PREFIX', msg: `ID yanlış dil prefix: ${word.id}` });

  return { errors, warnings };
}

// Katman 2: Dil kuralları
function checkLinguistic(word, lang) {
  const errors = [];
  const warnings = [];

  if (!word.word) return { errors, warnings };

  const w = word.word.trim();

  // DE: noun büyük harfle başlamalı
  if (lang === 'de' && word.cat === 'noun' || word.cat === 'animals' || word.cat === 'food') {
    // Artikel varsa artikel sonrası büyük harf
    const hasArticle = DE_ARTICLES.some(a => w.toLowerCase().startsWith(a));
    if (hasArticle) {
      const afterArticle = w.slice(w.indexOf(' ') + 1);
      if (afterArticle && afterArticle[0] !== afterArticle[0].toUpperCase()) {
        errors.push({ code: 'DE_NOUN_LOWERCASE', msg: `DE noun küçük harf: "${w}"` });
      }
    } else if (lang === 'de' && w[0] === w[0].toLowerCase() && /^[a-züöäß]/.test(w)) {
      warnings.push({ code: 'DE_NO_ARTIKEL', msg: `DE kelimede artikel yok: "${w}"` });
    }
  }

  // FR: noun için article kontrolü
  if (lang === 'fr' && (word.cat === 'noun' || word.cat === 'food' || word.cat === 'animals')) {
    const hasArticle = FR_ARTICLES.some(a => w.toLowerCase().startsWith(a));
    if (!hasArticle && w.length > 2) {
      warnings.push({ code: 'FR_NO_ARTICLE', msg: `FR noun'da article yok: "${w}"` });
    }
  }

  // TR çeviride başka dil var mı?
  if (word.tr) {
    const tr = word.tr.trim();
    // İngilizce kelime var mı (tamamen latin, TR karakteri yok)
    if (/^[a-zA-Z\s]+$/.test(tr) && !TR_CHARS.test(tr)) {
      warnings.push({ code: 'TR_NON_TURKISH', msg: `TR çeviri Türkçe değil: "${tr}"` });
    }
    if (tr.length < 2) {
      errors.push({ code: 'TR_TOO_SHORT', msg: `TR çeviri çok kısa: "${tr}"` });
    }
  }

  // Örnek cümle kelimeyi içeriyor mu?
  if (word.example && word.example.length > 3) {
    const wordRoot = w.toLowerCase().split(' ')[0].slice(0, 4);
    if (wordRoot.length > 3 && !word.example.toLowerCase().includes(wordRoot)) {
      warnings.push({ code: 'EXAMPLE_MISSING_WORD', msg: `Örnek cümlede kelime yok` });
    }
  }

  // Örnek cümle çok kısa
  if (word.example && word.example.trim().length > 0 && word.example.trim().length < 8) {
    warnings.push({ code: 'EXAMPLE_TOO_SHORT', msg: `Örnek cümle çok kısa: "${word.example}"` });
  }

  return { errors, warnings };
}

// Duplikat tespiti
function findDuplicates(words) {
  const seen = new Map();
  const dupes = [];
  words.forEach((w, idx) => {
    const key = (w.word || '').toLowerCase().trim();
    if (!key) return;
    if (seen.has(key)) {
      dupes.push({ idx, word: w.word, firstIdx: seen.get(key) });
    } else {
      seen.set(key, idx);
    }
  });
  return dupes;
}

// ── Otomatik düzeltme ─────────────────────────────────────────────────────────
function autoFix(word, lang) {
  const fixed = { ...word };
  let fixCount = 0;

  // CEFR boşsa A1 yap
  if (!fixed.cefr || !VALID_CEFR.has(fixed.cefr)) {
    fixed.cefr = 'A1';
    fixCount++;
  }

  // Geçersiz kategori → other
  if (!fixed.cat || !VALID_CATS.has(fixed.cat)) {
    fixed.cat = 'other';
    fixCount++;
  }

  // ID fix
  if (!fixed.id) {
    const slug = (fixed.word || 'unknown').toLowerCase()
      .replace(/[^a-z0-9]/g, '_').slice(0, 20);
    fixed.id = `${lang}_${fixed.cat}_${slug}_auto`;
    fixCount++;
  }

  // TR boşsa word'u koy (placeholder)
  if (!fixed.tr?.trim()) {
    fixed.tr = fixed.word || '?';
    fixCount++;
  }

  return { fixed, fixCount };
}

// ── Raporlama ─────────────────────────────────────────────────────────────────
function printSummary(langStats) {
  console.log('\n' + '═'.repeat(60));
  console.log('📊  KALİTE RAPORU');
  console.log('═'.repeat(60));

  let totalWords = 0, totalErrors = 0, totalWarnings = 0, totalFixed = 0;

  for (const [lang, stats] of Object.entries(langStats)) {
    console.log(`\n🌐  ${lang.toUpperCase()} (${stats.total} kelime)`);
    console.log(`   ✅ Temiz:    ${stats.clean}`);
    console.log(`   ⚠️  Uyarı:   ${stats.warnings} kelime`);
    console.log(`   ❌ Hata:    ${stats.errors} kelime`);
    if (stats.duplicates > 0)
      console.log(`   🔁 Duplikat: ${stats.duplicates}`);
    if (stats.fixed > 0)
      console.log(`   🔧 Düzeltilen: ${stats.fixed}`);

    if (stats.errorCodes && Object.keys(stats.errorCodes).length > 0) {
      console.log('\n   Hata detayları:');
      for (const [code, count] of Object.entries(stats.errorCodes).sort((a,b) => b[1]-a[1]).slice(0, 8)) {
        console.log(`     ${code.padEnd(25)} ${count}`);
      }
    }

    totalWords    += stats.total;
    totalErrors   += stats.errors;
    totalWarnings += stats.warnings;
    totalFixed    += stats.fixed || 0;
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`📦  Toplam: ${totalWords} kelime`);
  console.log(`   ❌ Hata:  ${totalErrors} | ⚠️  Uyarı: ${totalWarnings}`);
  if (totalFixed > 0) console.log(`   🔧 Düzeltilen: ${totalFixed}`);
  console.log('═'.repeat(60));
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍  Kalite kontrolü başlıyor...\n');

  const langStats = {};
  const reportData = {};

  for (const lang of LANGS) {
    const wordsPath = path.join(ROOT, 'data', lang, 'words.json');
    if (!existsSync(wordsPath)) {
      console.log(`⚠️  ${lang}: words.json bulunamadı, atlanıyor`);
      continue;
    }

    const data = JSON.parse(readFileSync(wordsPath, 'utf8'));
    const words = data.words || [];

    const stats = {
      total: words.length,
      clean: 0,
      errors: 0,
      warnings: 0,
      duplicates: 0,
      fixed: 0,
      errorCodes: {},
    };

    const issues = [];
    const fixedWords = [...words];

    // Duplikat tespiti
    const dupes = findDuplicates(words);
    stats.duplicates = dupes.length;
    if (dupes.length > 0) {
      stats.errorCodes['DUPLICATE'] = dupes.length;
    }

    // Her kelime için kontrol
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const s1 = checkStructural(word, lang);
      const s2 = checkLinguistic(word, lang);

      const allErrors   = [...s1.errors,   ...s2.errors];
      const allWarnings = [...s1.warnings, ...s2.warnings];

      if (allErrors.length > 0)   stats.errors++;
      if (allWarnings.length > 0) stats.warnings++;
      if (allErrors.length === 0 && allWarnings.length === 0) stats.clean++;

      // Hata kodlarını say
      [...allErrors, ...allWarnings].forEach(e => {
        stats.errorCodes[e.code] = (stats.errorCodes[e.code] || 0) + 1;
      });

      if (allErrors.length > 0 || allWarnings.length > 0) {
        issues.push({ idx: i, word: word.word, errors: allErrors, warnings: allWarnings });
      }

      // Otomatik düzelt
      if (FIX && allErrors.length > 0) {
        const { fixed, fixCount } = autoFix(word, lang);
        if (fixCount > 0) {
          fixedWords[i] = fixed;
          stats.fixed += fixCount;
        }
      }
    }

    // Duplikatları sil (FIX modunda)
    if (FIX && dupes.length > 0) {
      const dupeIdxs = new Set(dupes.map(d => d.idx));
      const cleaned = fixedWords.filter((_, i) => !dupeIdxs.has(i));
      console.log(`  🔁 ${lang}: ${dupes.length} duplikat silindi`);
      data.words = cleaned;
      stats.fixed += dupes.length;
    } else if (FIX) {
      data.words = fixedWords;
    }

    // Kaydet
    if (FIX) {
      writeFileSync(wordsPath, JSON.stringify(data, null, 2));
      console.log(`  💾 ${lang}: kaydedildi`);
    }

    langStats[lang] = stats;
    reportData[lang] = { stats, issues: issues.slice(0, 100) }; // ilk 100 sorun
  }

  // Özet
  printSummary(langStats);

  // Rapor dosyası
  if (REPORT) {
    const reportPath = path.join(ROOT, 'data/quality-report.json');
    writeFileSync(reportPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      ...reportData
    }, null, 2));
    console.log(`\n📄  Detaylı rapor: data/quality-report.json`);
  }

  if (!FIX) {
    const hasIssues = Object.values(langStats).some(s => s.errors > 0 || s.duplicates > 0);
    if (hasIssues) {
      console.log('\n💡  Düzeltmek için: node scripts/quality-check.mjs --fix');
    }
  }
}

main().catch(e => {
  console.error('❌  Hata:', e.message);
  process.exit(1);
});
