/**
 * gen-kesf.mjs
 * Kelime example cümlelerini OpenAI ile Türkçe'ye çevirir,
 * her dil için public/data/{lang}/kesf.json üretir.
 *
 * Kullanım:
 *   node scripts/gen-kesf.mjs --lang fr --key sk-...
 *   node scripts/gen-kesf.mjs --lang all --key sk-...
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.join(__dir, '..');
const DATA   = path.join(ROOT, 'public', 'data');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const BATCH  = 50;         // OpenAI isteği başına cümle
const DELAY  = 120;        // ms — rate limit önlemi
const MAX_LEN = 90;        // karakter — uzun cümleleri at

// ── Argümanlar ─────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, arr) => {
    if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);
const OPENAI_KEY = args.key;
const LANG_ARG   = args.lang ?? 'fr';
const LANGS      = LANG_ARG === 'all' ? ['fr', 'en', 'de'] : [LANG_ARG];

if (!OPENAI_KEY) {
  console.error('❌  --key parametresi gerekli');
  process.exit(1);
}

// ── OpenAI çağrısı ─────────────────────────────────────────────
async function translateBatch(sentences, fromLang) {
  const langLabel = { fr: 'French', en: 'English', de: 'German' }[fromLang] ?? fromLang;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `You are a professional ${langLabel}-to-Turkish translator. ` +
            `Translate each sentence naturally and concisely. ` +
            `Return JSON: {"translations": ["tr1","tr2",...]} in the same order as input.`,
        },
        {
          role: 'user',
          content: JSON.stringify(sentences),
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }

  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  return parsed.translations ?? [];
}

// ── Gecikme ────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Tek dil işle ───────────────────────────────────────────────
async function processLang(lang) {
  console.log(`\n── ${lang.toUpperCase()} başlıyor ──`);

  // Tüm level dosyalarından kelimeleri topla
  const words = [];
  for (const lv of LEVELS) {
    const fp = path.join(DATA, lang, `${lv}.json`);
    if (!fs.existsSync(fp)) continue;
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
    words.push(...d.words);
  }

  // Örnek cümlesi olan, makul uzunluktaki kelimeleri seç
  const candidates = words.filter(w =>
    w.example &&
    w.example.trim() !== '' &&
    w.example.trim().length <= MAX_LEN &&
    w.tr
  );

  console.log(`  ${words.length} kelimeden ${candidates.length} örnek cümle seçildi`);

  // Batch'lere böl ve çevir
  const results = [];
  const total   = Math.ceil(candidates.length / BATCH);

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch    = candidates.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    process.stdout.write(`  Batch ${batchNum}/${total}...`);

    try {
      const translations = await translateBatch(batch.map(w => w.example), lang);

      for (let j = 0; j < batch.length; j++) {
        const w  = batch[j];
        const tr = translations[j];
        if (!tr) continue;
        results.push({
          text:   w.example,
          tr,
          word:   w[lang] ?? w.word,
          wordTr: w.tr,
        });
      }
      console.log(` ✓ (${results.length} toplam)`);
    } catch (e) {
      console.log(` ✗ HATA: ${e.message}`);
    }

    if (i + BATCH < candidates.length) await sleep(DELAY);
  }

  // Kaydet
  const outPath = path.join(DATA, lang, 'kesf.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`  ✅ ${results.length} cümle → ${outPath}`);
  return results.length;
}

// ── Ana ────────────────────────────────────────────────────────
(async () => {
  console.log(`🔤 Keşif veri üreteci`);
  console.log(`   Dil(ler): ${LANGS.join(', ')} | Batch: ${BATCH} | Max uzunluk: ${MAX_LEN}`);

  let total = 0;
  for (const lang of LANGS) {
    total += await processLang(lang);
  }

  console.log(`\n🎉 Tamamlandı — toplam ${total} cümle üretildi`);
})();
