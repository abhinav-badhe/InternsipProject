import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Automatically load .env file from workspace root
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const SUPABASE_DATABASE_URL =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres';

const DB_PORT = process.env.PGPORT || '5433';
const DB_HOST = process.env.PGHOST || '127.0.0.1';
const DB_USER = process.env.PGUSER || 'postgres';

const services = [
  { name: 'catalog-service', dir: 'services/catalog-service', port: 3001, db: 'catalog_db' },
  { name: 'pricing-service', dir: 'services/pricing-service', port: 3002, db: 'pricing_db' },
  { name: 'inventory-service', dir: 'services/inventory-service', port: 3003, db: 'inventory_db' },
  { name: 'order-service', dir: 'services/order-service', port: 3004, db: 'order_db' },
  { name: 'whatsapp-adapter', dir: 'services/whatsapp-adapter', port: 3005, db: 'whatsapp_db' },
  { name: 'payment-service', dir: 'services/payment-service', port: 3006, db: 'payment_db' },
  { name: 'identity-service', dir: 'services/identity-service', port: 3007, db: 'identity_db' },
  { name: 'fulfillment-service', dir: 'services/fulfillment-service', port: 3008, db: 'fulfillment_db' },
  { name: 'invoice-service', dir: 'services/invoice-service', port: 3009, db: 'invoice_db' },
  { name: 'analytics-service', dir: 'services/analytics-service', port: 3010, db: 'analytics_db' },
  { name: 'notification-service', dir: 'services/notification-service', port: 3011, db: 'notification_db' },
  { name: 'outbox-worker', dir: 'workers/event-workers', script: 'dist/src/worker.runner.js' },
  { name: 'api-gateway', dir: 'services/api-gateway', port: Number(process.env.PORT) || 3000 },
];

const sharedEnv = {
  ...process.env,
  JWT_SECRET: 'grocery-super-secret-jwt-key-for-development-32chars',
  IDENTITY_SERVICE_URL: 'http://localhost:3007',
  CATALOG_SERVICE_URL: 'http://localhost:3001',
  PRICING_SERVICE_URL: 'http://localhost:3002',
  INVENTORY_SERVICE_URL: 'http://localhost:3003',
  ORDER_SERVICE_URL: 'http://localhost:3004',
  WHATSAPP_ADAPTER_URL: 'http://localhost:3005',
  PAYMENT_SERVICE_URL: 'http://localhost:3006',
  FULFILLMENT_SERVICE_URL: 'http://localhost:3008',
  INVOICE_SERVICE_URL: 'http://localhost:3009',
  ANALYTICS_SERVICE_URL: 'http://localhost:3010',
  NOTIFICATION_SERVICE_URL: 'http://localhost:3011',
};

const runningProcesses = [];

function startService(svc) {
  const serviceCwd = path.join(rootDir, svc.dir);

  // Check if compiled dist exists, else fallback to tsx
  let scriptPath = svc.script || 'dist/index.js';
  if (!svc.script) {
    if (fs.existsSync(path.join(serviceCwd, 'dist/src/index.js'))) {
      scriptPath = 'dist/src/index.js';
    } else if (!fs.existsSync(path.join(serviceCwd, 'dist/index.js'))) {
      scriptPath = 'src/index.ts';
    }
  }

  const useNode = scriptPath.endsWith('.js');
  const runner = useNode ? 'node' : (process.platform === 'win32' ? 'npx.cmd' : 'npx');
  const args = useNode ? [scriptPath] : ['tsx', scriptPath];

  const env = {
    ...sharedEnv,
    PORT: String(svc.port || '0'),
  };

  if (SUPABASE_DATABASE_URL) {
    env.DATABASE_URL = SUPABASE_DATABASE_URL;
    env.DB_SSL = 'true';
  } else if (svc.db) {
    env.DATABASE_URL = `postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${svc.db}`;
  }

  console.log(svc.port ? `[BOOT] Starting ${svc.name} on port ${svc.port}...` : `[BOOT] Starting background worker ${svc.name}...`);
  const proc = spawn(runner, args, {
    cwd: serviceCwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout.on('data', (chunk) => {
    const lines = chunk.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) console.log(`[${svc.name}] ${line}`);
    }
  });

  proc.stderr.on('data', (chunk) => {
    const lines = chunk.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) console.error(`[${svc.name}:ERR] ${line}`);
    }
  });

  proc.on('exit', (code) => {
    console.log(`[EXIT] ${svc.name} exited with code ${code}`);
  });

  runningProcesses.push(proc);
}

function shutdown() {
  console.log('\nShutting down all backend services...');
  for (const p of runningProcesses) {
    try {
      p.kill();
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('=== Starting Omnichannel Grocery Backend Platform ===');
for (const svc of services) {
  startService(svc);
}
console.log('All backend services spawned. Press Ctrl+C to terminate.\n');
