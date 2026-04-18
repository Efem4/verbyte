import { execSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const workerRoot = resolve(root, '..', 'retuel-site');
const distDir = resolve(root, 'dist');
const verbyteDest = resolve(workerRoot, 'verbyte');

console.log('📦 dist → retuel-site/verbyte kopyalanıyor...');
cpSync(distDir, verbyteDest, { recursive: true });

console.log('🚀 Cloudflare Workers deploy ediliyor...');
execSync('npx wrangler deploy', { cwd: workerRoot, stdio: 'inherit' });

console.log('✅ Deploy tamamlandı.');
