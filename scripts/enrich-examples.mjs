#!/usr/bin/env node
/**
 * enrich-examples.mjs — Boş example alanlarını AI ile doldur
 *
 * Kullanım:
 *   OPENAI_API_KEY=sk-... node scripts/enrich-examples.mjs --lang=de
 *   OPENAI_API_KEY=sk-... node scripts/enrich-examples.mjs --lang=en,de
 *   OPENAI_API_KEY=sk-... node scripts/enrich-examples.mjs --lang=de --cefr=A1,A2
 *   OPENAI_API_KEY=sk-... node scripts/enrich-examples.mjs --dry-run
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv    = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const langArg = argv.find(a => a.startsWith('--lang='))?.slice(7);
const cefrArg = argv.find(a => a.startsWith('--cefr='))?.slice(7);
const LANGS   = langArg ? langArg.split(',') : ['de'];
const CEFRS   = cefrArg ? new Set(cefrArg.split(',')) : null;
const BATCH   = 50;
const DELAY   = 200;

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY && !DRY_RUN) {
  console.error('❌  OPENAI_API_KEY gerekli'); process.exit(1);
}

const LANG_NAMES = { fr: 'French', en: 'English', de: 'German' };
const LANG_NOTES = {
  fr: 'Natural French, include articles with nouns.',
  en: 'Natural modern English.',
  de: 'Natural German, capitalize nouns, include articles.',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callOpenAI(messages, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.5,
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

async function generateExamples(lang, words) {
  const langName = LANG_NAMES[lang];
  const langNote = LANG_NOTES[lang];

  const wordList = words.map((w, i) =>
    `${i + 1}. word:"${w.word}" | tr:"${w.tr}" | cefr:${w.cefr}`
  ).join('\n');

  const data = await callOpenAI([{
    role: 'system',
    content: `You are a language teacher creating example sentences for a ${langName} learning app. ${langNote}`,
  }, {
    role: 'user',
    content: `Write one short example sentence for each word below.

${wordList}

Rules:
- Sentence must contain the exact word
- Max 10 words per sentence
- Natural ${langName}, appropriate for the CEFR level
- Return exactly ${words.length} sentences in order

Return JSON:
{
  "examples": ["sentence1", "sentence2", ...]
}`,
  }]);

  return data.examples || [];
}

async function main() {
  console.log('🔧  Örnek cümle zenginleştirici başlıyor...\n');

  for (const lang of LANGS) {
    const wordsPath = path.join(ROOT, 'data', lang, 'words.json');
    if (!existsSync(wordsPath)) { console.log(`⚠️  ${lang}: words.json yok`); continue; }

    const data  = JSON.parse(readFileSync(wordsPath, 'utf8'));
    const words = data.words;

    // Boş example'ları bul
    const empty = words
      .map((w, i) => ({ ...w, _idx: i }))
      .filter(w => !w.example?.trim())
      .filter(w => !CEFRS || CEFRS.has(w.cefr));

    console.log(`🌐  ${lang.toUpperCase()} — ${empty.length} boş example (toplam ${words.length})`);

    if (DRY_RUN) {
      console.log(`  [dry-run] İlk 5: ${empty.slice(0, 5).map(w => w.word).join(', ')}`);
      console.log(`  Tahmini maliyet: ~$${(Math.ceil(empty.length / BATCH) * 0.0006).toFixed(3)}\n`);
      continue;
    }

    let filled = 0;
    for (let i = 0; i < empty.length; i += BATCH) {
      const batch   = empty.slice(i, i + BATCH);
      const batchNo = Math.floor(i / BATCH) + 1;
      const total   = Math.ceil(empty.length / BATCH);
      process.stdout.write(`  [${batchNo}/${total}] ${batch.length} örnek... `);

      try {
        const examples = await generateExamples(lang, batch);
        examples.forEach((ex, j) => {
          const word = batch[j];
          if (!word || !ex?.trim()) return;
          words[word._idx].example = ex.trim();
          filled++;
        });
        writeFileSync(wordsPath, JSON.stringify(data, null, 2));
        process.stdout.write(`✓ (+${examples.length})\n`);
      } catch (e) {
        process.stdout.write(`✗ ${e.message.slice(0, 50)}\n`);
      }

      if (i + BATCH < empty.length) await sleep(DELAY);
    }

    console.log(`  ✅ ${filled} örnek eklendi\n`);
  }

  console.log('✅  Tamamlandı!');
  console.log('   Şimdi cümleleri güncelle: node scripts/sentences.mjs');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
