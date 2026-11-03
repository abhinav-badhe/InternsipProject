import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CATEGORY_DEFINITIONS, pool, DEFAULT_LOCATION_ID, esc, num, rootDir } from './catalog-data-defs.mjs';

// ============================================================================
// 2. CURATED MASTER BRANDS LIST (50+ Recognizable Grocery Brands)
// ============================================================================
const BRAND_DEFINITIONS = [
  { id: '21000000-0000-0000-0000-000000000001', name: 'FreshFarm Produce', slug: 'freshfarm' },
  { id: '21000000-0000-0000-0000-000000000002', name: 'Amul', slug: 'amul' },
  { id: '21000000-0000-0000-0000-000000000003', name: 'Mother Dairy', slug: 'mother-dairy' },
  { id: '21000000-0000-0000-0000-000000000004', name: 'Britannia', slug: 'britannia' },
  { id: '21000000-0000-0000-0000-000000000005', name: 'Harvest Gold', slug: 'harvest-gold' },
  { id: '21000000-0000-0000-0000-000000000006', name: 'English Oven', slug: 'english-oven' },
  { id: '21000000-0000-0000-0000-000000000007', name: 'Nestle', slug: 'nestle' },
  { id: '21000000-0000-0000-0000-000000000008', name: 'Aashirvaad', slug: 'aashirvaad' },
  { id: '21000000-0000-0000-0000-000000000009', name: 'Fortune', slug: 'fortune' },
  { id: '21000000-0000-0000-0000-000000000010', name: 'Tata Sampann', slug: 'tata-sampann' },
  { id: '21000000-0000-0000-0000-000000000011', name: 'India Gate', slug: 'india-gate' },
  { id: '21000000-0000-0000-0000-000000000012', name: 'Daawat', slug: 'daawat' },
  { id: '21000000-0000-0000-0000-000000000013', name: 'Saffola', slug: 'saffola' },
  { id: '21000000-0000-0000-0000-000000000014', name: 'Everest', slug: 'everest' },
  { id: '21000000-0000-0000-0000-000000000015', name: 'MDH', slug: 'mdh' },
  { id: '21000000-0000-0000-0000-000000000016', name: 'Catch', slug: 'catch' },
  { id: '21000000-0000-0000-0000-000000000017', name: 'Happilo', slug: 'happilo' },
  { id: '21000000-0000-0000-0000-000000000018', name: 'Nutraj', slug: 'nutraj' },
  { id: '21000000-0000-0000-0000-000000000019', name: "Lay's", slug: 'lays' },
  { id: '21000000-0000-0000-0000-000000000020', name: 'Kurkure', slug: 'kurkure' },
  { id: '21000000-0000-0000-0000-000000000021', name: "Haldiram's", slug: 'haldirams' },
  { id: '21000000-0000-0000-0000-000000000022', name: 'Parle', slug: 'parle' },
  { id: '21000000-0000-0000-0000-000000000023', name: 'Oreo', slug: 'oreo' },
  { id: '21000000-0000-0000-0000-000000000024', name: 'Sunfeast', slug: 'sunfeast' },
  { id: '21000000-0000-0000-0000-000000000025', name: 'Brooke Bond Red Label', slug: 'red-label' },
  { id: '21000000-0000-0000-0000-000000000026', name: 'Tata Tea', slug: 'tata-tea' },
  { id: '21000000-0000-0000-0000-000000000027', name: 'Nescafe', slug: 'nescafe' },
  { id: '21000000-0000-0000-0000-000000000028', name: 'Bru', slug: 'bru' },
  { id: '21000000-0000-0000-0000-000000000029', name: 'Real Fruit Power', slug: 'real' },
  { id: '21000000-0000-0000-0000-000000000030', name: 'Coca-Cola', slug: 'coca-cola' },
  { id: '21000000-0000-0000-0000-000000000031', name: 'Thums Up', slug: 'thums-up' },
  { id: '21000000-0000-0000-0000-000000000032', name: 'Sprite', slug: 'sprite' },
  { id: '21000000-0000-0000-0000-000000000033', name: 'Maggi', slug: 'maggi' },
  { id: '21000000-0000-0000-0000-000000000034', name: 'Knorr', slug: 'knorr' },
  { id: '21000000-0000-0000-0000-000000000035', name: 'MTR', slug: 'mtr' },
  { id: '21000000-0000-0000-0000-000000000036', name: "Kellogg's", slug: 'kelloggs' },
  { id: '21000000-0000-0000-0000-000000000037', name: 'Quaker', slug: 'quaker' },
  { id: '21000000-0000-0000-0000-000000000038', name: 'McCain', slug: 'mccain' },
  { id: '21000000-0000-0000-0000-000000000039', name: 'Cadbury', slug: 'cadbury' },
  { id: '21000000-0000-0000-0000-000000000040', name: 'Ferrero Rocher', slug: 'ferrero-rocher' },
  { id: '21000000-0000-0000-0000-000000000041', name: 'Nutella', slug: 'nutella' },
  { id: '21000000-0000-0000-0000-000000000042', name: 'Dabur Honey', slug: 'dabur-honey' },
  { id: '21000000-0000-0000-0000-000000000043', name: 'Pintola', slug: 'pintola' },
  { id: '21000000-0000-0000-0000-000000000044', name: 'Dettol', slug: 'dettol' },
  { id: '21000000-0000-0000-0000-000000000045', name: 'Dove', slug: 'dove' },
  { id: '21000000-0000-0000-0000-000000000046', name: 'Lifebuoy', slug: 'lifebuoy' },
  { id: '21000000-0000-0000-0000-000000000047', name: 'Colgate', slug: 'colgate' },
  { id: '21000000-0000-0000-0000-000000000048', name: 'Head & Shoulders', slug: 'head-shoulders' },
  { id: '21000000-0000-0000-0000-000000000049', name: 'Nivea', slug: 'nivea' },
  { id: '21000000-0000-0000-0000-000000000050', name: 'Surf Excel', slug: 'surf-excel' },
  { id: '21000000-0000-0000-0000-000000000051', name: 'Ariel', slug: 'ariel' },
  { id: '21000000-0000-0000-0000-000000000052', name: 'Vim', slug: 'vim' },
  { id: '21000000-0000-0000-0000-000000000053', name: 'Harpic', slug: 'harpic' },
  { id: '21000000-0000-0000-0000-000000000054', name: 'Lizol', slug: 'lizol' },
  { id: '21000000-0000-0000-0000-000000000055', name: 'Pampers', slug: 'pampers' },
  { id: '21000000-0000-0000-0000-000000000056', name: 'Huggies', slug: 'huggies' },
  { id: '21000000-0000-0000-0000-000000000057', name: 'Pedigree', slug: 'pedigree' },
  { id: '21000000-0000-0000-0000-000000000058', name: 'Whiskas', slug: 'whiskas' },
  { id: '21000000-0000-0000-0000-000000000059', name: 'Drools', slug: 'drools' },
];

export { BRAND_DEFINITIONS };

