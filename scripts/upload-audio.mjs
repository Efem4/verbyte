#!/usr/bin/env node
/**
 * upload-audio.mjs — Cloudflare R2 S3 SDK upload (hızlı, resume destekli)
 *
 * Kullanım:
 *   node scripts/upload-audio.mjs
 *   node scripts/upload-audio.mjs --lang=fr
 *   node scripts/upload-audio.mjs --force   # checkpoint'i sıfırla
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Cloudflare R2 credentials ─────────────────────────────────────────────────
const ACCOUNT_ID       = 'acb133c90b48332c4cb3822e4c5edb58';
const ACCESS_KEY_ID    = 'a23d3c248087529b0c9e62d5a4142665';
const SECRET_ACCESS_KEY = '412c82c6944d60367f4278006e16235b6f6266eeba625c33945a8059834dcf1c';
const BUCKET           = 'verbyte-audio';
const PARALLEL         = 30;

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

// ── Args ──────────────────────────────────────────────────────────────────────
const argv    = process.argv.slice(2);
const langArg = argv.find(a => a.startsWith('--lang='))?.slice(7);
const LANGS   = langArg ? [langArg] : ['fr', 'en', 'de'];
const FORCE   = argv.includes('--force');

// ── Checkpoint ────────────────────────────────────────────────────────────────
const CHECKPOINT = path.join(ROOT, '.upload-checkpoint.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let uploaded = new Set();
if (!FORCE && fs.existsSync(CHECKPOINT)) {
  uploaded = new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')));
  console.log(`♻️  Checkpoint: ${uploaded.size} dosya zaten yüklendi.`);
}

function saveCheckpoint() {
  fs.writeFileSync(CHECKPOINT, JSON.stringify([...uploaded]));
}

// ── Upload tek dosya ──────────────────────────────────────────────────────────
async function uploadFile(localPath, r2Key, retries = 3) {
  const body = fs.readFileSync(localPath);
  for (let i = 1; i <= retries; i++) {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: r2Key,
        Body: body,
        ContentType: 'audio/mpeg',
      }));
      return;
    } catch (err) {
      if (i === retries) throw err;
      await sleep(500 * i);
    }
  }
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────
async function main() {
  const files = [];
  for (const lang of LANGS) {
    const dir = path.join(ROOT, 'audio-output', lang);
    if (!fs.existsSync(dir)) continue;
    for (const mp3 of fs.readdirSync(dir).filter(f => f.endsWith('.mp3'))) {
      const r2Key = `audio/${lang}/${mp3}`;
      if (!uploaded.has(r2Key)) {
        files.push({ localPath: path.join(dir, mp3), r2Key });
      }
    }
  }

  const total = uploaded.size + files.length;

  console.log(`\n☁️  Verbyte R2 Upload (S3 SDK)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Bucket     : ${BUCKET}`);
  console.log(`Toplam     : ${total}`);
  console.log(`Yüklendi   : ${uploaded.size}`);
  console.log(`Yüklenecek : ${files.length}`);
  console.log(`Paralel    : ${PARALLEL}`);
  console.log(`Tahmini    : ~${Math.ceil(files.length / PARALLEL / 10)} dakika`);
  console.log('');

  if (files.length === 0) {
    console.log('✅ Tüm dosyalar zaten yüklendi!');
    if (fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);
    return;
  }

  let ok = 0, fail = 0, idx = 0;
  let lastSave = Date.now();
  const startTime = Date.now();

  async function worker() {
    while (idx < files.length) {
      const { localPath, r2Key } = files[idx++];
      try {
        await uploadFile(localPath, r2Key);
        uploaded.add(r2Key);
        ok++;
        if (ok % 200 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = ok / elapsed;
          const remaining = Math.ceil((files.length - ok) / rate / 60);
          console.log(`  ✓ ${uploaded.size}/${total} yüklendi... (~${remaining} dk kaldı)`);
          saveCheckpoint();
          lastSave = Date.now();
        } else if (Date.now() - lastSave > 20_000) {
          saveCheckpoint();
          lastSave = Date.now();
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
  console.log(`\n✅ Upload tamamlandı! (${mins} dakika)`);
  console.log(`  Başarılı : ${ok}`);
  console.log(`  Hata     : ${fail}`);

  if (fail === 0) {
    if (fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);
    console.log(`\n🌐 https://pub-3b58e55d31da4838b79a6a178e8279bd.r2.dev/audio/{lang}/{id}.mp3`);
  } else {
    console.log(`\n⚠️  Hatalı dosyalar için tekrar çalıştır.`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
