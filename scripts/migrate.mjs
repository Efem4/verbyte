#!/usr/bin/env node
/**
 * migrate.mjs
 * vocabulary.js + audioMap.json → data/{lang}/words.json + audio.json + meta.json
 * data/shared/categories.json
 *
 * Kullanım: node scripts/migrate.mjs
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const LANGS = ['fr', 'en', 'de'];

// ── vocabulary.js'i parse et ─────────────────────────────────────────────────
// Node dynamic import ile .js dosyasını yükle
async function loadVocabModule(lang) {
  const vocabPath = path.join(ROOT, 'src/languages', lang, 'vocabulary.js');
  if (!existsSync(vocabPath)) throw new Error(`${vocabPath} bulunamadı`);

  // vocabulary.js'i geçici olarak .mjs gibi import etmek için file:// URL kullan
  const url = new URL(`file://${vocabPath.replace(/\\/g, '/')}`);
  const mod = await import(url.href);
  return mod;
}

// audioMap.json yükle
async function loadAudioMap(lang) {
  const p = path.join(ROOT, 'src/languages', lang, 'audioMap.json');
  if (!existsSync(p)) return {};
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

// sentences.js yükle
async function loadSentences(lang) {
  const p = path.join(ROOT, 'src/languages', lang, 'sentences.js');
  if (!existsSync(p)) return [];
  const url = new URL(`file://${p.replace(/\\/g, '/')}`);
  const mod = await import(url.href);
  // FR: sentenceCategories, EN: sentenceCategoriesEn, DE: sentenceCategoriesDe
  return mod.sentenceCategories || mod.sentenceCategoriesEn || mod.sentenceCategoriesDe || [];
}

// ── slug normalize ────────────────────────────────────────────────────────────
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

// ── ID üret ───────────────────────────────────────────────────────────────────
function makeId(lang, catId, word, idx) {
  const slug = slugify(word);
  return `${lang}_${catId}_${slug}_${String(idx).padStart(3, '0')}`;
}

// ── Frekans tahmini (basit kelime uzunluğu + örnek cümle varlığı) ─────────────
function guessFreq(word, example) {
  const len = word.length;
  const hasExample = example && example.trim().length > 0;
  if (len <= 6 && hasExample) return 'high';
  if (len <= 12) return 'medium';
  return 'low';
}

// ── Categories al (FR ana kaynak) ─────────────────────────────────────────────
async function extractCategories(frMod) {
  const cats = frMod.categories || [];
  return cats.map(c => ({
    id: c.id,
    label: c.label,
    emoji: c.emoji || '',
    color: c.color || '#6366F1',
    cefr: c.level || 'A1',
  }));
}

// ── Vocabulary dönüştür ───────────────────────────────────────────────────────
function convertVocabulary(lang, vocabulary, categories) {
  const catMap = {};
  categories.forEach(c => { catMap[c.id] = c; });

  const words = [];
  let globalIdx = 0;

  for (const [catId, entries] of Object.entries(vocabulary)) {
    const cat = catMap[catId];
    const cefr = cat?.cefr || 'A1';

    (entries || []).forEach((entry, i) => {
      const wordText = entry[lang] || entry.fr || entry.en || entry.de || '';
      if (!wordText.trim()) return;

      const id = makeId(lang, catId, wordText, globalIdx++);

      words.push({
        id,
        cat: catId,
        cefr,
        word: wordText.trim(),
        tr: (entry.tr || '').trim(),
        example: (entry.example || '').trim(),
        freq: guessFreq(wordText, entry.example),
        audio: false, // audio.json'a bakarak güncellenecek
        addedAt: '2025-01',
        source: 'original',
      });
    });
  }

  return words;
}

// ── Audio haritasını words'e uygula ──────────────────────────────────────────
function applyAudio(words, audioMap) {
  // audioMap: { "Bonjour": "/audio/bonjour.mp3", ... }
  const lookup = {};
  for (const [word, path] of Object.entries(audioMap)) {
    lookup[word.toLowerCase().trim()] = path;
  }

  return words.map(w => ({
    ...w,
    audio: !!lookup[w.word.toLowerCase().trim()],
    audioPath: lookup[w.word.toLowerCase().trim()] || null,
  }));
}

// ── Sentences dönüştür ───────────────────────────────────────────────────────
function convertSentences(lang, sentenceCategories) {
  return sentenceCategories.map(cat => ({
    id: cat.id,
    label: cat.label,
    emoji: cat.emoji || '',
    sentences: (cat.sentences || []).map((s, i) => ({
      id: `${cat.id}_${String(i).padStart(3, '0')}`,
      // Dil-spesifik metin: s.fr / s.en / s.de → text
      text: s[lang] || s.text || s.sentence || '',
      translation: s.translation || s.tr || '',
      answer: s.answer || s.missing || '',
      hint: s.hint || s.tip || '',
    })),
  }));
}

// ── Yaz ──────────────────────────────────────────────────────────────────────
async function writeJSON(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀  Migration başlıyor...\n');

  const dataDir = path.join(ROOT, 'data');

  // 1. FR'dan shared categories çıkar
  console.log('📂  Kategoriler çıkarılıyor (FR kaynak)...');
  const frMod = await loadVocabModule('fr');
  const categories = await extractCategories(frMod);

  // EN ve DE'den eksik kategorileri ekle
  for (const lang of ['en', 'de']) {
    try {
      const mod = await loadVocabModule(lang);
      const langCats = mod.categoriesEn || mod.categoriesDe || mod.categories || [];
      langCats.forEach(c => {
        if (!categories.find(x => x.id === c.id)) {
          categories.push({
            id: c.id,
            label: c.label,
            emoji: c.emoji || '',
            color: c.color || '#6366F1',
            cefr: c.level || 'A1',
          });
        }
      });
    } catch (e) {
      console.warn(`  ⚠️  ${lang} kategorileri yüklenemedi: ${e.message}`);
    }
  }

  await writeJSON(path.join(dataDir, 'shared', 'categories.json'), categories);
  console.log(`  ✓  ${categories.length} kategori → data/shared/categories.json\n`);

  // 2. Her dil için words, sentences, audio, meta
  for (const lang of LANGS) {
    console.log(`🌐  ${lang.toUpperCase()} işleniyor...`);

    try {
      const mod = await loadVocabModule(lang);
      const vocabulary = mod.vocabulary || mod.vocabularyEn || mod.vocabularyDe || {};
      const audioMap = await loadAudioMap(lang);

      // Words
      let words = convertVocabulary(lang, vocabulary, categories);
      words = applyAudio(words, audioMap);

      // Sentences
      const sentenceCats = await loadSentences(lang);
      const sentences = convertSentences(lang, sentenceCats);

      // Audio map (sadece path'ler)
      const audio = {};
      for (const [word, p] of Object.entries(audioMap)) {
        audio[word] = p;
      }

      // Meta
      const meta = {
        lang,
        wordCount: words.length,
        audioCount: words.filter(w => w.audio).length,
        categories: [...new Set(words.map(w => w.cat))].length,
        lastMigrated: new Date().toISOString().slice(0, 10),
        version: '2.0.0',
      };

      await writeJSON(path.join(dataDir, lang, 'words.json'), { lang, words });
      await writeJSON(path.join(dataDir, lang, 'sentences.json'), { lang, categories: sentences });
      await writeJSON(path.join(dataDir, lang, 'audio.json'), audio);
      await writeJSON(path.join(dataDir, lang, 'meta.json'), meta);

      console.log(`  ✓  ${words.length} kelime, ${words.filter(w => w.audio).length} ses, ${sentences.length} cümle kategorisi`);
    } catch (e) {
      console.error(`  ✗  ${lang} HATA: ${e.message}`);
    }
  }

  console.log('\n✅  Migration tamamlandı!');
  console.log('   data/ klasörü hazır.');
  console.log('\nSonraki adım:');
  console.log('   node scripts/sync.mjs   ← React\'ı yeni formata bağla');
}

main().catch(e => {
  console.error('❌  Migration başarısız:', e);
  process.exit(1);
});
