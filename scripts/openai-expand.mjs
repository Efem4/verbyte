#!/usr/bin/env node
/**
 * OpenAI Vocabulary Expander — 10k kelime hedefi
 *
 * Kullanım:
 *   OPENAI_API_KEY=sk-... node scripts/openai-expand.mjs
 *   OPENAI_API_KEY=sk-... node scripts/openai-expand.mjs --lang=fr
 *   OPENAI_API_KEY=sk-... node scripts/openai-expand.mjs --dry-run
 *   OPENAI_API_KEY=sk-... node scripts/openai-expand.mjs --resume   (kaldığı yerden devam)
 *   OPENAI_API_KEY=sk-... node scripts/openai-expand.mjs --cat=food,medical
 */

import fs from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const CHECKPOINT = path.join(ROOT, '.expand-checkpoint.json');

// ── Args ─────────────────────────────────────────────────────────────────────
const argv      = process.argv.slice(2);
const DRY_RUN   = argv.includes('--dry-run');
const RESUME    = argv.includes('--resume') || existsSync(CHECKPOINT);
const langArg   = argv.find(a => a.startsWith('--lang='))?.slice(7);
const catArg    = argv.find(a => a.startsWith('--cat='))?.slice(6);
const LANGS     = langArg ? langArg.split(',') : ['fr', 'en', 'de'];
const ONLY_CATS = catArg  ? catArg.split(',')  : null;
const BATCH     = 40;   // kelime / OpenAI isteği
const CONCUR    = 4;    // paralel istek sayısı

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY && !DRY_RUN) {
  console.error('❌  OPENAI_API_KEY env değişkeni gerekli');
  process.exit(1);
}

