#!/usr/bin/env node
/**
 * OpenAI Sentence Generator
 * Her dil × kategori için pratik cümleler üretir → sentences.js'e ekler
 *
 * Kullanım:
 *   OPENAI_API_KEY=sk-... node scripts/openai-sentences.mjs
 *   OPENAI_API_KEY=sk-... node scripts/openai-sentences.mjs --lang=fr --per-cat=15
 */

import fs from 'node:fs/promises';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv     = process.argv.slice(2);
const DRY_RUN  = argv.includes('--dry-run');
const langArg  = argv.find(a => a.startsWith('--lang='))?.slice(7);
const perCat   = parseInt(argv.find(a => a.startsWith('--per-cat='))?.slice(10) || '20', 10);
const LANGS    = langArg ? langArg.split(',') : ['fr', 'en', 'de'];

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY && !DRY_RUN) {
  console.error('❌  OPENAI_API_KEY gerekli');
  process.exit(1);
}

const LANG_META = {
  fr: { name: 'French',  langKey: 'fr', ttsLang: 'fr-FR' },
  en: { name: 'English', langKey: 'en', ttsLang: 'en-GB' },
  de: { name: 'German',  langKey: 'de', ttsLang: 'de-DE' },
};

// Sentence kategorileri — her biri 20 cümle hedefi
const SENTENCE_CATEGORIES = [
  { id: 'daily',         label: 'Günlük Hayat',    emoji: '☀️',  level: 'A1' },
  { id: 'greetings',     label: 'Selamlaşma',      emoji: '👋',  level: 'A1' },
  { id: 'shopping',      label: 'Alışveriş',       emoji: '🛒',  level: 'A1' },
  { id: 'travel',        label: 'Seyahat',         emoji: '✈️',  level: 'A2' },
  { id: 'restaurant',    label: 'Restoran',        emoji: '🍽️',  level: 'A2' },
  { id: 'work',          label: 'İş Hayatı',       emoji: '💼',  level: 'B1' },
  { id: 'health',        label: 'Sağlık',          emoji: '🏥',  level: 'B1' },
  { id: 'culture',       label: 'Kültür',          emoji: '🎭',  level: 'B1' },
  { id: 'environment',   label: 'Çevre',           emoji: '🌍',  level: 'B2' },
  { id: 'opinion',       label: 'Görüş Bildirme',  emoji: '💬',  level: 'B2' },
  { id: 'academic',      label: 'Akademik',        emoji: '🎓',  level: 'C1' },
  { id: 'debate',        label: 'Tartışma',        emoji: '🗣️', level: 'C1' },
];

async function callOpenAI(messages) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.8,
          response_format: { type: 'json_object' },
          messages,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) { await sleep(3000 * (i + 1)); continue; }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (e) {
      if (i === 2) throw e;
      await sleep(1000);
    }
  }
}

async function generateSentences(lang, cat, count) {
  const meta = LANG_META[lang];
  const data = await callOpenAI([{
    role: 'system',
    content: `You are a ${meta.name} language teacher creating practice sentences for Turkish learners at ${cat.level} level.`,
  }, {
    role: 'user',
    content: `Generate ${count} natural ${meta.name} sentences for the topic: "${cat.label}" (${cat.level} level).

Return JSON:
{
  "sentences": [
    { "${lang}": "sentence in ${meta.name}", "tr": "Türkçe çevirisi" }
  ]
}

Rules:
- Exactly ${count} sentences
- Appropriate for ${cat.level} level
- Realistic, natural sentences people actually say
- Turkish must be accurate and natural
- Sentences 6-15 words long
- Variety in structure and vocabulary`,
  }]);

  return (data.sentences || []).filter(s => s[lang] && s.tr);
}

// sentences.js'deki mevcut cümleleri oku
function readExistingSentences(lang) {
  const p = path.join(ROOT, 'src/languages', lang, 'sentences.js');
  const src = readFileSync(p, 'utf8');
  const key = lang;
  const re = new RegExp(`\\{ ${key}: '([^']+)'`, 'g');
  const set = new Set();
  let m;
  while ((m = re.exec(src))) set.add(m[1].toLowerCase().trim());
  return set;
}

// sentences.js'e yeni kategori + cümleler ekle
async function injectSentences(lang, cat, sentences) {
  const p = path.join(ROOT, 'src/languages', lang, 'sentences.js');
  let src = await fs.readFile(p, 'utf8');
  const key = lang;

  const safeVal = s => s.includes("'") ? `"${String(s).replace(/"/g, '\\"')}"` : `'${s}'`;

  const lines = sentences.map(s =>
    `    { ${key}: ${safeVal(s[key])}, tr: ${safeVal(s.tr)} },`
  ).join('\n');

  // Kategori zaten var mı?
  const catBlock = `  { id: '${cat.id}'`;
  if (src.includes(catBlock)) {
    // Mevcut kategorinin sentences dizisine ekle
    const catIdx = src.indexOf(catBlock);
    const sentStart = src.indexOf('sentences: [', catIdx);
    const sentEnd = src.indexOf('\n    ]', sentStart);
    if (sentEnd !== -1) {
      src = src.slice(0, sentEnd) + '\n' + lines + src.slice(sentEnd);
    }
  } else {
    // Yeni kategori ekle, export'tan önce
    const closing = src.lastIndexOf('];\n');
    if (closing === -1) return;
    const newBlock = `  {\n    id: '${cat.id}',\n    label: '${cat.label}',\n    emoji: '${cat.emoji}',\n    level: '${cat.level}',\n    sentences: [\n${lines}\n    ],\n  },\n`;
    src = src.slice(0, closing + 2) + newBlock + src.slice(closing + 2);
  }

  await fs.writeFile(p, src, 'utf8');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let total = 0;
  for (const lang of LANGS) {
    console.log(`\n🌐  ${LANG_META[lang].name}`);
    const existing = readExistingSentences(lang);

    for (const cat of SENTENCE_CATEGORIES) {
      process.stdout.write(`  ${cat.id.padEnd(16)} `);
      if (DRY_RUN) { console.log('[dry-run]'); continue; }

      try {
        const sentences = await generateSentences(lang, cat, perCat);
        const fresh = sentences.filter(s => !existing.has((s[lang] || '').toLowerCase().trim()));
        if (fresh.length > 0) {
          await injectSentences(lang, cat, fresh);
          fresh.forEach(s => existing.add((s[lang] || '').toLowerCase().trim()));
        }
        console.log(`+${fresh.length}`);
        total += fresh.length;
        await sleep(200);
      } catch (e) {
        console.log(`✗ ${e.message}`);
      }
    }
  }
  console.log(`\n✅  ${total} yeni cümle eklendi.`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
