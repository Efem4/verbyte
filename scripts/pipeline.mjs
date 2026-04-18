#!/usr/bin/env node
/**
 * pipeline.mjs — Tek komutla 10k kelime
 *
 * Kaynak: popmots (FR + EN + audio + IPA)
 * AI:     sadece DE + TR + kategori (gpt-4o-mini, ucuz)
 * Çıktı:  data/fr/ + data/en/ + data/de/ → güncellenir
 *
 * Kullanım:
 *   OPENAI_API_KEY=sk-... node scripts/pipeline.mjs
 *   OPENAI_API_KEY=sk-... node scripts/pipeline.mjs --dry-run
 *   OPENAI_API_KEY=sk-... node scripts/pipeline.mjs --limit=100
 *   OPENAI_API_KEY=sk-... node scripts/pipeline.mjs --resume
 */

import fs from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const CHECKPOINT = path.join(ROOT, '.pipeline-checkpoint.json');

// ── Args ─────────────────────────────────────────────────────────────────────
const argv    = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const RESUME  = argv.includes('--resume') || existsSync(CHECKPOINT);
const limitArg = argv.find(a => a.startsWith('--limit='));
const LIMIT   = limitArg ? parseInt(limitArg.slice(8)) : Infinity;
const BATCH   = 50;
const DELAY   = 200; // ms between requests

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY && !DRY_RUN) {
  console.error('❌  OPENAI_API_KEY gerekli');
  process.exit(1);
}

// ── CEFR rank eşleştirme ─────────────────────────────────────────────────────
function rankToCefr(rank) {
  if (rank <= 1000) return 'A1';
  if (rank <= 2500) return 'A2';
  if (rank <= 5000) return 'B1';
  if (rank <= 7500) return 'B2';
  return 'C1';
}

// ── Kategori listesi (AI'ya verilecek) ───────────────────────────────────────
const CATEGORIES = [
  'greetings','numbers','colors','animals','food','family','body','clothes',
  'house','time','weather','places','transport','emotions','school','verbs',
  'adjectives','professions','sports','shopping','health','technology','hobbies',
  'kitchen','travel','music','relationships','environment','media','business',
  'science','arts','abstract','literature','advanced_verbs','nature','other',
  'cinema','fitness','geography','fashion','politics','history','digital',
  'university','workplace','cooking','medical','social_media','legal',
  'financial','psychology','economy','architecture','agriculture','philosophy','astronomy'
];

// ── Mevcut kelimeleri yükle ───────────────────────────────────────────────────
function loadExisting(lang) {
  const p = path.join(ROOT, 'data', lang, 'words.json');
  if (!existsSync(p)) return { words: [] };
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveWords(lang, data) {
  const p = path.join(ROOT, 'data', lang, 'words.json');
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// ── OpenAI çağrısı ───────────────────────────────────────────────────────────
async function callOpenAI(messages, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 429) { await sleep(4000 * (i + 1)); continue; }
        throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
      }
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(2000);
    }
  }
}

// ── Batch zenginleştir (DE + TR + kategori + örnekler) ───────────────────────
async function enrichBatch(words) {
  const wordList = words.map((w, i) =>
    `${i + 1}. fr:"${w.fr}" | en:"${w.en}" | pos:${w.pos} | rank:${w.rank}`
  ).join('\n');

  const data = await callOpenAI([{
    role: 'system',
    content: 'You are a multilingual vocabulary assistant. Return only valid JSON.',
  }, {
    role: 'user',
    content: `Given these French-English word pairs, add German and Turkish translations, example sentences, and assign a category.

${wordList}

Categories: ${CATEGORIES.join(', ')}

Rules:
- de: include article (der/die/das/ein) for nouns, infinitive for verbs
- en: use the simplest/primary meaning (one word or short phrase)
- tr: natural Turkish translation
- example_en: short natural English sentence using the word (max 10 words)
- example_de: short natural German sentence using the German word (max 10 words)
- cat: best matching category from the list, "other" if none fits

Return JSON exactly:
{
  "words": [
    { "fr": "...", "en": "...", "de": "...", "tr": "...", "cat": "...", "example_en": "...", "example_de": "..." }
  ]
}`,
  }]);

  return data.words || [];
}

