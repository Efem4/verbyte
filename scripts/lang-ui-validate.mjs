#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizeLangCode(code) {
  return String(code || '').trim().toLowerCase();
}

function isBaseLang(code) {
  return code === 'fr';
}

function dataFile(root, kind, code) {
  const ext = kind === 'audioMap' ? '.json' : '.js';
  return path.join(root, 'src', 'languages', code, `${kind}${ext}`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

export async function validateLanguageUiWiring({
  workspace = process.cwd(),
  code,
}) {
  const lang = normalizeLangCode(code);
  if (!lang) throw new Error('--code is required.');

  const root = path.resolve(workspace);
  const checks = [];

  const requiredData = [
    dataFile(root, 'vocabulary', lang),
    dataFile(root, 'sentences', lang),
    dataFile(root, 'audioMap', lang),
  ];
  for (const filePath of requiredData) {
    checks.push({
      id: `data:${path.basename(filePath)}`,
      ok: await fileExists(filePath),
      detail: filePath,
    });
  }

  const appPath = path.join(root, 'src', 'App.jsx');
  const appSrc = (await fileExists(appPath)) ? await readText(appPath) : '';
  checks.push({
    id: 'app:registry-import',
    ok: /from\s+['"].\/config\/languageRegistry['"]/.test(appSrc),
    detail: appPath,
  });

  const registryPath = path.join(root, 'src', 'config', 'languageRegistry.js');
  const registrySrc = (await fileExists(registryPath)) ? await readText(registryPath) : '';
  checks.push({
    id: 'registry:lang-meta',
    ok: new RegExp(`code\\s*:\\s*['"]${lang}['"]`).test(registrySrc),
    detail: registryPath,
  });
  checks.push({
    id: 'registry:lang-data',
    ok: new RegExp(`\\b${lang}\\s*:\\s*\\{`).test(registrySrc),
    detail: registryPath,
  });

  const speakPath = isBaseLang(lang)
    ? path.join(root, 'src', 'utils', 'speak.js')
    : path.join(root, 'src', 'utils', `speak-${lang}.js`);
  checks.push({
    id: 'audio:speak-util',
    ok: await fileExists(speakPath),
    detail: speakPath,
  });

  const flashcardPagePath = path.join(root, 'src', 'components', 'FlashcardPage.jsx');
  const flashcardPageSrc = (await fileExists(flashcardPagePath)) ? await readText(flashcardPagePath) : '';
  checks.push({
    id: 'component:flashcard-langconfig',
    ok: /langConfig/.test(flashcardPageSrc),
    detail: flashcardPagePath,
  });

  return {
    code: lang,
    ok: checks.every((c) => c.ok),
    checks,
  };
}

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg.startsWith('--code=')) args.code = arg.slice('--code='.length);
    if (arg.startsWith('--workspace=')) args.workspace = arg.slice('--workspace='.length);
  }
  return args;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  validateLanguageUiWiring(args)
    .then((result) => {
      console.log(`[lang-ui] code=${result.code} ok=${result.ok}`);
      for (const check of result.checks) {
        console.log(`[lang-ui] ${check.ok ? 'PASS' : 'FAIL'} ${check.id} -> ${check.detail}`);
      }
      if (!result.ok) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`[lang-ui] ${error.message}`);
      process.exitCode = 1;
    });
}
