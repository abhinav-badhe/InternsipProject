import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('       FreshCart Grocery Platform & WhatsApp Automation         ');
console.log('================================================================\n');

// 1. Start Ngrok Tunnel on Port 3000
const ngrokDomain = process.env.NGROK_DOMAIN || 'agreeable-smasher-secret.ngrok-free.dev';
console.log(`[NGROK] Starting tunnel to http://localhost:3000 (URL: https://${ngrokDomain})...`);

const ngrokProc = spawn('ngrok', ['http', `--url=${ngrokDomain}`, '3000'], {
  stdio: 'ignore',
  shell: true,
});

ngrokProc.on('error', (err) => {
  console.error('[NGROK ERROR]', err.message);
});

// 2. Start Backend Microservices Mesh
console.log('[BACKEND] Launching 11 microservices and background workers...\n');
const backendProc = spawn('node', ['scripts/start-backend.mjs'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  console.log('\nShutting down platform and ngrok tunnel...');
  try { ngrokProc.kill(); } catch {}
  try { backendProc.kill(); } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

