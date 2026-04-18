#!/usr/bin/env node
/**
 * upload-sentence-audio.mjs — Cümle MP3'lerini R2'ye yükler (S3 SDK)
 *
 * Kullanım:
 *   node scripts/upload-sentence-audio.mjs
 *   node scripts/upload-sentence-audio.mjs --lang=fr
 *   node scripts/upload-sentence-audio.mjs --force
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ACCOUNT_ID        = 'acb133c90b48332c4cb3822e4c5edb58';
const ACCESS_KEY_ID     = 'a23d3c248087529b0c9e62d5a4142665';
const SECRET_ACCESS_KEY = '412c82c6944d60367f4278006e16235b6f6266eeba625c33945a8059834dcf1c';
const BUCKET            = 'verbyte-audio';
const PARALLEL          = 30;

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
});

const argv    = process.argv.slice(2);
const langArg = argv.find(a => a.startsWith('--lang='))?.slice(7);
const LANGS   = langArg ? [langArg] : ['fr', 'en', 'de'];
const FORCE   = argv.includes('--force');

const CHECKPOINT = path.join(ROOT, '.sent-upload-checkpoint.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let uploaded = new Set();
if (!FORCE && fs.existsSync(CHECKPOINT)) {
  uploaded = new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')));
  console.log(`♻️  Checkpoint: ${uploaded.size} dosya zaten yüklendi.`);
}

function saveCheckpoint() {
  fs.writeFileSync(CHECKPOINT, JSON.stringify([...uploaded]));
}

async function uploadFile(localPath, r2Key, retries = 3) {
  const body = fs.readFileSync(localPath);
  for (let i = 1; i <= retries; i++) {
    try {
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: r2Key, Body: body, ContentType: 'audio/mpeg' }));
      return;
    } catch (err) {
      if (i === retries) throw err;
      await sleep(500 * i);
    }
  }
}

async function main() {
  const files = [];
  for (const lang of LANGS) {
    const dir = path.join(ROOT, 'audio-output', lang, 'sentences');
    if (!fs.existsSync(dir)) continue;
    for (const mp3 of fs.readdirSync(dir).filter(f => f.endsWith('.mp3'))) {
      const r2Key = `audio/${lang}/sentences/${mp3}`;
      if (!uploaded.has(r2Key)) files.push({ localPath: path.join(dir, mp3), r2Key });
    }
  }

  const total = uploaded.size + files.length;
  console.log(`\n☁️  Cümle Sesi R2 Upload`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Toplam: ${total} | Yüklenecek: ${files.length} | Paralel: ${PARALLEL}\n`);

  if (files.length === 0) { console.log('✅ Hepsi zaten yüklendi!'); return; }

  let ok = 0, fail = 0, idx = 0;
  const startTime = Date.now();

  async function worker() {
    while (idx < files.length) {
      const { localPath, r2Key } = files[idx++];
      try {
        await uploadFile(localPath, r2Key);
        uploaded.add(r2Key);
        ok++;
        if (ok % 200 === 0) {
          const rate = ok / ((Date.now() - startTime) / 1000);
          console.log(`  ✓ ${uploaded.size}/${total} (~${Math.ceil((files.length - ok) / rate / 60)} dk)`);
          saveCheckpoint();
        }
      } catch (err) {
        console.error(`  ❌ ${r2Key}: ${err.message}`);
        fail++;
      }
    }
  }

  await Promise.all(Array.from({ length: PARALLEL }, worker));
  saveCheckpoint();

  const mins = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n✅ Tamamlandı! (${mins} dk) — Başarılı: ${ok}, Hata: ${fail}`);
  if (fail === 0 && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);
}

main().catch(err => { console.error(err); process.exit(1); });
