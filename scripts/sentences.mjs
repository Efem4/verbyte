#!/usr/bin/env node
/**
 * sentences.mjs — Kelimelerden gap-fill cümle üretici
 *
 * Tier 1 (ücretsiz): Mevcut example alanından gap-fill oluştur
 * Tier 2 (AI):       Kategori bazlı çeşitli cümleler üret (--ai flag)
 *
 * Kullanım:
 *   node scripts/sentences.mjs                   → Tier 1 (ücretsiz)
 *   node scripts/sentences.mjs --lang=fr         → Sadece FR
 *   node scripts/sentences.mjs --cefr=A1,A2      → Sadece A1+A2
 *   OPENAI_API_KEY=sk-... node scripts/sentences.mjs --ai         → Tier 2 de
 *   OPENAI_API_KEY=sk-... node scripts/sentences.mjs --ai --lang=fr --cefr=A1
 */

import fs from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv    = process.argv.slice(2);
const AI_MODE = argv.includes('--ai');
const langArg = argv.find(a => a.startsWith('--lang='))?.slice(7);
const cefrArg = argv.find(a => a.startsWith('--cefr='))?.slice(7);
const LANGS   = langArg ? langArg.split(',') : ['fr', 'en', 'de'];
const CEFRS   = cefrArg ? new Set(cefrArg.split(',')) : null; // null = hepsi
const BATCH   = 40;
const DELAY   = 200;

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (AI_MODE && !OPENAI_KEY) {
  console.error('❌  --ai için OPENAI_API_KEY gerekli'); process.exit(1);
}

const LANG_NAMES = { fr: 'French', en: 'English', de: 'German' };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Tier 1: Example alanından gap-fill ───────────────────────────────────────
function buildGapFill(word) {
  const text    = (word.example || '').trim();
  const answer  = (word.word || '').trim();
  if (!text || !answer || text.length < 5) return null;

  // Kelimeyi metinde bul (büyük/küçük harf duyarsız)
  const regex = new RegExp(
    answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'i'
  );
  if (!regex.test(text)) return null;

  // Kelimeyi _____ ile değiştir (sadece ilk eşleşme)
  const gapped = text.replace(regex, '_____');

  return {
    text:        gapped,
    answer:      answer,
    translation: '', // Tier 2 veya manuel eklenecek
    hint:        word.tr || '',
  };
}

// ── Tier 2: AI ile kategori cümleleri ────────────────────────────────────────
async function callOpenAI(messages, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) { await sleep(4000 * (i + 1)); continue; }
        throw new Error(`HTTP ${res.status}`);
      }
      return JSON.parse((await res.json()).choices[0].message.content);
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(2000);
    }
  }
}

async function generateCategorySentences(lang, cat, cefr, sampleWords) {
  const langName = LANG_NAMES[lang];
  const count = cefr === 'A1' ? 20 : cefr === 'A2' ? 15 : 10;
  const wordList = sampleWords.slice(0, 12).map(w => `"${w.word}"`).join(', ');

  const data = await callOpenAI([{
    role: 'system',
    content: `You are a language teacher creating fill-in-the-blank exercises for Turkish speakers learning ${langName}.`,
  }, {
    role: 'user',
    content: `Create ${count} gap-fill sentences for category "${cat}" (CEFR: ${cefr}).

Use words from: ${wordList}

Rules:
- One _____ gap per sentence
- Max 12 words per sentence
- Turkish translation of the full sentence
- Short Turkish hint (max 5 words, not too obvious)
- Natural ${langName}, vary structures

Return JSON: { "sentences": [{ "text": "..._____...", "answer": "word", "translation": "Turkish", "hint": "ipucu" }] }`,
  }]);
  return data.sentences || [];
}

