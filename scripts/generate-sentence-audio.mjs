#!/usr/bin/env node
/**
 * generate-sentence-audio.mjs
 * Cümlelerin seslerini Google TTS ile indirir.
 *
 * Kullanım:
 *   node scripts/generate-sentence-audio.mjs
 *   node scripts/generate-sentence-audio.mjs --lang=fr
 *   node scripts/generate-sentence-audio.mjs --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv    = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const langArg = argv.find(a => a.startsWith('--lang='))?.slice(7);
const LANGS   = langArg ? [langArg] : ['fr', 'en', 'de'];
const CEFR    = ['A1', 'A2', 'B1', 'B2', 'C1'];
const LANG_CODE = { fr: 'fr', en: 'en', de: 'de' };

const parallelArg = argv.find(a => a.startsWith('--parallel='))?.slice(11);
const delayArg    = argv.find(a => a.startsWith('--delay='))?.slice(8);
const PARALLEL = parallelArg ? parseInt(parallelArg) : 20;
const DELAY_MS = delayArg   ? parseInt(delayArg)    : 100;
const RETRY_MAX  = 3;
const RETRY_WAIT = 2000;

const CHECKPOINT = path.join(ROOT, '.sent-audio-checkpoint.json');
let done = new Set();
if (fs.existsSync(CHECKPOINT)) {
  done = new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')));
  console.log(`♻️  Checkpoint: ${done.size} cümle zaten indirilmiş.`);
}

function saveCheckpoint() {
  fs.writeFileSync(CHECKPOINT, JSON.stringify([...done]));
}

// Cümleleri yükle — text içindeki _____ yerine answer koy
function loadSentences() {
  const sentences = [];
  for (const lang of LANGS) {
    for (const lvl of CEFR) {
      const p = path.join(ROOT, 'public/data', lang, `sentences-${lvl}.json`);
      if (!fs.existsSync(p)) continue;
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const s of data.sentences) {
        if (!s.text || !s.id) continue;
        // Tam cümleyi oluştur: _____ → answer (varsa)
        const fullText = s.answer ? s.text.replace('_____', s.answer) : s.text;
        if (!fullText.trim()) continue;
        sentences.push({ lang, id: s.id, text: fullText });
      }
    }
  }
  return sentences;
}

async function fetchAudio(text, langCode) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${langCode}&client=tw-ob&ttsspeed=0.9`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      'Referer':    'https://translate.google.com/',
      'Accept':     'audio/mpeg, audio/*',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(text, langCode) {
  for (let i = 1; i <= RETRY_MAX; i++) {
    try { return await fetchAudio(text, langCode); }
    catch (err) {
      if (i === RETRY_MAX) throw err;
      await sleep(RETRY_WAIT * i);
    }
  }
}

async function processQueue(queue, onItem) {
  const results = { ok: 0, skip: 0, fail: 0 };
  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const item = queue[idx++];
      results[await onItem(item)]++;
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return results;
}

async function main() {
  const sentences = loadSentences();
  const pending = sentences.filter(s => !done.has(s.id));

  console.log(`\n🎵 Verbyte Cümle Sesi Üretici`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Toplam cümle : ${sentences.length}`);
  console.log(`Zaten mevcut : ${done.size}`);
  console.log(`İndirilecek  : ${pending.length}`);
  console.log(`Paralel      : ${PARALLEL}`);
  console.log(`Tahmini süre : ~${Math.round(pending.length / PARALLEL * DELAY_MS / 1000 / 60)} dakika`);
  if (DRY_RUN) { console.log('\n✅ Dry-run, çıkılıyor.'); return; }
  console.log('');

  for (const lang of LANGS) {
    fs.mkdirSync(path.join(ROOT, 'audio-output', lang, 'sentences'), { recursive: true });
  }

  let lastSave = Date.now();

  const results = await processQueue(pending, async ({ lang, id, text }) => {
    const outFile = path.join(ROOT, 'audio-output', lang, 'sentences', `${id}.mp3`);
    if (fs.existsSync(outFile)) { done.add(id); return 'skip'; }
    try {
      const buf = await fetchWithRetry(text, LANG_CODE[lang]);
      fs.writeFileSync(outFile, buf);
      done.add(id);
      if (Date.now() - lastSave > 10_000) { saveCheckpoint(); lastSave = Date.now(); }
      await sleep(DELAY_MS);
      return 'ok';
    } catch (err) {
      console.error(`  ❌ ${id}: ${err.message}`);
      return 'fail';
    }
  });

  saveCheckpoint();
  console.log(`\n✅ Tamamlandı!`);
  console.log(`  İndirilen : ${results.ok}`);
  console.log(`  Atlanan   : ${results.skip}`);
  console.log(`  Hata      : ${results.fail}`);
  console.log(`\n📦 Sonraki: node scripts/upload-sentence-audio.mjs`);
  if (results.fail === 0 && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);
}

main().catch(err => { console.error(err); process.exit(1); });
