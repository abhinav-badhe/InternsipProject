import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('       FreshCart Web Platform - Launching Web Frontends         ');
console.log('================================================================\n');

// 1. Customer Web Store (Port 5173)
console.log('[CUSTOMER WEB] Starting on http://localhost:5173 ...');
const customerWeb = spawn('npx', ['vite', '--port', '5173', '--host'], {
  cwd: path.resolve(rootDir, 'apps/customer-web'),
  stdio: 'inherit',
  shell: true,
});

// 2. Store Admin / Seller Hub (Port 5174)
console.log('[STORE ADMIN] Starting on http://localhost:5174 ...\n');
const adminWeb = spawn('npx', ['vite', '--port', '5174', '--host'], {
  cwd: path.resolve(rootDir, 'apps/store-admin-web'),
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  console.log('\nShutting down web frontend servers...');
  try { customerWeb.kill(); } catch {}
  try { adminWeb.kill(); } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