// ── Kategori tanımları ───────────────────────────────────────────────────────
// isNew:true → vocabulary.js'te kategori yoksa oluşturulur
const CATEGORIES = [
  // A1 — temel (hedef 200)
  { id: 'greetings',     label: 'Selamlaşma',      emoji: '👋',  color: '#4F46E5', level: 'A1', target: 200 },
  { id: 'numbers',       label: 'Sayılar',          emoji: '🔢',  color: '#059669', level: 'A1', target: 200 },
  { id: 'colors',        label: 'Renkler',          emoji: '🎨',  color: '#DC2626', level: 'A1', target: 200 },
  { id: 'animals',       label: 'Hayvanlar',        emoji: '🐾',  color: '#D97706', level: 'A1', target: 200 },
  { id: 'food',          label: 'Yiyecekler',       emoji: '🍽️', color: '#7C3AED', level: 'A1', target: 200 },
  { id: 'family',        label: 'Aile',             emoji: '👨‍👩‍👧', color: '#0891B2', level: 'A1', target: 200 },
  { id: 'body',          label: 'Vücut',            emoji: '🫀',  color: '#E11D48', level: 'A1', target: 200 },
  { id: 'clothes',       label: 'Kıyafetler',       emoji: '👗',  color: '#9333EA', level: 'A1', target: 200 },
  { id: 'house',         label: 'Ev',               emoji: '🏠',  color: '#EA580C', level: 'A1', target: 200 },
  { id: 'time',          label: 'Zaman',            emoji: '⏰',  color: '#CA8A04', level: 'A1', target: 200 },
  { id: 'weather',       label: 'Hava Durumu',      emoji: '☁️', color: '#0284C7', level: 'A1', target: 200 },
  { id: 'places',        label: 'Yerler',           emoji: '📍',  color: '#0D9488', level: 'A1', target: 200 },
  { id: 'transport',     label: 'Ulaşım',           emoji: '🚗',  color: '#6366F1', level: 'A1', target: 200 },
  { id: 'verbs',         label: 'Fiiller',          emoji: '⚡',  color: '#2563EB', level: 'A1', target: 200 },
  { id: 'adjectives',    label: 'Sıfatlar',         emoji: '✨',  color: '#DB2777', level: 'A1', target: 200 },
  // A2
  { id: 'nature',        label: 'Doğa',             emoji: '🌿',  color: '#16A34A', level: 'A2', target: 200 },
  { id: 'emotions',      label: 'Duygular',         emoji: '❤️', color: '#F59E0B', level: 'A2', target: 200 },
  { id: 'school',        label: 'Okul',             emoji: '📚',  color: '#8B5CF6', level: 'A2', target: 200 },
  { id: 'professions',   label: 'Meslekler',        emoji: '💼',  color: '#65A30D', level: 'A2', target: 200 },
  { id: 'sports',        label: 'Spor',             emoji: '⚽',  color: '#DC2626', level: 'A2', target: 200 },
  { id: 'shopping',      label: 'Alışveriş',        emoji: '🛒',  color: '#7C3AED', level: 'A2', target: 200 },
  { id: 'health',        label: 'Sağlık',           emoji: '🏥',  color: '#059669', level: 'A2', target: 200 },
  { id: 'technology',    label: 'Teknoloji',        emoji: '💻',  color: '#0891B2', level: 'A2', target: 200 },
  { id: 'hobbies',       label: 'Hobiler',          emoji: '🎮',  color: '#EA580C', level: 'A2', target: 200 },
  { id: 'kitchen',       label: 'Mutfak',           emoji: '🍳',  color: '#CA8A04', level: 'A2', target: 200 },
  { id: 'travel',        label: 'Seyahat',          emoji: '✈️', color: '#0D9488', level: 'A2', target: 200 },
  { id: 'music',         label: 'Müzik',            emoji: '🎵',  color: '#6366F1', level: 'A2', target: 200 },
  { id: 'relationships', label: 'İlişkiler',        emoji: '💕',  color: '#F43F5E', level: 'A2', target: 200 },
  { id: 'geography',     label: 'Coğrafya',         emoji: '🗺️', color: '#0369A1', level: 'A2', target: 150, isNew: true },
  { id: 'fashion',       label: 'Moda',             emoji: '👠',  color: '#DB2777', level: 'A2', target: 150, isNew: true },
  { id: 'fitness',       label: 'Fitness',          emoji: '💪',  color: '#16A34A', level: 'A2', target: 150, isNew: true },
  { id: 'cinema',        label: 'Sinema',           emoji: '🎬',  color: '#B45309', level: 'A2', target: 150, isNew: true },
  // B1
  { id: 'environment',   label: 'Çevre',            emoji: '🌍',  color: '#22C55E', level: 'B1', target: 150 },
  { id: 'media',         label: 'Medya',            emoji: '📺',  color: '#64748B', level: 'B1', target: 150 },
  { id: 'business',      label: 'İş Hayatı',        emoji: '🏢',  color: '#1E40AF', level: 'B1', target: 150 },
  { id: 'science',       label: 'Bilim',            emoji: '🔬',  color: '#0F766E', level: 'B1', target: 150 },
  { id: 'arts',          label: 'Sanat',            emoji: '🎭',  color: '#86198F', level: 'B1', target: 150 },
  { id: 'history',       label: 'Tarih',            emoji: '🏛️', color: '#92400E', level: 'B1', target: 150, isNew: true },
  { id: 'digital',       label: 'Dijital Dünya',    emoji: '📱',  color: '#0891B2', level: 'B1', target: 150, isNew: true },
  { id: 'university',    label: 'Üniversite',       emoji: '🎓',  color: '#1E40AF', level: 'B1', target: 150, isNew: true },
  { id: 'workplace',     label: 'İş Yeri',          emoji: '🏢',  color: '#374151', level: 'B1', target: 150, isNew: true },
  { id: 'cooking',       label: 'Pişirme',          emoji: '👨‍🍳', color: '#DC2626', level: 'B1', target: 150, isNew: true },
  { id: 'medical',       label: 'Tıp',              emoji: '🩺',  color: '#EF4444', level: 'B1', target: 150, isNew: true },
  { id: 'social_media',  label: 'Sosyal Medya',     emoji: '📲',  color: '#7C3AED', level: 'B1', target: 150, isNew: true },
  // B2
  { id: 'politics',      label: 'Siyaset',          emoji: '🏛️', color: '#7C2D12', level: 'B2', target: 150 },
  { id: 'advanced_verbs',label: 'İleri Fiiller',    emoji: '🔄',  color: '#1D4ED8', level: 'B2', target: 150 },
  { id: 'legal',         label: 'Hukuk',            emoji: '⚖️', color: '#374151', level: 'B2', target: 150, isNew: true },
  { id: 'financial',     label: 'Finans',           emoji: '💰',  color: '#065F46', level: 'B2', target: 150, isNew: true },
  { id: 'psychology',    label: 'Psikoloji',        emoji: '🧠',  color: '#7C3AED', level: 'B2', target: 150, isNew: true },
  { id: 'economy',       label: 'Ekonomi',          emoji: '📈',  color: '#065F46', level: 'B2', target: 150, isNew: true },
  { id: 'architecture',  label: 'Mimari',           emoji: '🏗️', color: '#64748B', level: 'B2', target: 150, isNew: true },
  { id: 'agriculture',   label: 'Tarım',            emoji: '🌾',  color: '#65A30D', level: 'B2', target: 150, isNew: true },
  // C1
  { id: 'abstract',      label: 'Soyut Kavramlar',  emoji: '💭',  color: '#4338CA', level: 'C1', target: 150 },
  { id: 'literature',    label: 'Edebiyat',         emoji: '📖',  color: '#92400E', level: 'C1', target: 150 },
  { id: 'philosophy',    label: 'Felsefe',          emoji: '🤔',  color: '#4338CA', level: 'C1', target: 150, isNew: true },
  { id: 'astronomy',     label: 'Astronomi',        emoji: '🔭',  color: '#1E1B4B', level: 'C1', target: 150, isNew: true },
];

