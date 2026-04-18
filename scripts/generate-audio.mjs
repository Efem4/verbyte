#!/usr/bin/env node
/**
 * generate-audio.mjs
 * Google Translate TTS ile tüm kelimeler için MP3 üretir.
 *
 * Kullanım:
 *   node scripts/generate-audio.mjs              # hepsini üret
 *   node scripts/generate-audio.mjs --lang=fr    # sadece Fransızca
 *   node scripts/generate-audio.mjs --dry-run    # dosya indirmeden say
 *
 * Çıktı: audio-output/{lang}/{wordId}.mp3
 * Sonra: node scripts/upload-audio.mjs ile R2'ye yükle
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Args ─────────────────────────────────────────────────────────────────────
const argv    = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const langArg = argv.find(a => a.startsWith('--lang='))?.slice(7);
const LANGS   = langArg ? [langArg] : ['fr', 'en', 'de'];
const CEFR    = ['A1', 'A2', 'B1', 'B2', 'C1'];

// ── Google TTS dil kodları ────────────────────────────────────────────────────
const LANG_CODE = { fr: 'fr', en: 'en', de: 'de' };

// ── Paralel / rate limit ──────────────────────────────────────────────────────
const parallelArg = argv.find(a => a.startsWith('--parallel='))?.slice(11);
const delayArg    = argv.find(a => a.startsWith('--delay='))?.slice(8);
const PARALLEL   = parallelArg ? parseInt(parallelArg) : 5;
const DELAY_MS   = delayArg   ? parseInt(delayArg)    : 350;
const RETRY_MAX  = 3;   // hata durumunda tekrar deneme
const RETRY_WAIT = 2000;

// ── Checkpoint (resume desteği) ───────────────────────────────────────────────
const CHECKPOINT = path.join(ROOT, '.audio-checkpoint.json');
let done = new Set();
if (fs.existsSync(CHECKPOINT)) {
  done = new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')));
  console.log(`♻️  Checkpoint bulundu: ${done.size} dosya zaten indirilmiş, kaldığı yerden devam ediliyor.`);
}

function saveCheckpoint() {
  fs.writeFileSync(CHECKPOINT, JSON.stringify([...done]));
}

// ── Tüm kelimeleri yükle ──────────────────────────────────────────────────────
function loadWords() {
  const words = [];
  for (const lang of LANGS) {
    for (const lvl of CEFR) {
      const p = path.join(ROOT, 'public/data', lang, `${lvl}.json`);
      if (!fs.existsSync(p)) continue;
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const w of data.words) {
        words.push({ lang, id: w.id, word: w.word });
      }
    }
  }
  return words;
}

// ── Google TTS fetch ──────────────────────────────────────────────────────────
async function fetchAudio(word, langCode) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=${langCode}&client=tw-ob&ttsspeed=0.87`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer':    'https://translate.google.com/',
      'Accept':     'audio/mpeg, audio/*',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${word}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────
async function fetchWithRetry(word, langCode) {
  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    try {
      return await fetchAudio(word, langCode);
    } catch (err) {
      if (attempt === RETRY_MAX) throw err;
      console.warn(`  ⚠️  Retry ${attempt}/${RETRY_MAX}: ${word} — ${err.message}`);
      await sleep(RETRY_WAIT * attempt);
    }
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Paralel işleyici ──────────────────────────────────────────────────────────
async function processQueue(queue, onItem) {
  const results = { ok: 0, skip: 0, fail: 0 };
  let idx = 0;

  async function worker() {
    while (idx < queue.length) {
      const item = queue[idx++];
      const result = await onItem(item);
      results[result]++;
    }
  }

  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return results;
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────
async function main() {
  const words = loadWords();
  const pending = words.filter(w => !done.has(w.id));

  console.log(`\n🎵 Verbyte Ses Üretici`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Toplam kelime : ${words.length}`);
  console.log(`Zaten mevcut  : ${done.size}`);
  console.log(`İndirilecek   : ${pending.length}`);
  console.log(`Paralel istek : ${PARALLEL}`);
  console.log(`Tahmini süre  : ~${Math.round(pending.length / PARALLEL * DELAY_MS / 1000 / 60)} dakika`);
  if (DRY_RUN) { console.log('\n✅ Dry-run, çıkılıyor.'); return; }
  console.log('');

  // output klasörlerini oluştur
  for (const lang of LANGS) {
    fs.mkdirSync(path.join(ROOT, 'audio-output', lang), { recursive: true });
  }

  let lastSave = Date.now();
  let processed = 0;

  const results = await processQueue(pending, async ({ lang, id, word }) => {
    const outDir  = path.join(ROOT, 'audio-output', lang);
    const outFile = path.join(outDir, `${id}.mp3`);

    // zaten varsa atla
    if (fs.existsSync(outFile)) {
      done.add(id);
      return 'skip';
    }

    try {
      const buf = await fetchWithRetry(word, LANG_CODE[lang]);
      if (!DRY_RUN) fs.writeFileSync(outFile, buf);
      done.add(id);
      processed++;

      // her 50'de bir checkpoint kaydet
      if (Date.now() - lastSave > 10_000) {
        saveCheckpoint();
        lastSave = Date.now();
      }

      await sleep(DELAY_MS);
      return 'ok';
    } catch (err) {
      console.error(`  ❌ HATA: ${lang}/${id} (${word}) — ${err.message}`);
      return 'fail';
    }
  });

  saveCheckpoint();

  console.log(`\n✅ Tamamlandı!`);
  console.log(`  İndirilen : ${results.ok}`);
  console.log(`  Atlanan   : ${results.skip}`);
  console.log(`  Hata      : ${results.fail}`);
  console.log(`\n📦 Sonraki adım: node scripts/upload-audio.mjs`);

  if (results.fail === 0) {
    // checkpoint temizle
    if (fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