// ── ID üret ───────────────────────────────────────────────────────────────────
function makeId(lang, cat, word, idx) {
  const slug = word.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
    .replace(/^_|_$/g, '').slice(0, 30);
  return `${lang}_${cat}_${slug}_${String(idx).padStart(4, '0')}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Checkpoint ────────────────────────────────────────────────────────────────
function loadCheckpoint() {
  try { return JSON.parse(readFileSync(CHECKPOINT, 'utf8')); } catch { return { done: [] }; }
}
function saveCheckpoint(done) {
  writeFileSync(CHECKPOINT, JSON.stringify({ done }, null, 2));
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀  Pipeline başlıyor...\n');

  // 1. Popmots yükle
  const popmotsPath = path.join(ROOT, 'data/shared/popmots-en-fr.json');
  if (!existsSync(popmotsPath)) {
    console.error('❌  data/shared/popmots-en-fr.json bulunamadı');
    process.exit(1);
  }
  const popmots = JSON.parse(readFileSync(popmotsPath, 'utf8'));

  // 2. Mevcut kelimeleri yükle
  const frData = loadExisting('fr');
  const enData = loadExisting('en');
  const deData = loadExisting('de');

  const existingFR = new Set(frData.words.map(w => w.word.toLowerCase().trim()));
  const existingEN = new Set(enData.words.map(w => w.word.toLowerCase().trim()));
  const existingDE = new Set(deData.words.map(w => w.word.toLowerCase().trim()));

  // 3. Checkpoint
  const checkpoint = RESUME ? loadCheckpoint() : { done: [] };
  const doneSet = new Set(checkpoint.done);

  // 4. Filtrelenmiş kelime listesi
  const CONTENT_POS = new Set(['noun', 'verb', 'adj', 'adv', 'name']);
  const pending = [];

  for (const [frWord, entries] of Object.entries(popmots)) {
    const entry = entries[0];
    if (!entry) continue;
    if (!CONTENT_POS.has(entry.category)) continue;
    if (existingFR.has(frWord.toLowerCase().trim())) continue;
    if (doneSet.has(frWord)) continue;

    const gloss = entry.senses?.[0]?.glosses?.[0] || '';
    const enWord = gloss.split(',')[0].split(';')[0].trim();
    if (!enWord) continue;

    pending.push({
      fr:       frWord,
      en:       enWord,
      pos:      entry.category,
      rank:     entry.rank || 9999,
      cefr:     rankToCefr(entry.rank || 9999),
      ipa:      entry.ipa || '',
      audioUrl: entry.pronunciation_mp3 || null,
      exampleFr: entry.senses?.[0]?.examples?.[0]?.text || '',
      exampleEn: entry.senses?.[0]?.examples?.[0]?.english || '',
    });

    if (pending.length >= LIMIT) break;
  }

  console.log(`📋  İşlenecek: ${pending.length} kelime`);
  console.log(`📦  Batch boyutu: ${BATCH} | Tahmini istek: ${Math.ceil(pending.length / BATCH)}`);
  console.log(`💰  Tahmini maliyet: ~$${(Math.ceil(pending.length / BATCH) * 0.0008).toFixed(3)}\n`);

  if (DRY_RUN) {
    console.log('🔍  Dry-run — ilk 5 kelime:');
    pending.slice(0, 5).forEach(w => console.log(`  ${w.fr} (${w.pos}, rank:${w.rank}, cefr:${w.cefr})`));
    return;
  }

  // 5. Batch işle
  let added = 0;
  let errors = 0;
  const frIdx  = frData.words.length;
  const enIdx  = enData.words.length;
  const deIdx  = deData.words.length;
  let frCounter = frIdx;
  let enCounter = enIdx;
  let deCounter = deIdx;

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const total    = Math.ceil(pending.length / BATCH);

    process.stdout.write(`  [${batchNum}/${total}] enriching ${batch.length} words... `);

    try {
      const enriched = await enrichBatch(batch);

      for (let j = 0; j < enriched.length; j++) {
        const e = enriched[j];
        const src = batch[j] || batch[0];
        if (!e?.fr || !e?.de || !e?.tr) continue;

        const cat  = CATEGORIES.includes(e.cat) ? e.cat : 'other';
        const cefr = src.cefr;

        // FR word
        if (!existingFR.has(e.fr.toLowerCase().trim())) {
          frData.words.push({
            id:       makeId('fr', cat, e.fr, frCounter++),
            cat, cefr,
            word:     e.fr,
            tr:       e.tr,
            example:  src.exampleFr || '',
            freq:     cefr === 'A1' ? 'high' : cefr === 'A2' ? 'medium' : 'low',
            audio:    !!src.audioUrl,
            audioUrl: src.audioUrl || null,
            ipa:      src.ipa || '',
            addedAt:  new Date().toISOString().slice(0, 7),
            source:   'popmots',
          });
          existingFR.add(e.fr.toLowerCase().trim());
        }

        // EN word
        const enWord = (e.en || '').split(',')[0].trim();
        if (enWord && !existingEN.has(enWord.toLowerCase().trim())) {
          enData.words.push({
            id:      makeId('en', cat, enWord, enCounter++),
            cat, cefr,
            word:    enWord,
            tr:      e.tr,
            example: e.example_en || src.exampleEn || '',
            freq:    cefr === 'A1' ? 'high' : cefr === 'A2' ? 'medium' : 'low',
            audio:   false,
            addedAt: new Date().toISOString().slice(0, 7),
            source:  'popmots',
          });
          existingEN.add(enWord.toLowerCase().trim());
        }

        // DE word
        if (e.de && !existingDE.has(e.de.toLowerCase().trim())) {
          deData.words.push({
            id:      makeId('de', cat, e.de, deCounter++),
            cat, cefr,
            word:    e.de,
            tr:      e.tr,
            example: e.example_de || '',
            freq:    cefr === 'A1' ? 'high' : cefr === 'A2' ? 'medium' : 'low',
            audio:   false,
            addedAt: new Date().toISOString().slice(0, 7),
            source:  'popmots',
          });
          existingDE.add(e.de.toLowerCase().trim());
        }

        added++;
        doneSet.add(src.fr);
      }

      // Her batch sonrası kaydet (güvenli)
      saveWords('fr', frData);
      saveWords('en', enData);
      saveWords('de', deData);
      saveCheckpoint([...doneSet]);

      process.stdout.write(`✓ (+${enriched.length})\n`);

    } catch (e) {
      errors++;
      process.stdout.write(`✗ HATA: ${e.message.slice(0, 60)}\n`);
    }

    if (i + BATCH < pending.length) await sleep(DELAY);
  }

  // 6. Meta güncelle
  for (const lang of ['fr', 'en', 'de']) {
    const data = lang === 'fr' ? frData : lang === 'en' ? enData : deData;
    const metaPath = path.join(ROOT, 'data', lang, 'meta.json');
    const meta = existsSync(metaPath)
      ? JSON.parse(readFileSync(metaPath, 'utf8'))
      : {};
    meta.wordCount = data.words.length;
    meta.lastSync  = new Date().toISOString().slice(0, 10);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  // Checkpoint temizle
  if (existsSync(CHECKPOINT)) await fs.unlink(CHECKPOINT);

  console.log('\n' + '═'.repeat(50));
  console.log('✅  Pipeline tamamlandı!');
  console.log(`   +${added} kelime eklendi (${errors} batch hatası)`);
  console.log(`   FR: ${frData.words.length} | EN: ${enData.words.length} | DE: ${deData.words.length}`);
  console.log('\nSonraki adım: node scripts/audio.mjs');
}

main().catch(e => {
  console.error('❌  Pipeline başarısız:', e.message);
  process.exit(1);
});