// Dil bazlı context bilgisi (prompt kalitesi için)
const LANG_META = {
  fr: { name: 'French', note: 'Include article (le/la/un/une) with nouns. Use natural French.' },
  en: { name: 'English', note: 'Use natural modern English. Include phrasal verbs where relevant.' },
  de: { name: 'German', note: 'Include article (der/die/das) with nouns. Capitalize all nouns.' },
};

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
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 429) {
          await sleep(3000 * (i + 1));
          continue;
        }
        throw new Error(`OpenAI HTTP ${res.status}: ${err}`);
      }
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(1500);
    }
  }
}

// ── Kelime üretimi ───────────────────────────────────────────────────────────
async function generateWords(lang, category, count, existingWords) {
  const meta = LANG_META[lang];
  const existing = existingWords.slice(0, 80).join(', ');

  const data = await callOpenAI([{
    role: 'system',
    content: `You are a professional language teacher creating vocabulary for a ${meta.name} learning app for Turkish speakers. Generate natural, practical, commonly-used words.`,
  }, {
    role: 'user',
    content: `Generate exactly ${count} ${meta.name} vocabulary words for the category: "${category.label}" (level: ${category.level}).

${meta.note}

Already exists (DO NOT repeat): ${existing || 'none'}

Return JSON:
{
  "words": [
    { "${lang}": "word or phrase", "tr": "Türkçe karşılık", "example": "short natural ${meta.name} sentence (max 10 words)" }
  ]
}

Rules:
- Exactly ${count} items in the array
- Words appropriate for ${category.level} level
- Turkish translations must be accurate and natural
- Examples must be simple, natural, and use the word
- No duplicates within the response
- No words from the "already exists" list`,
  }]);

  return (data.words || []).filter(w => w[lang] && w.tr && w.example);
}

// ── Mevcut kelimeleri oku ─────────────────────────────────────────────────────
function readExistingWords(lang) {
  const vocabPath = path.join(ROOT, 'src/languages', lang, 'vocabulary.js');
  const src = readFileSync(vocabPath, 'utf8');
  const regex = new RegExp(`\\{ ${lang}: '([^']+)'`, 'g');
  const regex2 = new RegExp(`\\{ ${lang}: "([^"]+)"`, 'g');
  const words = new Set();
  let m;
  while ((m = regex.exec(src))) words.add(m[1].toLowerCase().trim());
  while ((m = regex2.exec(src))) words.add(m[1].toLowerCase().trim());
  return words;
}

