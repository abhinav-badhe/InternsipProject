import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SUPABASE_DATABASE_URL =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DEFAULT_LOCATION_ID = '80000000-0000-0000-0000-000000000001';

// ============================================================================
// 1. COMPREHENSIVE CATEGORIES (11 Key Supermarket Departments)
// ============================================================================
export const CATEGORY_DEFINITIONS = [
  {
    id: '11000000-0000-0000-0000-000000000001',
    name: 'Fresh Fruits & Vegetables',
    slug: 'fruits-vegetables',
    description: 'Farm-fresh organic fruits, seasonal greens, salad items, and everyday cooking vegetables',
    image_url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80',
    aliases: ['fruit', 'fruits', 'vegetable', 'vegetables', 'sabzi', 'greens', 'organic produce', 'farm fresh'],
  },
  {
    id: '11000000-0000-0000-0000-000000000002',
    name: 'Dairy, Bread & Eggs',
    slug: 'dairy-bread-eggs',
    description: 'Fresh milk, artisanal bakery breads, farm eggs, paneer, butter, cheese, and yogurts',
    image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
    aliases: ['dairy', 'milk', 'bread', 'eggs', 'butter', 'cheese', 'paneer', 'dahi', 'curd', 'bakery'],
  },
  {
    id: '11000000-0000-0000-0000-000000000003',
    name: 'Staples, Atta, Rice & Dals',
    slug: 'staples-flours-rice',
    description: 'Premium whole wheat flours, aged basmati rice, organic pulses, cooking oils, and sugar',
    image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    aliases: ['staples', 'atta', 'flour', 'rice', 'dal', 'pulses', 'oil', 'ghee', 'sugar', 'salt', 'grains'],
  },
  {
    id: '11000000-0000-0000-0000-000000000004',
    name: 'Masalas, Spices & Dry Fruits',
    slug: 'masalas-spices-dryfruits',
    description: 'Aromatic whole spices, ground masala powders, premium nuts, California almonds, and raisins',
    image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
    aliases: ['masala', 'spices', 'dry fruits', 'almonds', 'cashews', 'turmeric', 'chilli', 'cloves', 'cardamom'],
  },
  {
    id: '11000000-0000-0000-0000-000000000005',
    name: 'Snacks, Biscuits & Munchies',
    slug: 'snacks-biscuits',
    description: 'Crispy potato wafers, crunchy namkeens, digestive biscuits, cookies, and gourmet popcorn',
    image_url: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80',
    aliases: ['snacks', 'biscuits', 'chips', 'namkeen', 'cookies', 'munchies', 'wafers', 'bhujia', 'popcorn'],
  },
  {
    id: '11000000-0000-0000-0000-000000000006',
    name: 'Beverages & Soft Drinks',
    slug: 'beverages-drinks',
    description: 'Refreshing juices, sparkling cold sodas, Assam tea leaves, roasted coffee, and energy drinks',
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
    aliases: ['beverages', 'drinks', 'tea', 'coffee', 'juice', 'soda', 'cold drink', 'energy drink', 'water'],
  },
  {
    id: '11000000-0000-0000-0000-000000000007',
    name: 'Instant, Canned & Frozen Food',
    slug: 'instant-frozen-foods',
    description: 'Instant noodles, ready-to-eat curries, pasta, breakfast cereals, rolled oats, and frozen snacks',
    image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80',
    aliases: ['instant food', 'noodles', 'maggi', 'pasta', 'frozen', 'ready to eat', 'cereal', 'oats', 'soup'],
  },
  {
    id: '11000000-0000-0000-0000-000000000008',
    name: 'Chocolates, Sweets & Spreads',
    slug: 'chocolates-sweets-desserts',
    description: 'Silky dark chocolates, traditional Indian sweets, honey, peanut butter, fruit jams, and dessert mixes',
    image_url: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80',
    aliases: ['chocolates', 'sweets', 'desserts', 'mithai', 'jam', 'honey', 'peanut butter', 'nutella', 'spread'],
  },
  {
    id: '11000000-0000-0000-0000-000000000009',
    name: 'Personal Care, Soaps & Hygiene',
    slug: 'personal-care-hygiene',
    description: 'Luxury bathing soaps, body wash, herbal shampoos, toothpastes, skincare lotions, and hygiene',
    image_url: 'https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=600&q=80',
    aliases: ['personal care', 'soap', 'soaps', 'bathing soap', 'body wash', 'shampoo', 'toothpaste', 'hygiene'],
  },
  {
    id: '11000000-0000-0000-0000-000000000010',
    name: 'Cleaning & Household Essentials',
    slug: 'cleaning-household',
    description: 'Laundry detergents, stain removers, dishwash gels, floor disinfectants, paper rolls, and garbage bags',
    image_url: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80',
    aliases: ['cleaning', 'household', 'detergent', 'dishwash', 'disinfectant', 'cleaner', 'tissues', 'garbage bag'],
  },
  {
    id: '11000000-0000-0000-0000-000000000011',
    name: 'Baby Care & Pet Supplies',
    slug: 'baby-pet-care',
    description: 'Gentle baby diapers, nourishing infant baby wash, premium dog food kibbles, cat treats, and pet toys',
    image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80',
    aliases: ['baby care', 'diapers', 'baby food', 'pet care', 'dog food', 'cat food', 'pet food', 'baby wipes'],
  },
];

// Helper to sanitize strings for SQL inserts
function esc(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function num(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return String(val);
}

export { pool, DEFAULT_LOCATION_ID, esc, num, rootDir };

