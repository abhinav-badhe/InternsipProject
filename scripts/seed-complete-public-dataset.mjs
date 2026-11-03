import pg from 'pg';
const { Pool } = pg;

const SUPABASE_DATABASE_URL =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Primary Store Location UUID
const DEFAULT_LOCATION_ID = '80000000-0000-0000-0000-000000000001';

async function seedCompleteDataset() {
  console.log('========================================================================');
  console.log('🛒 SEEDING COMPLETE GROCERY DATASET WITH PUBLICLY ACCESSIBLE IMAGES');
  console.log('========================================================================\n');

  // 1. Ensure Stock Location
  await pool.query(
    `INSERT INTO stock_locations (id, code, name, is_active)
     VALUES ($1, 'STORE-MAIN-01', 'Downtown Omnichannel Superstore', TRUE)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [DEFAULT_LOCATION_ID]
  );
  console.log('✓ Default stock location verified');

  // 2. Categories with Public CDN Images
  const categories = [
    {
      id: '11000000-0000-0000-0000-000000000001',
      name: 'Bathing Soaps & Body Wash',
      slug: 'bathing-soaps',
      description: 'Luxury moisturizing bathing bars, herbal cleansers, and refreshing body washes',
      image_url: 'https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=600&q=80',
      aliases: ['soap', 'soaps', 'bathing soap', 'body wash', 'shower gel', 'bath bar'],
    },
    {
      id: '11000000-0000-0000-0000-000000000002',
      name: 'Washing Soaps & Detergent Bars',
      slug: 'washing-soaps',
      description: 'Stain-fighting detergent bars and fabric washing soaps for bright clothes',
      image_url: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80',
      aliases: ['soap', 'soaps', 'washing soap', 'detergent bar', 'clothes soap'],
    },
    {
      id: '11000000-0000-0000-0000-000000000003',
      name: 'Dishwashing & Utensil Soaps',
      slug: 'utensil-soaps',
      description: 'Degreasing dishwash bars, liquids, and pastes for sparkling clean cookware',
      image_url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80',
      aliases: ['soap', 'soaps', 'dish soap', 'utensil soap', 'dishwash bar', 'dishwashing'],
    },
    {
      id: '11000000-0000-0000-0000-000000000004',
      name: 'Dairy, Butter & Eggs',
      slug: 'dairy-butter',
      description: 'Farm-fresh milk, salted & unsalted butter, cheese blocks, paneer, and eggs',
      image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
      aliases: ['dairy', 'butter', 'milk', 'cheese', 'paneer', 'eggs', 'curd', 'dahi'],
    },
    {
      id: '11000000-0000-0000-0000-000000000005',
      name: 'Breads & Bakery',
      slug: 'bread-bakery',
      description: 'Freshly baked sandwich breads, whole wheat loaves, buns, and crusty baguettes',
      image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
      aliases: ['bread', 'bakery', 'toast', 'buns', 'cookies', 'biscuits', 'pav'],
    },
    {
      id: '11000000-0000-0000-0000-000000000006',
      name: 'Oral Care & Toothpastes',
      slug: 'oral-care',
      description: 'Anticavity toothpastes, enamel protection gel, and oral hygiene care',
      image_url: 'https://images.unsplash.com/photo-1559591937-e129188d4474?auto=format&fit=crop&w=600&q=80',
      aliases: ['toothpaste', 'oral care', 'toothbrush', 'mouthwash', 'paste', 'teeth'],
    },
    {
      id: '11000000-0000-0000-0000-000000000007',
      name: 'Hair Care & Shampoos',
      slug: 'hair-care',
      description: 'Nourishing botanical shampoos, deep conditioners, and pure hair oils',
      image_url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80',
      aliases: ['shampoo', 'hair care', 'hair oil', 'conditioner', 'hair'],
    },
    {
      id: '11000000-0000-0000-0000-000000000008',
      name: 'Staples, Flours, Salt & Sugar',
      slug: 'staples-salt-sugar',
      description: 'Vacuum iodised salt, refined sugar, premium wheat flour (atta), and dal pulses',
      image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
      aliases: ['salt', 'sugar', 'atta', 'flour', 'rice', 'dal', 'pulses', 'staples', 'oil'],
    },
    {
      id: '11000000-0000-0000-0000-000000000009',
      name: 'Laundry Powders & Detergents',
      slug: 'laundry-powders',
      description: 'Top load, front load, and hand-wash laundry powders with active enzymes',
      image_url: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80',
      aliases: ['detergent', 'washing powder', 'laundry powder', 'surf', 'detergent liquid'],
    },
    {
      id: '11000000-0000-0000-0000-000000000010',
      name: 'Tea, Coffee & Beverages',
      slug: 'beverages-tea-coffee',
      description: 'Aromatic whole leaf teas, roasted instant coffee beans, and fruit juices',
      image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
      aliases: ['tea', 'chai', 'coffee', 'juice', 'beverages', 'drinks', 'cold drink'],
    },
    {
      id: '11000000-0000-0000-0000-000000000011',
      name: 'Snacks, Biscuits & Instant Food',
      slug: 'snacks-instant-food',
      description: 'Crispy potato chips, instant 2-minute noodles, gourmet cookies, and namkeen',
      image_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
      aliases: ['snacks', 'chips', 'noodles', 'maggi', 'biscuits', 'namkeen'],
    },
    {
      id: '10000000-0000-0000-0000-000000000005',
      name: 'Fresh Fruits & Farm Vegetables',
      slug: 'fruits-vegetables',
      description: 'Daily harvest organic potatoes, crisp onions, ripe tomatoes, apples, and bananas',
      image_url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
      aliases: ['vegetables', 'fruits', 'onion', 'potato', 'tomato', 'apple', 'banana', 'fresh'],
    },
  ];

  for (const c of categories) {
    const updateRes = await pool.query(
      `UPDATE categories
       SET name = $2, description = $3, image_url = $4, aliases = $5, is_active = TRUE
       WHERE id = $1`,
      [c.id, c.name, c.description, c.image_url, c.aliases]
    );

    if (updateRes.rowCount === 0) {
      await pool.query(
        `INSERT INTO categories (id, name, slug, description, image_url, aliases, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT DO NOTHING`,
        [c.id, c.name, c.slug, c.description, c.image_url, c.aliases]
      );
    }
  }
  console.log(`✓ Synchronized ${categories.length} categories with public images`);

  // 3. Brands with Public Logos
  const brands = [
    { id: '20000000-0000-0000-0000-000000000001', name: 'Dove', logo: 'https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000002', name: 'Dettol', logo: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000003', name: 'Rin', logo: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000004', name: 'Vim', logo: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000005', name: 'Amul', logo: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000006', name: 'Lux', logo: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000007', name: 'Pears', logo: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000008', name: 'Britannia', logo: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000009', name: 'Colgate', logo: 'https://images.unsplash.com/photo-1559591937-e129188d4474?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000010', name: 'Hair & Care', logo: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000011', name: 'Tata', logo: 'https://images.unsplash.com/photo-1518110903495-cdffac505a60?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000012', name: 'Madhur', logo: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000013', name: 'Surf Excel', logo: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000014', name: 'Aashirvaad', logo: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000015', name: 'Fortune', logo: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000016', name: 'Maggi', logo: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000017', name: 'Nescafe', logo: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000018', name: 'Lay’s', logo: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=200&q=80' },
    { id: '20000000-0000-0000-0000-000000000019', name: 'Farm Fresh', logo: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=200&q=80' },
  ];

  for (const b of brands) {
    await pool.query(
      `INSERT INTO brands (id, name, slug, logo_url, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url`,
      [b.id, b.name, b.name.toLowerCase().replace(/[^a-z0-9]/g, '-'), b.logo]
    );
  }
  console.log(`✓ Synchronized ${brands.length} brands with logo URLs`);

  // 4. Products, Variants, Base Prices, and Stock Balances
  const catalog = [
    // -------------------------------------------------------------
    // CATEGORY 1: Bathing Soaps & Body Wash
    // -------------------------------------------------------------
    {
      productId: '30000000-0000-0000-0000-000000000001',
      name: 'Dove Cream Beauty Bathing Bar',
      brandId: '20000000-0000-0000-0000-000000000001',
      categoryId: '11000000-0000-0000-0000-000000000001',
      description: 'Enriched with 1/4 moisturizing cream for soft, smooth, glowing skin',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['soap', 'bathing', 'dove', 'moisturizer'],
      variants: [
        {
          sku: 'DOVE-BAR-75G',
          name: '75 g Single Bar',
          weight: 75,
          unit: 'g',
          price: 52,
          stock: 100,
          image: 'https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'DOVE-BAR-125G-4PK',
          name: '125 g (Pack of 4)',
          weight: 500,
          unit: 'g',
          price: 295,
          stock: 45,
          image: 'https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000002',
      name: 'Dettol Original Germ Protection Bathing Soap',
      brandId: '20000000-0000-0000-0000-000000000002',
      categoryId: '11000000-0000-0000-0000-000000000001',
      description: 'Trusted 99.9% germ defense with classic pine fragrance',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['soap', 'dettol', 'germ protection', 'hygiene'],
      variants: [
        {
          sku: 'DETTOL-ORIG-75G',
          name: '75 g Single Bar',
          weight: 75,
          unit: 'g',
          price: 38,
          stock: 80,
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'DETTOL-ORIG-125G-3PK',
          name: '125 g (Pack of 3)',
          weight: 375,
          unit: 'g',
          price: 162,
          stock: 35,
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000003',
      name: 'Pears Pure & Gentle Bathing Bar',
      brandId: '20000000-0000-0000-0000-000000000007',
      categoryId: '11000000-0000-0000-0000-000000000001',
      description: 'Transparent glycerine bathing bar preserving skin natural hydration',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['soap', 'pears', 'glycerine', 'pure'],
      variants: [
        {
          sku: 'PEARS-PURE-75G',
          name: '75 g Single Bar',
          weight: 75,
          unit: 'g',
          price: 58,
          stock: 60,
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'PEARS-PURE-125G-3PK',
          name: '125 g (Pack of 3)',
          weight: 375,
          unit: 'g',
          price: 189,
          stock: 25,
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000004',
      name: 'Lux Rose & Vitamin E Bathing Soap',
      brandId: '20000000-0000-0000-0000-000000000006',
      categoryId: '11000000-0000-0000-0000-000000000001',
      description: 'French rose essence and Vitamin E for glowing radiant skin',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['soap', 'lux', 'rose', 'fragrance'],
      variants: [
        {
          sku: 'LUX-ROSE-100G-3PK',
          name: '100 g (Pack of 3)',
          weight: 300,
          unit: 'g',
          price: 99,
          stock: 0, // Kept 0 to demonstrate automated alternative recommendation in WhatsApp flow
          image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // -------------------------------------------------------------
    // CATEGORY 4: Dairy, Butter & Eggs
    // -------------------------------------------------------------
    {
      productId: '30000000-0000-0000-0000-000000000010',
      name: 'Amul Pasteurised Butter',
      brandId: '20000000-0000-0000-0000-000000000005',
      categoryId: '11000000-0000-0000-0000-000000000004',
      description: 'Classic delicious salted butter made from fresh pure cow & buffalo milk',
      storageType: 'chilled',
      isPerishable: true,
      tags: ['butter', 'amul', 'dairy', 'breakfast'],
      variants: [
        {
          sku: 'AMUL-BTR-500G',
          name: '500 g Carton',
          weight: 500,
          unit: 'g',
          price: 275,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'AMUL-BTR-100G',
          name: '100 g Pack',
          weight: 100,
          unit: 'g',
          price: 58,
          stock: 80,
          image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000020',
      name: 'Amul Taaza Homogenised Toned Milk',
      brandId: '20000000-0000-0000-0000-000000000005',
      categoryId: '11000000-0000-0000-0000-000000000004',
      description: 'Long-life UHT processed toned milk with zero bacteria',
      storageType: 'ambient',
      isPerishable: true,
      tags: ['milk', 'amul', 'toned milk', 'beverage'],
      variants: [
        {
          sku: 'AMUL-TZ-1L',
          name: '1 Litre Tetra Pak',
          weight: 1,
          unit: 'l',
          price: 72,
          stock: 65,
          image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'AMUL-TZ-500ML',
          name: '500 ml Pouch',
          weight: 500,
          unit: 'ml',
          price: 36,
          stock: 90,
          image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000021',
      name: 'Farm Fresh White Protein Eggs',
      brandId: '20000000-0000-0000-0000-000000000019',
      categoryId: '11000000-0000-0000-0000-000000000004',
      description: 'Graded antibiotic-free wholesome fresh table eggs',
      storageType: 'ambient',
      isPerishable: true,
      tags: ['eggs', 'protein', 'breakfast'],
      variants: [
        {
          sku: 'EGGS-WHITE-6PK',
          name: 'Pack of 6 Eggs',
          weight: 350,
          unit: 'g',
          price: 54,
          stock: 75,
          image: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'EGGS-WHITE-12PK',
          name: 'Pack of 12 Eggs',
          weight: 700,
          unit: 'g',
          price: 105,
          stock: 40,
          image: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // -------------------------------------------------------------
    // CATEGORY 5: Breads & Bakery
    // -------------------------------------------------------------
    {
      productId: '30000000-0000-0000-0000-000000000011',
      name: 'Britannia Large Sandwich White Bread',
      brandId: '20000000-0000-0000-0000-000000000008',
      categoryId: '11000000-0000-0000-0000-000000000005',
      description: 'Soft, airy sandwich slices perfect for morning toast and clubhouse sandwiches',
      storageType: 'ambient',
      isPerishable: true,
      tags: ['bread', 'sandwich', 'britannia', 'bakery'],
      variants: [
        {
          sku: 'BRIT-BREAD-LRG-500G',
          name: 'Large 500 g Loaf',
          weight: 500,
          unit: 'g',
          price: 50,
          stock: 40,
          image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000022',
      name: 'Britannia 100% Whole Wheat Brown Bread',
      brandId: '20000000-0000-0000-0000-000000000008',
      categoryId: '11000000-0000-0000-0000-000000000005',
      description: 'Fiber-rich whole wheat loaf baked without added maida',
      storageType: 'ambient',
      isPerishable: true,
      tags: ['brown bread', 'whole wheat', 'fiber', 'healthy'],
      variants: [
        {
          sku: 'BRIT-BREAD-WHEAT-400G',
          name: '400 g Pack',
          weight: 400,
          unit: 'g',
          price: 55,
          stock: 35,
          image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // -------------------------------------------------------------
    // CATEGORY 6: Oral Care & Toothpastes
    // -------------------------------------------------------------
    {
      productId: '30000000-0000-0000-0000-000000000012',
      name: 'Colgate Strong Teeth Anticavity Toothpaste',
      brandId: '20000000-0000-0000-0000-000000000009',
      categoryId: '11000000-0000-0000-0000-000000000006',
      description: 'Amino Shakti formula adds natural calcium for 2x stronger teeth',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['colgate', 'toothpaste', 'anticavity', 'oral care'],
      variants: [
        {
          sku: 'COLG-TOOTH-200G',
          name: '200 g Tube',
          weight: 200,
          unit: 'g',
          price: 110,
          stock: 65,
          image: 'https://images.unsplash.com/photo-1559591937-e129188d4474?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'COLG-TOOTH-100G',
          name: '100 g Tube',
          weight: 100,
          unit: 'g',
          price: 65,
          stock: 90,
          image: 'https://images.unsplash.com/photo-1559591937-e129188d4474?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // -------------------------------------------------------------
    // CATEGORY 7: Hair Care & Shampoos
    // -------------------------------------------------------------
    {
      productId: '30000000-0000-0000-0000-000000000013',
      name: 'Hair & Care Triple Blend Nourishing Shampoo',
      brandId: '20000000-0000-0000-0000-000000000010',
      categoryId: '11000000-0000-0000-0000-000000000007',
      description: 'Enriched with aloe vera, olive oil, and green tea for silky frizz-free hair',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['shampoo', 'hair care', 'hair & care', 'nourishing'],
      variants: [
        {
          sku: 'HNC-SHAMP-200G',
          name: '200 ml Bottle',
          weight: 200,
          unit: 'ml',
          price: 155,
          stock: 35,
          image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // -------------------------------------------------------------
    // CATEGORY 8: Staples, Flours, Salt & Sugar
    // -------------------------------------------------------------
    {
      productId: '30000000-0000-0000-0000-000000000014',
      name: 'Tata Salt Vacuum Evaporated Iodised Salt',
      brandId: '20000000-0000-0000-0000-000000000011',
      categoryId: '11000000-0000-0000-0000-000000000008',
      description: 'Desh Ka Namak: Untouched by hand, 100% vacuum evaporated iodised salt',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['salt', 'tata salt', 'iodised', 'staple'],
      variants: [
        {
          sku: 'TATA-SALT-500G',
          name: '500 g Pack',
          weight: 500,
          unit: 'g',
          price: 16,
          stock: 80,
          image: 'https://images.unsplash.com/photo-1518110903495-cdffac505a60?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'TATA-SALT-1KG',
          name: '1 kg Pack',
          weight: 1,
          unit: 'kg',
          price: 28,
          stock: 150,
          image: 'https://images.unsplash.com/photo-1518110903495-cdffac505a60?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000015',
      name: 'Madhur Pure & Hygienic Refined Sugar',
      brandId: '20000000-0000-0000-0000-000000000012',
      categoryId: '11000000-0000-0000-0000-000000000008',
      description: 'Sulphur-free double refined crystal sugar for daily cooking & desserts',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['sugar', 'madhur', 'sweet', 'staple'],
      variants: [
        {
          sku: 'MADHUR-SUGAR-2KG',
          name: '2 kg Bag',
          weight: 2,
          unit: 'kg',
          price: 105,
          stock: 60,
          image: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'MADHUR-SUGAR-1KG',
          name: '1 kg Bag',
          weight: 1,
          unit: 'kg',
          price: 54,
          stock: 100,
          image: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000023',
      name: 'Aashirvaad Superior MP Sharbati Whole Wheat Atta',
      brandId: '20000000-0000-0000-0000-000000000014',
      categoryId: '11000000-0000-0000-0000-000000000008',
      description: '100% whole wheat stone ground flour for extra soft fluffy rotis',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['atta', 'flour', 'wheat', 'roti', 'aashirvaad'],
      variants: [
        {
          sku: 'AASH-ATTA-5KG',
          name: '5 kg Bag',
          weight: 5,
          unit: 'kg',
          price: 265,
          stock: 45,
          image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'AASH-ATTA-10KG',
          name: '10 kg Value Pack',
          weight: 10,
          unit: 'kg',
          price: 495,
          stock: 30,
          image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000024',
      name: 'Fortune Sunlite Refined Sunflower Oil',
      brandId: '20000000-0000-0000-0000-000000000015',
      categoryId: '11000000-0000-0000-0000-000000000008',
      description: 'Light and healthy cooking oil rich in natural Vitamin E',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['oil', 'cooking oil', 'sunflower oil', 'fortune'],
      variants: [
        {
          sku: 'FORT-OIL-1L',
          name: '1 Litre Pouch',
          weight: 1,
          unit: 'l',
          price: 145,
          stock: 55,
          image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // -------------------------------------------------------------
    // CATEGORY 9: Laundry Powders & Detergents
    // -------------------------------------------------------------
    {
      productId: '30000000-0000-0000-0000-000000000016',
      name: 'Surf Excel Matic Top Load Detergent Powder',
      brandId: '20000000-0000-0000-0000-000000000013',
      categoryId: '11000000-0000-0000-0000-000000000009',
      description: 'Formulated for high water levels with vibrating stain removal power',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['detergent', 'surf excel', 'powder', 'top load'],
      variants: [
        {
          sku: 'SURF-TOPLOAD-4KG',
          name: '4 kg Box',
          weight: 4,
          unit: 'kg',
          price: 749,
          stock: 30,
          image: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'SURF-TOPLOAD-2KG',
          name: '2 kg Pack',
          weight: 2,
          unit: 'kg',
          price: 399,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000025',
      name: 'Rin Advanced Detergent Bar',
      brandId: '20000000-0000-0000-0000-000000000003',
      categoryId: '11000000-0000-0000-0000-000000000002',
      description: 'Dazzling brightness on cuffs and collars with minimal scrubbing',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['soap', 'rin', 'washing bar', 'detergent bar'],
      variants: [
        {
          sku: 'RIN-BAR-250G',
          name: '250 g Single Bar',
          weight: 250,
          unit: 'g',
          price: 25,
          stock: 80,
          image: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000026',
      name: 'Vim Lemon Dishwash Bar with Scrubber',
      brandId: '20000000-0000-0000-0000-000000000004',
      categoryId: '11000000-0000-0000-0000-000000000003',
      description: 'Power of 100 lemons cuts through burnt grease quickly',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['soap', 'vim', 'dishwash', 'lemon'],
      variants: [
        {
          sku: 'VIM-BAR-300G-SCRUB',
          name: '300 g with Free Scrubber',
          weight: 300,
          unit: 'g',
          price: 32,
          stock: 120,
          image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // -------------------------------------------------------------
    // CATEGORY 10: Beverages, Tea & Coffee
    // -------------------------------------------------------------
    {
      productId: '30000000-0000-0000-0000-000000000027',
      name: 'Nescafe Classic 100% Pure Instant Coffee',
      brandId: '20000000-0000-0000-0000-000000000017',
      categoryId: '11000000-0000-0000-0000-000000000010',
      description: 'Rich dark roasted Robusta beans for a bold aromatic morning kick',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['coffee', 'nescafe', 'instant coffee', 'beverage'],
      variants: [
        {
          sku: 'NESC-COFFEE-100G',
          name: '100 g Glass Jar',
          weight: 100,
          unit: 'g',
          price: 210,
          stock: 45,
          image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // -------------------------------------------------------------
    // CATEGORY 11: Snacks, Biscuits & Instant Food
    // -------------------------------------------------------------
    {
      productId: '30000000-0000-0000-0000-000000000028',
      name: 'Maggi 2-Minute Instant Masala Noodles',
      brandId: '20000000-0000-0000-0000-000000000016',
      categoryId: '11000000-0000-0000-0000-000000000011',
      description: 'India’s favorite noodles seasoned with a blend of 10 roasted aromatic spices',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['noodles', 'maggi', 'instant food', 'snack'],
      variants: [
        {
          sku: 'MAGGI-MASALA-280G-4PK',
          name: 'Pack of 4 (280 g)',
          weight: 280,
          unit: 'g',
          price: 56,
          stock: 110,
          image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000029',
      name: 'Lay’s India’s Magic Masala Potato Chips',
      brandId: '20000000-0000-0000-0000-000000000018',
      categoryId: '11000000-0000-0000-0000-000000000011',
      description: 'Thinly sliced crispy potatoes cooked in fragrant Indian spices',
      storageType: 'ambient',
      isPerishable: false,
      tags: ['chips', 'lays', 'potato chips', 'snack'],
      variants: [
        {
          sku: 'LAYS-MASALA-90G',
          name: '90 g Bag',
          weight: 90,
          unit: 'g',
          price: 35,
          stock: 85,
          image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // -------------------------------------------------------------
    // CATEGORY 12: Fresh Fruits & Farm Vegetables
    // -------------------------------------------------------------
    {
      productId: '30000000-0000-0000-0000-000000000030',
      name: 'Fresh Farm Red Onions',
      brandId: '20000000-0000-0000-0000-000000000019',
      categoryId: '10000000-0000-0000-0000-000000000005',
      description: 'Crisp, pungent red onions sourced directly from local grower collectives',
      storageType: 'ambient',
      isPerishable: true,
      tags: ['onion', 'vegetables', 'fresh', 'farm'],
      variants: [
        {
          sku: 'ONION-RED-1KG',
          name: '1 kg Mesh Bag',
          weight: 1,
          unit: 'kg',
          price: 45,
          stock: 120,
          image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000031',
      name: 'Fresh Shimla Royal Delicious Apples',
      brandId: '20000000-0000-0000-0000-000000000019',
      categoryId: '10000000-0000-0000-0000-000000000005',
      description: 'Sweet, crisp, juicy highland red apples rich in antioxidants',
      storageType: 'chilled',
      isPerishable: true,
      tags: ['apple', 'fruits', 'shimla', 'healthy'],
      variants: [
        {
          sku: 'APPLE-SHIMLA-1KG',
          name: '1 kg Pack (Approx. 4-5 Apples)',
          weight: 1,
          unit: 'kg',
          price: 180,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
  ];

  let totalVariantsSeeded = 0;

  for (const p of catalog) {
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Try update by id or slug first
    let pRes = await pool.query(
      `UPDATE products SET
         name = $1,
         slug = $2,
         brand_id = $3,
         primary_category_id = $4,
         description = $5,
         is_perishable = $6,
         storage_type = $7,
         tags = $8,
         is_active = TRUE
       WHERE id = $9 OR slug = $2
       RETURNING id`,
      [
        p.name,
        slug,
        p.brandId,
        p.categoryId,
        p.description,
        p.isPerishable,
        p.storageType,
        p.tags,
        p.productId,
      ]
    );

    let actualProductId = pRes.rows[0]?.id;

    if (!actualProductId) {
      pRes = await pool.query(
        `INSERT INTO products (
           id, brand_id, primary_category_id, name, slug, description,
           is_perishable, storage_type, tags, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
         RETURNING id`,
        [
          p.productId,
          p.brandId,
          p.categoryId,
          p.name,
          slug,
          p.description,
          p.isPerishable,
          p.storageType,
          p.tags,
        ]
      );
      actualProductId = pRes.rows[0]?.id || p.productId;
    }

    for (const v of p.variants) {
      // Upsert variant with public image URLs
      await pool.query(
        `INSERT INTO product_variants (
           product_id, sku, variant_name, net_weight_value, measurement_unit,
           image_urls, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'active')
         ON CONFLICT (sku) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           variant_name = EXCLUDED.variant_name,
           net_weight_value = EXCLUDED.net_weight_value,
           measurement_unit = EXCLUDED.measurement_unit,
           image_urls = EXCLUDED.image_urls,
           status = 'active'`,
        [actualProductId, v.sku, v.name, v.weight, v.unit, [v.image]]
      );

      // Base Price
      await pool.query(
        `INSERT INTO base_prices (sku, amount, currency, is_active)
         VALUES ($1, $2, 'INR', TRUE)
         ON CONFLICT DO NOTHING`,
        [v.sku, v.price]
      );

      // If price was already existing, ensure it reflects current price
      await pool.query(
        `UPDATE base_prices SET amount = $2, is_active = TRUE WHERE sku = $1`,
        [v.sku, v.price]
      );

      // Stock balance
      await pool.query(
        `INSERT INTO stock_balances (sku, location_id, on_hand_qty, reserved_qty)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (location_id, sku) DO UPDATE SET
           on_hand_qty = EXCLUDED.on_hand_qty`,
        [v.sku, DEFAULT_LOCATION_ID, v.stock]
      );

      totalVariantsSeeded++;
    }
  }

  console.log(`✓ Upserted ${catalog.length} products and ${totalVariantsSeeded} variants with prices, stock & public images`);

  console.log('\n========================================================================');
  console.log('🎉 DATASET DUMP COMPLETE: All items successfully inserted into database!');
  console.log('========================================================================\n');

  await pool.end();
}

seedCompleteDataset().catch((err) => {
  console.error('❌ Database seeding failed:', err);
  process.exit(1);
});