// Kategori bazlı mevcut sayı
function countCategoryWords(lang, catId) {
  const vocabPath = path.join(ROOT, 'src/languages', lang, 'vocabulary.js');
  const src = readFileSync(vocabPath, 'utf8');
  const start = src.indexOf(`  ${catId}: [`);
  if (start === -1) return 0;
  const end = src.indexOf('\n  ],', start);
  if (end === -1) return 0;
  const slice = src.slice(start, end);
  const key = lang === 'fr' ? '{ fr:' : lang === 'en' ? '{ en:' : '{ de:';
  return (slice.match(new RegExp(key.replace('{', '\\{'), 'g')) || []).length;
}

// ── vocabulary.js'e enjekte et ───────────────────────────────────────────────
async function injectWords(lang, catId, words) {
  const vocabPath = path.join(ROOT, 'src/languages', lang, 'vocabulary.js');
  let src = await fs.readFile(vocabPath, 'utf8');

  const safeVal = (s) => {
    const str = String(s);
    return str.includes("'") ? `"${str.replace(/"/g, '\\"')}"` : `'${str}'`;
  };

  const lines = words.map(w => {
    const word = w[lang];
    const pad1 = Math.max(1, 22 - word.length);
    const pad2 = Math.max(1, 22 - w.tr.length);
    return `    { ${lang}: ${safeVal(word)},${' '.repeat(pad1)}tr: ${safeVal(w.tr)},${' '.repeat(pad2)}example: ${safeVal(w.example)} },`;
  }).join('\n');

  const catStart = src.indexOf(`  ${catId}: [`);

  if (catStart !== -1) {
    // Mevcut kategoriyi bul, sonuna ekle
    const closingIdx = src.indexOf('\n  ],', catStart);
    if (closingIdx === -1) return;
    src = src.slice(0, closingIdx) + '\n' + lines + src.slice(closingIdx);
  } else {
    // Yeni kategori: vocabulary objesinin sonuna ekle (};'den önce)
    const closing = src.lastIndexOf('};');
    if (closing === -1) return;
    const newBlock = `  ${catId}: [\n${lines}\n  ],\n`;
    src = src.slice(0, closing) + newBlock + src.slice(closing);
  }

  await fs.writeFile(vocabPath, src, 'utf8');
}

// ── Yeni kategoriyi categories[] dizisine ekle ────────────────────────────────
async function injectCategoryMeta(lang, cat) {
  const vocabPath = path.join(ROOT, 'src/languages', lang, 'vocabulary.js');
  let src = await fs.readFile(vocabPath, 'utf8');

  // Zaten varsa atla
  if (src.includes(`{ id: '${cat.id}'`) || src.includes(`{ id: "${cat.id}"`)) return;

  // categories = [ ... ] içine ekle
  const arrClose = src.indexOf('];\n\nexport const vocabulary');
  if (arrClose === -1) return;

  const entry = `  { id: '${cat.id}', label: '${cat.label}', emoji: '${cat.emoji}', color: '${cat.color}', level: '${cat.level}' },`;
  src = src.slice(0, arrClose) + '\n' + entry + '\n' + src.slice(arrClose);
  await fs.writeFile(vocabPath, src, 'utf8');
}

// ── Checkpoint ───────────────────────────────────────────────────────────────
function loadCheckpoint() {
  try { return JSON.parse(readFileSync(CHECKPOINT, 'utf8')); } catch { return {}; }
}
function saveCheckpoint(data) {
  writeFileSync(CHECKPOINT, JSON.stringify(data, null, 2));
}

// ── Paralel batch runner ──────────────────────────────────────────────────────
async function runConcurrent(tasks, concur) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concur) {
    const batch = tasks.slice(i, i + concur);
    results.push(...await Promise.all(batch.map(fn => fn())));
  }
  return results;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Özet ──────────────────────────────────────────────────────────────────────