// ── ID üret ───────────────────────────────────────────────────────────────────
let _counter = 0;
function makeId(lang, type, cat) {
  return `sent_${lang}_${type}_${cat}_${String(++_counter).padStart(4, '0')}`;
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('📝  Cümle üretici başlıyor...\n');

  for (const lang of LANGS) {
    const wordsPath = path.join(ROOT, 'data', lang, 'words.json');
    if (!existsSync(wordsPath)) { console.log(`⚠️  ${lang}: words.json yok`); continue; }

    const wordsData = JSON.parse(readFileSync(wordsPath, 'utf8'));
    const allWords  = wordsData.words.filter(w => !CEFRS || CEFRS.has(w.cefr));

    const sentPath = path.join(ROOT, 'data', lang, 'sentences.json');
    const sentData = existsSync(sentPath)
      ? JSON.parse(readFileSync(sentPath, 'utf8'))
      : { lang, sentences: [] };
    if (!sentData.sentences) sentData.sentences = [];

    // Mevcut wordId'ler
    const existingWordIds = new Set(
      sentData.sentences.filter(s => s.type === 'word').map(s => s.wordId)
    );

    console.log(`🌐  ${lang.toUpperCase()} — ${allWords.length} kelime`);

    // ── Tier 1: Example → Gap-fill + Word-order (ücretsiz) ──────────────────────
    let tier1Added = 0;
    let orderAdded = 0;
    const noExample = [];
    const existingOrderIds = new Set(
      sentData.sentences.filter(s => s.type === 'order').map(s => s.wordId)
    );

    for (const word of allWords) {
      if (existingWordIds.has(word.id)) continue;

      const gapFill = buildGapFill(word);
      if (gapFill) {
        // Gap-fill cümlesi
        sentData.sentences.push({
          id:          makeId(lang, 'word', word.cat),
          type:        'word',
          cat:         word.cat,
          cefr:        word.cefr,
          wordId:      word.id,
          word:        word.word,
          ...gapFill,
        });
        tier1Added++;

        // Word-order cümlesi (aynı example'dan türet)
        if (!existingOrderIds.has(word.id)) {
          const fullSentence = (word.example || '').trim();
          const tokens = fullSentence.split(/\s+/).filter(Boolean);
          // En az 3, en fazla 10 kelimeli cümleler için oluştur
          if (tokens.length >= 3 && tokens.length <= 10) {
            sentData.sentences.push({
              id:          makeId(lang, 'order', word.cat),
              type:        'order',
              cat:         word.cat,
              cefr:        word.cefr,
              wordId:      word.id,
              word:        word.word,
              sentence:    fullSentence,
              words:       tokens,
              translation: '', // AI Tier 2 veya ilerleyen güncellemede eklenecek
              hint:        word.tr || '',
            });
            existingOrderIds.add(word.id);
            orderAdded++;
          }
        }
      } else {
        noExample.push(word); // Örneği olmayan / eşleşmeyen kelimeler
      }
    }

    console.log(`  ✅ Tier 1 gap-fill: +${tier1Added} cümle`);
    console.log(`  ✅ Tier 1 word-order: +${orderAdded} cümle`);
    console.log(`  ⚠️  Örnek cümlesi yok/eşleşmez: ${noExample.length} kelime`);

    // ── Tier 2: Kategori cümleleri (AI, opsiyonel) ────────────────────────────
    if (AI_MODE) {
      // Kategori × CEFR grupları
      const existingCatKeys = new Set(
        sentData.sentences.filter(s => s.type === 'category')
          .map(s => `${s.cat}:${s.cefr}`)
      );

      const catGroups = {};
      allWords.forEach(w => {
        const key = `${w.cat}:${w.cefr}`;
        if (!catGroups[key]) catGroups[key] = { cat: w.cat, cefr: w.cefr, words: [] };
        catGroups[key].words.push(w);
      });

      const pending = Object.entries(catGroups)
        .filter(([key, v]) => !existingCatKeys.has(key) && v.words.length >= 5);

      console.log(`  🤖 Tier 2 (AI kategori): ${pending.length} kategori/seviye`);

      let tier2Added = 0;
      for (let i = 0; i < pending.length; i++) {
        const [key, { cat, cefr, words }] = pending[i];
        process.stdout.write(`    [${i + 1}/${pending.length}] ${cat} (${cefr})... `);
        try {
          const sentences = await generateCategorySentences(lang, cat, cefr, words);
          sentences.forEach(s => {
            if (!s?.text || !s?.answer) return;
            sentData.sentences.push({
              id:          makeId(lang, 'category', cat),
              type:        'category',
              cat, cefr,
              text:        s.text,
              answer:      s.answer,
              translation: s.translation || '',
              hint:        s.hint || '',
            });
            tier2Added++;
          });
          process.stdout.write(`✓ (+${sentences.length})\n`);
        } catch (e) {
          process.stdout.write(`✗ ${e.message.slice(0, 40)}\n`);
        }
        if (i + 1 < pending.length) await sleep(DELAY);
      }
      console.log(`  ✅ Tier 2 tamamlandı: +${tier2Added} cümle`);
    }

    // Kaydet
    writeFileSync(sentPath, JSON.stringify(sentData, null, 2));

    // Meta
    const metaPath = path.join(ROOT, 'data', lang, 'meta.json');
    const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
    meta.sentenceCount = sentData.sentences.length;
    meta.lastSentenceSync = new Date().toISOString().slice(0, 10);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    console.log(`  📊 Toplam: ${sentData.sentences.length} cümle\n`);
  }

  console.log('✅  Tamamlandı!');
  console.log('   AI kategori cümleleri için: OPENAI_API_KEY=... node scripts/sentences.mjs --ai');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