function printSummary(stats) {
  console.log('\n' + '═'.repeat(60));
  console.log('📊  ÖZET');
  console.log('═'.repeat(60));
  for (const lang of LANGS) {
    const s = stats[lang] || {};
    console.log(`  ${lang.toUpperCase()}: +${s.added || 0} yeni kelime, ${s.skipped || 0} atlandı, ${s.errors || 0} hata`);
  }
  console.log('═'.repeat(60));
  console.log('\nSonraki adımlar:');
  console.log('  node scripts/download-audio.js        # FR ses');
  console.log('  node scripts/download-audio-en.js     # EN ses');
  console.log('  node scripts/download-audio-de.js     # DE ses');
  console.log('  npm run deploy');
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
async function main() {
  const checkpoint = RESUME ? loadCheckpoint() : {};
  const stats = {};

  const targetCats = ONLY_CATS
    ? CATEGORIES.filter(c => ONLY_CATS.includes(c.id))
    : CATEGORIES;

  let totalAdded = 0;
  let totalErrors = 0;

  for (const lang of LANGS) {
    stats[lang] = { added: 0, skipped: 0, errors: 0 };
    const langMeta = LANG_META[lang];
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🌐  ${langMeta.name} (${lang})`);
    console.log('─'.repeat(60));

    const existingWords = readExistingWords(lang);

    for (const cat of targetCats) {
      const ckKey = `${lang}:${cat.id}`;

      // Mevcut sayı
      const currentCount = countCategoryWords(lang, cat.id);
      const needed = cat.target - currentCount;

      if (needed <= 0) {
        console.log(`  ✓  ${cat.id.padEnd(20)} ${currentCount}/${cat.target} — tamam`);
        stats[lang].skipped++;
        continue;
      }

      if (RESUME && checkpoint[ckKey]) {
        console.log(`  ⏭  ${cat.id.padEnd(20)} checkpoint'te zaten var, atlanıyor`);
        stats[lang].skipped++;
        continue;
      }

      process.stdout.write(`  ↓  ${cat.id.padEnd(20)} ${currentCount} → ${cat.target} (+${needed}) `);

      if (DRY_RUN) {
        console.log('[dry-run]');
        continue;
      }

      try {
        // Yeni kategori meta'sını ekle
        if (cat.isNew) await injectCategoryMeta(lang, cat);

        // Kelimeleri batch'ler halinde üret — hedef dolana kadar tekrar dene
        let injected = 0;
        let remaining = needed;
        let stallCount = 0;       // üst üste boş gelen batch sayısı
        const MAX_STALL = 4;      // bu kadar boş gelirse o kategoriyi bırak
        const MAX_TOTAL = needed * 3; // sonsuz döngü güvencesi
        let totalAttempted = 0;

        while (remaining > 0 && stallCount < MAX_STALL && totalAttempted < MAX_TOTAL) {
          const batchSize = Math.min(BATCH, remaining);
          totalAttempted += batchSize;

          // Prompt'a mevcut kelimeleri ver — dedup kalitesi artsın
          const existingArr = [...existingWords].slice(-120);
          const words = await generateWords(lang, cat, batchSize, existingArr);

          // Dedup filtresi
          const fresh = words.filter(w => {
            const key = (w[lang] || '').toLowerCase().trim();
            return key && !existingWords.has(key);
          });

          if (fresh.length > 0) {
            await injectWords(lang, cat.id, fresh);
            fresh.forEach(w => existingWords.add((w[lang] || '').toLowerCase().trim()));
            injected  += fresh.length;
            remaining -= fresh.length;  // SADECE yazılanlar kadar azalt
            stallCount = 0;
            process.stdout.write('.');
          } else {
            stallCount++;
            process.stdout.write('↺'); // tekrar deniyor
          }

          if (remaining > 0) await sleep(150);
        }

        if (stallCount >= MAX_STALL) {
          process.stdout.write(`[limit:${cat.id}]`);
        }

        console.log(` +${injected}/${needed}`);
        stats[lang].added += injected;
        totalAdded += injected;

        checkpoint[ckKey] = { injected, target: cat.target };
        saveCheckpoint(checkpoint);

      } catch (e) {
        console.log(` ✗ HATA: ${e.message}`);
        stats[lang].errors++;
        totalErrors++;
      }
    }
  }

  printSummary(stats);

  if (totalErrors === 0 && existsSync(CHECKPOINT)) {
    await fs.unlink(CHECKPOINT).catch(() => {});
  }

  console.log(`\n✅  Tamamlandı! Toplam +${totalAdded} kelime eklendi.`);
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
