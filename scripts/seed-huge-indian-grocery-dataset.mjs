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

const DEFAULT_LOCATION_ID = '80000000-0000-0000-0000-000000000001';

async function seedHugeIndianGroceryDataset() {
  console.log('========================================================================');
  console.log('🇮🇳 SEEDING HUGE COMPREHENSIVE INDIAN GROCERY & KIRANA CATALOG');
  console.log('========================================================================\n');

  // 1. Ensure Stock Location
  await pool.query(
    `INSERT INTO stock_locations (id, code, name, is_active)
     VALUES ($1, 'STORE-MAIN-01', 'Downtown Omnichannel Superstore', TRUE)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [DEFAULT_LOCATION_ID]
  );
  console.log('✓ Default stock location verified');

  // 2. Categories
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
      name: 'Atta, Flours & Staples',
      slug: 'staples-salt-sugar',
      description: 'Vacuum iodised salt, refined sugar, premium wheat flour (atta), maida, and besan',
      image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
      aliases: ['salt', 'sugar', 'atta', 'flour', 'rice', 'dal', 'pulses', 'staples', 'oil', 'besan', 'maida', 'suji'],
    },
    {
      id: '11000000-0000-0000-0000-000000000009',
      name: 'Laundry Powders & Detergents',
      slug: 'laundry-powders',
      description: 'Matic washing powders, enzyme stain removers, and fabric conditioners',
      image_url: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80',
      aliases: ['detergent', 'surf', 'washing powder', 'laundry', 'powder'],
    },
    {
      id: '11000000-0000-0000-0000-000000000010',
      name: 'Dals, Pulses & Grains',
      slug: 'dals-pulses',
      description: 'Unpolished protein-rich Toor dal, Moong dal, Chana dal, Urad dal, Rajma, and Kabuli Chana',
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      aliases: ['dal', 'dals', 'pulses', 'toor dal', 'moong dal', 'chana dal', 'rajma', 'chana', 'urad'],
    },
    {
      id: '11000000-0000-0000-0000-000000000011',
      name: 'Edible Oils & Pure Ghee',
      slug: 'edible-oils-ghee',
      description: 'Refined sunflower oil, kachi ghani mustard oil, healthy cooking oil, and desi cow ghee',
      image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
      aliases: ['oil', 'cooking oil', 'sunflower oil', 'mustard oil', 'ghee', 'cow ghee', 'desi ghee'],
    },
    {
      id: '11000000-0000-0000-0000-000000000012',
      name: 'Spices & Whole Masalas',
      slug: 'spices-masalas',
      description: 'Pure ground spices, haldi, mirch, dhaniya, jeera, garam masala, and blended seasonings',
      image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
      aliases: ['spices', 'masala', 'haldi', 'mirch', 'turmeric', 'chilli', 'jeera', 'cumin', 'garam masala'],
    },
    {
      id: '11000000-0000-0000-0000-000000000013',
      name: 'Rice, Poha & Breakfast Grains',
      slug: 'rice-grains',
      description: 'Royal basmati rice, rozana rice, kolam rice, thick poha, and traditional breakfast grains',
      image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
      aliases: ['rice', 'basmati rice', 'poha', 'chawal', 'flattened rice'],
    },
    {
      id: '11000000-0000-0000-0000-000000000014',
      name: 'Biscuits, Snacks & Namkeen',
      slug: 'snacks-namkeen',
      description: 'Crispy Indian namkeen, bhujia, tea-time biscuits, chocolate cookies, and potato chips',
      image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
      aliases: ['biscuits', 'cookies', 'namkeen', 'bhujia', 'chips', 'snacks', 'biscuit', 'parle g'],
    },
    {
      id: '11000000-0000-0000-0000-000000000015',
      name: 'Instant Noodles & Ready Foods',
      slug: 'instant-noodles',
      description: '2-minute instant noodles, hakka noodles, oats, and quick-cook breakfast essentials',
      image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80',
      aliases: ['maggi', 'noodles', 'instant food', 'pasta', 'oats'],
    },
    {
      id: '11000000-0000-0000-0000-000000000016',
      name: 'Tea, Coffee & Beverages',
      slug: 'tea-coffee-beverages',
      description: 'Desi masala chai leaves, rich roasted instant coffee, malt health drinks, juices, and cold drinks',
      image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
      aliases: ['tea', 'chai', 'coffee', 'cold drink', 'juice', 'bournvita', 'horlicks', 'pepsi', 'coke'],
    },
    {
      id: '11000000-0000-0000-0000-000000000017',
      name: 'Home Cleaners & Pest Repellents',
      slug: 'cleaners-repellents',
      description: 'Disinfectant toilet cleaners, surface floor cleaners, glass cleaners, and mosquito vaporizers',
      image_url: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=600&q=80',
      aliases: ['cleaner', 'harpic', 'lizol', 'colin', 'good knight', 'hit', 'repellent'],
    },
    {
      id: '11000000-0000-0000-0000-000000000018',
      name: 'Fresh Vegetables & Fruits',
      slug: 'fresh-produce',
      description: 'Daily fresh kitchen staples: farm onions, potatoes, tomatoes, ginger, garlic, apples, and bananas',
      image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
      aliases: ['vegetables', 'fruits', 'onion', 'potato', 'tomato', 'aloo', 'pyaz', 'apple', 'banana'],
    },
  ];

  for (const c of categories) {
    const existing = await pool.query(
      `SELECT id FROM categories WHERE id = $1 OR slug = $2 LIMIT 1`,
      [c.id, c.slug]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE categories
         SET name = $2, description = $3, image_url = $4, aliases = $5
         WHERE id = $1`,
        [existing.rows[0].id, c.name, c.description, c.image_url, c.aliases]
      );
    } else {
      await pool.query(
        `INSERT INTO categories (id, name, slug, description, image_url, aliases)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [c.id, c.name, c.slug, c.description, c.image_url, c.aliases]
      );
    }
  }
  console.log(`✓ Upserted ${categories.length} core Indian grocery categories`);

  // 3. Brands
  const brands = [
    { id: '20000000-0000-0000-0000-000000000001', name: 'Lux', slug: 'lux' },
    { id: '20000000-0000-0000-0000-000000000002', name: 'Dettol', slug: 'dettol' },
    { id: '20000000-0000-0000-0000-000000000003', name: 'Dove', slug: 'dove' },
    { id: '20000000-0000-0000-0000-000000000004', name: 'Pears', slug: 'pears' },
    { id: '20000000-0000-0000-0000-000000000005', name: 'Rin', slug: 'rin' },
    { id: '20000000-0000-0000-0000-000000000006', name: 'Surf Excel', slug: 'surf-excel' },
    { id: '20000000-0000-0000-0000-000000000007', name: 'Ariel', slug: 'ariel' },
    { id: '20000000-0000-0000-0000-000000000008', name: 'Tide', slug: 'tide' },
    { id: '20000000-0000-0000-0000-000000000009', name: 'Vim', slug: 'vim' },
    { id: '20000000-0000-0000-0000-000000000010', name: 'Pril', slug: 'pril' },
    { id: '20000000-0000-0000-0000-000000000011', name: 'Amul', slug: 'amul' },
    { id: '20000000-0000-0000-0000-000000000012', name: 'Mother Dairy', slug: 'mother-dairy' },
    { id: '20000000-0000-0000-0000-000000000013', name: 'Britannia', slug: 'britannia' },
    { id: '20000000-0000-0000-0000-000000000014', name: 'Aashirvaad', slug: 'aashirvaad' },
    { id: '20000000-0000-0000-0000-000000000015', name: 'Tata', slug: 'tata' },
    { id: '20000000-0000-0000-0000-000000000016', name: 'Madhur', slug: 'madhur' },
    { id: '20000000-0000-0000-0000-000000000017', name: 'Colgate', slug: 'colgate' },
    { id: '20000000-0000-0000-0000-000000000018', name: 'Hair & Care', slug: 'hair-and-care' },
    { id: '20000000-0000-0000-0000-000000000019', name: 'Head & Shoulders', slug: 'head-and-shoulders' },
    { id: '20000000-0000-0000-0000-000000000020', name: 'Fortune', slug: 'fortune' },
    { id: '20000000-0000-0000-0000-000000000021', name: 'Daawat', slug: 'daawat' },
    { id: '20000000-0000-0000-0000-000000000022', name: 'India Gate', slug: 'india-gate' },
    { id: '20000000-0000-0000-0000-000000000023', name: 'Tata Sampann', slug: 'tata-sampann' },
    { id: '20000000-0000-0000-0000-000000000024', name: 'Saffola', slug: 'saffola' },
    { id: '20000000-0000-0000-0000-000000000025', name: 'MDH', slug: 'mdh' },
    { id: '20000000-0000-0000-0000-000000000026', name: 'Everest', slug: 'everest' },
    { id: '20000000-0000-0000-0000-000000000027', name: 'Catch', slug: 'catch' },
    { id: '20000000-0000-0000-0000-000000000028', name: 'Parle', slug: 'parle' },
    { id: '20000000-0000-0000-0000-000000000029', name: 'Sunfeast', slug: 'sunfeast' },
    { id: '20000000-0000-0000-0000-000000000030', name: 'Haldirams', slug: 'haldirams' },
    { id: '20000000-0000-0000-0000-000000000031', name: 'Lays', slug: 'lays' },
    { id: '20000000-0000-0000-0000-000000000032', name: 'Kurkure', slug: 'kurkure' },
    { id: '20000000-0000-0000-0000-000000000033', name: 'Maggi', slug: 'maggi' },
    { id: '20000000-0000-0000-0000-000000000034', name: 'Yippee', slug: 'yippee' },
    { id: '20000000-0000-0000-0000-000000000035', name: 'Red Label', slug: 'red-label' },
    { id: '20000000-0000-0000-0000-000000000036', name: 'Nescafe', slug: 'nescafe' },
    { id: '20000000-0000-0000-0000-000000000037', name: 'Bournvita', slug: 'bournvita' },
    { id: '20000000-0000-0000-0000-000000000038', name: 'Real', slug: 'real' },
    { id: '20000000-0000-0000-0000-000000000039', name: 'Thums Up', slug: 'thums-up' },
    { id: '20000000-0000-0000-0000-000000000040', name: 'Bisleri', slug: 'bisleri' },
    { id: '20000000-0000-0000-0000-000000000041', name: 'Close Up', slug: 'close-up' },
    { id: '20000000-0000-0000-0000-000000000042', name: 'Clinic Plus', slug: 'clinic-plus' },
    { id: '20000000-0000-0000-0000-000000000043', name: 'Parachute', slug: 'parachute' },
    { id: '20000000-0000-0000-0000-000000000044', name: 'Harpic', slug: 'harpic' },
    { id: '20000000-0000-0000-0000-000000000045', name: 'Lizol', slug: 'lizol' },
    { id: '20000000-0000-0000-0000-000000000046', name: 'Good Knight', slug: 'good-knight' },
    { id: '20000000-0000-0000-0000-000000000047', name: 'Fresh Mandi', slug: 'fresh-mandi' },
  ];

  for (const b of brands) {
    const existing = await pool.query(
      `SELECT id FROM brands WHERE id = $1 OR slug = $2 LIMIT 1`,
      [b.id, b.slug]
    );
    if (existing.rows.length > 0) {
      await pool.query(`UPDATE brands SET name = $2 WHERE id = $1`, [existing.rows[0].id, b.name]);
    } else {
      await pool.query(
        `INSERT INTO brands (id, name, slug) VALUES ($1, $2, $3)`,
        [b.id, b.name, b.slug]
      );
    }
  }
  console.log(`✓ Upserted ${brands.length} iconic Indian grocery brands`);

  // Authoritative dynamic lookup maps for foreign keys
  const dbBrands = await pool.query('SELECT id, name, slug FROM brands');
  const brandSlugToId = new Map();
  for (const b of dbBrands.rows) {
    brandSlugToId.set(b.slug.toLowerCase(), b.id);
    brandSlugToId.set(b.name.toLowerCase(), b.id);
    brandSlugToId.set(b.id, b.id);
  }

  const dbCategories = await pool.query('SELECT id, name, slug FROM categories');
  const categorySlugToId = new Map();
  for (const c of dbCategories.rows) {
    categorySlugToId.set(c.slug.toLowerCase(), c.id);
    categorySlugToId.set(c.name.toLowerCase(), c.id);
    categorySlugToId.set(c.id, c.id);
  }

  // 4. Products & Variants Catalog
  const catalog = [
    // --- 1. USER ESSENTIAL LIST ITEMS (Preserving exact matches & IDs) ---
    {
      productId: '30000000-0000-0000-0000-000000000001',
      brandId: '20000000-0000-0000-0000-000000000001', // Lux
      categoryId: '11000000-0000-0000-0000-000000000001', // Bathing
      name: 'Lux Rose & Vitamin E Bathing Soap',
      description: 'Fragrant French Rose oil and vitamin E infused nourishing bath bar',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['soap', 'lux', 'rose', 'bath', 'skincare'],
      variants: [
        {
          sku: 'LUX-ROSE-3X100G',
          name: '100 g (Pack of 3)',
          weight: 300,
          unit: 'g',
          price: 120.0,
          stock: 0, // Intentional OOS for acceptance alternative recommendation
          image: 'https://images.unsplash.com/photo-1607006314605-726487e49ef8?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000002',
      brandId: '20000000-0000-0000-0000-000000000002', // Dettol
      categoryId: '11000000-0000-0000-0000-000000000001',
      name: 'Dettol Original Germ Protection Bathing Soap',
      description: 'Trusted antibacterial pine fragrance soap giving 99.9% germ protection',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['soap', 'dettol', 'antibacterial', 'bath', 'germ protection'],
      variants: [
        {
          sku: 'DETTOL-ORIG-75G',
          name: '75 g Single Bar',
          weight: 75,
          unit: 'g',
          price: 38.0,
          stock: 80,
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'DETTOL-ORIG-125G-P4',
          name: '125 g (Pack of 4)',
          weight: 500,
          unit: 'g',
          price: 210.0,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000003',
      brandId: '20000000-0000-0000-0000-000000000003', // Dove
      categoryId: '11000000-0000-0000-0000-000000000001',
      name: 'Dove Cream Beauty Bathing Bar',
      description: 'Contains 1/4 moisturizing cream for soft, glowing, hydrated skin',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['soap', 'dove', 'beauty bar', 'moisturizing', 'cream'],
      variants: [
        {
          sku: 'DOVE-BAR-100G',
          name: '100 g Single Bar',
          weight: 100,
          unit: 'g',
          price: 68.0,
          stock: 45,
          image: 'https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000010',
      brandId: '20000000-0000-0000-0000-000000000011', // Amul
      categoryId: '11000000-0000-0000-0000-000000000004', // Dairy
      name: 'Amul Pasteurised Butter',
      description: 'Pure cream golden salted butter, Utterly Butterly Delicious since 1956',
      isPerishable: true,
      storageType: 'chilled',
      tags: ['amul', 'butter', 'dairy', 'breakfast', 'salted butter'],
      variants: [
        {
          sku: 'AMUL-BTR-100G',
          name: '100 g Carton',
          weight: 100,
          unit: 'g',
          price: 58.0,
          stock: 60,
          image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'AMUL-BTR-500G',
          name: '500 g Carton',
          weight: 500,
          unit: 'g',
          price: 275.0,
          stock: 45,
          image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000011',
      brandId: '20000000-0000-0000-0000-000000000013', // Britannia
      categoryId: '11000000-0000-0000-0000-000000000005', // Breads
      name: 'Britannia Large Sandwich White Bread',
      description: 'Soft and thick slices crafted specially for making hearty sandwiches',
      isPerishable: true,
      storageType: 'ambient',
      tags: ['bread', 'sandwich bread', 'britannia', 'bakery', 'toast'],
      variants: [
        {
          sku: 'BRIT-BREAD-LRG-500G',
          name: 'Large 500 g Loaf',
          weight: 500,
          unit: 'g',
          price: 50.0,
          stock: 35,
          image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000012',
      brandId: '20000000-0000-0000-0000-000000000017', // Colgate
      categoryId: '11000000-0000-0000-0000-000000000006', // Oral Care
      name: 'Colgate Strong Teeth Anticavity Toothpaste',
      description: 'Calcium boost formula that strengthens enamel and prevents cavities',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['colgate', 'toothpaste', 'teeth', 'oral care', 'paste'],
      variants: [
        {
          sku: 'COLG-TOOTH-200G',
          name: '200 g Tube',
          weight: 200,
          unit: 'g',
          price: 110.0,
          stock: 75,
          image: 'https://images.unsplash.com/photo-1559591937-e10816918804?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000013',
      brandId: '20000000-0000-0000-0000-000000000018', // Hair & Care
      categoryId: '11000000-0000-0000-0000-000000000007', // Hair Care
      name: 'Hair & Care Triple Blend Nourishing Shampoo',
      description: 'Enriched with neem, tulsi, and aloe vera for deep root nourishment',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['shampoo', 'hair and care', 'hair care', 'hair', 'aloe vera'],
      variants: [
        {
          sku: 'HNC-SHAMP-200G',
          name: '200 ml Bottle',
          weight: 200,
          unit: 'ml',
          price: 155.0,
          stock: 40,
          image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000014',
      brandId: '20000000-0000-0000-0000-000000000015', // Tata
      categoryId: '11000000-0000-0000-0000-000000000008', // Staples
      name: 'Tata Salt Vacuum Evaporated Iodised Salt',
      description: 'Desh Ka Namak. Pure vacuum-evaporated salt guaranteeing iodine content',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['salt', 'tata salt', 'iodised salt', 'namak', 'cooking'],
      variants: [
        {
          sku: 'TATA-SALT-500G',
          name: '500 g Pack',
          weight: 500,
          unit: 'g',
          price: 16.0,
          stock: 90,
          image: 'https://images.unsplash.com/photo-1518110903495-cd99d1469e7e?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'TATA-SALT-1KG',
          name: '1 kg Pouch',
          weight: 1000,
          unit: 'g',
          price: 28.0,
          stock: 120,
          image: 'https://images.unsplash.com/photo-1518110903495-cd99d1469e7e?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000015',
      brandId: '20000000-0000-0000-0000-000000000016', // Madhur
      categoryId: '11000000-0000-0000-0000-000000000008', // Staples
      name: 'Madhur Pure & Hygienic Refined Sugar',
      description: 'Sulphur-free sparkling white refined crystal sugar',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['sugar', 'madhur sugar', 'cheeni', 'sweetener'],
      variants: [
        {
          sku: 'MADHUR-SUGAR-1KG',
          name: '1 kg Bag',
          weight: 1000,
          unit: 'g',
          price: 55.0,
          stock: 80,
          image: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'MADHUR-SUGAR-2KG',
          name: '2 kg Bag',
          weight: 2000,
          unit: 'g',
          price: 105.0,
          stock: 65,
          image: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000016',
      brandId: '20000000-0000-0000-0000-000000000006', // Surf Excel
      categoryId: '11000000-0000-0000-0000-000000000009', // Laundry
      name: 'Surf Excel Matic Top Load Detergent Powder',
      description: 'Formulated with advanced stain-lift enzymes for top load washing machines',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['surf excel', 'detergent', 'top load', 'washing powder', 'laundry'],
      variants: [
        {
          sku: 'SURF-TOPLOAD-1KG',
          name: '1 kg Box',
          weight: 1000,
          unit: 'g',
          price: 215.0,
          stock: 40,
          image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'SURF-TOPLOAD-4KG',
          name: '4 kg Box',
          weight: 4000,
          unit: 'g',
          price: 749.0,
          stock: 25,
          image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 2. ATTA, FLOURS & GRAINS ---
    {
      productId: '30000000-0000-0000-0000-000000000023',
      brandId: '20000000-0000-0000-0000-000000000014', // Aashirvaad
      categoryId: '11000000-0000-0000-0000-000000000008',
      name: 'Aashirvaad Superior MP Sharbati Whole Wheat Atta',
      description: '100% pure whole wheat stone-ground chakki fresh atta for soft rotis',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['atta', 'aashirvaad', 'wheat flour', 'rotis', 'staples'],
      variants: [
        {
          sku: 'AASH-ATTA-5KG',
          name: '5 kg Bag',
          weight: 5000,
          unit: 'g',
          price: 275.0,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'AASH-ATTA-10KG',
          name: '10 kg Bag',
          weight: 10000,
          unit: 'g',
          price: 520.0,
          stock: 30,
          image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000024',
      brandId: '20000000-0000-0000-0000-000000000020', // Fortune
      categoryId: '11000000-0000-0000-0000-000000000008',
      name: 'Fortune Chakki Fresh Whole Wheat Atta',
      description: 'Natural dietary fiber rich traditional chakki ground whole wheat flour',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['fortune', 'atta', 'chakki fresh', 'wheat'],
      variants: [
        {
          sku: 'FORT-ATTA-5KG',
          name: '5 kg Bag',
          weight: 5000,
          unit: 'g',
          price: 250.0,
          stock: 40,
          image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000025',
      brandId: '20000000-0000-0000-0000-000000000023', // Tata Sampann
      categoryId: '11000000-0000-0000-0000-000000000008',
      name: 'Tata Sampann Fine Pure Besan (Gram Flour)',
      description: '100% unpolished chana dal ground besan for crispy pakodas and sweets',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['besan', 'gram flour', 'tata sampann', 'pakoda'],
      variants: [
        {
          sku: 'TATA-BESAN-500G',
          name: '500 g Pack',
          weight: 500,
          unit: 'g',
          price: 65.0,
          stock: 60,
          image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 3. DALS & PULSES ---
    {
      productId: '30000000-0000-0000-0000-000000000026',
      brandId: '20000000-0000-0000-0000-000000000023', // Tata Sampann
      categoryId: '11000000-0000-0000-0000-000000000010', // Dals
      name: 'Tata Sampann Unpolished Toor Dal (Arhar Dal)',
      description: 'Naturally nutritious unpolished toor dal rich in plant protein and dietary fiber',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['toor dal', 'arhar dal', 'dal', 'pulses', 'tata sampann'],
      variants: [
        {
          sku: 'TATA-TOOR-1KG',
          name: '1 kg Pouch',
          weight: 1000,
          unit: 'g',
          price: 175.0,
          stock: 55,
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000027',
      brandId: '20000000-0000-0000-0000-000000000023', // Tata Sampann
      categoryId: '11000000-0000-0000-0000-000000000010',
      name: 'Tata Sampann Yellow Moong Dal Split',
      description: 'Quick-cooking easily digestible unpolished yellow moong lentils',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['moong dal', 'yellow dal', 'dal', 'pulses'],
      variants: [
        {
          sku: 'TATA-MOONG-1KG',
          name: '1 kg Pouch',
          weight: 1000,
          unit: 'g',
          price: 155.0,
          stock: 45,
          image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000028',
      brandId: '20000000-0000-0000-0000-000000000023', // Tata Sampann
      categoryId: '11000000-0000-0000-0000-000000000010',
      name: 'Tata Sampann Premium Chana Dal',
      description: 'Uniform golden unpolished Bengal gram dal rich in iron and protein',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['chana dal', 'bengal gram', 'dal', 'pulses'],
      variants: [
        {
          sku: 'TATA-CHANA-1KG',
          name: '1 kg Pouch',
          weight: 1000,
          unit: 'g',
          price: 110.0,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000029',
      brandId: '20000000-0000-0000-0000-000000000023',
      categoryId: '11000000-0000-0000-0000-000000000010',
      name: 'Tata Sampann Kashmiri Red Rajma',
      description: 'Authentic aromatic red kidney beans, perfect for Punjabi Rajma Chawal',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['rajma', 'kidney beans', 'chawal', 'pulses'],
      variants: [
        {
          sku: 'TATA-RAJMA-500G',
          name: '500 g Pack',
          weight: 500,
          unit: 'g',
          price: 95.0,
          stock: 40,
          image: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 4. RICE & POHA ---
    {
      productId: '30000000-0000-0000-0000-000000000030',
      brandId: '20000000-0000-0000-0000-000000000021', // Daawat
      categoryId: '11000000-0000-0000-0000-000000000013', // Rice
      name: 'Daawat Rozana Super Basmati Rice',
      description: 'Long slender aromatic aged grains perfect for daily biryanis and pulao',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['rice', 'basmati', 'daawat', 'rozana', 'chawal'],
      variants: [
        {
          sku: 'DAAWAT-ROZ-5KG',
          name: '5 kg Bag',
          weight: 5000,
          unit: 'g',
          price: 399.0,
          stock: 45,
          image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000031',
      brandId: '20000000-0000-0000-0000-000000000022', // India Gate
      categoryId: '11000000-0000-0000-0000-000000000013',
      name: 'India Gate Classic Aged Basmati Rice',
      description: 'Extra-long pearlescent basmati grains with royal aroma for special occasions',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['india gate', 'basmati rice', 'classic', 'aged rice'],
      variants: [
        {
          sku: 'IND-GATE-CLASSIC-1KG',
          name: '1 kg Pouch',
          weight: 1000,
          unit: 'g',
          price: 185.0,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000032',
      brandId: '20000000-0000-0000-0000-000000000023', // Tata Sampann
      categoryId: '11000000-0000-0000-0000-000000000013',
      name: 'Tata Sampann Thick High-Fiber White Poha',
      description: 'Crisp flattened rice made from indigenous paddy, ideal for kanda poha',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['poha', 'flattened rice', 'tata sampann', 'breakfast'],
      variants: [
        {
          sku: 'TATA-POHA-500G',
          name: '500 g Pack',
          weight: 500,
          unit: 'g',
          price: 45.0,
          stock: 65,
          image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 5. COOKING OILS & GHEE ---
    {
      productId: '30000000-0000-0000-0000-000000000033',
      brandId: '20000000-0000-0000-0000-000000000020', // Fortune
      categoryId: '11000000-0000-0000-0000-000000000011', // Oils
      name: 'Fortune Sunlite Refined Sunflower Oil',
      description: 'Enriched with Vitamin A and D, light and heart-healthy cooking oil',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['oil', 'sunflower oil', 'fortune', 'cooking oil'],
      variants: [
        {
          sku: 'FORT-SUN-1L',
          name: '1 L Pouch',
          weight: 910,
          unit: 'g',
          price: 135.0,
          stock: 70,
          image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000034',
      brandId: '20000000-0000-0000-0000-000000000020', // Fortune
      categoryId: '11000000-0000-0000-0000-000000000011',
      name: 'Fortune Kachi Ghani Pure Mustard Oil (Sarson Tel)',
      description: 'Cold pressed strong pungent mustard oil for authentic North & East Indian flavours',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['mustard oil', 'sarson ka tel', 'kachi ghani', 'fortune'],
      variants: [
        {
          sku: 'FORT-MUST-1L',
          name: '1 L Bottle',
          weight: 910,
          unit: 'g',
          price: 155.0,
          stock: 55,
          image: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000035',
      brandId: '20000000-0000-0000-0000-000000000024', // Saffola
      categoryId: '11000000-0000-0000-0000-000000000011',
      name: 'Saffola Gold Pro Healthy Heart Blended Oil',
      description: 'Dual-seed blend of rice bran and sunflower oil with natural antioxidants',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['saffola', 'oil', 'healthy heart', 'cooking oil'],
      variants: [
        {
          sku: 'SAFF-GOLD-1L',
          name: '1 L Pouch',
          weight: 910,
          unit: 'g',
          price: 165.0,
          stock: 45,
          image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000036',
      brandId: '20000000-0000-0000-0000-000000000011', // Amul
      categoryId: '11000000-0000-0000-0000-000000000011',
      name: 'Amul Pure Cow Ghee (Danedar)',
      description: 'Traditional golden granulated cow ghee made from fresh cream with rich aroma',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['amul', 'ghee', 'cow ghee', 'desi ghee', 'pure ghee'],
      variants: [
        {
          sku: 'AMUL-GHEE-500ML',
          name: '500 ml Tin',
          weight: 450,
          unit: 'g',
          price: 315.0,
          stock: 40,
          image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'AMUL-GHEE-1L',
          name: '1 L Carton',
          weight: 900,
          unit: 'g',
          price: 610.0,
          stock: 30,
          image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 6. SPICES & BLENDED MASALAS ---
    {
      productId: '30000000-0000-0000-0000-000000000037',
      brandId: '20000000-0000-0000-0000-000000000025', // MDH
      categoryId: '11000000-0000-0000-0000-000000000012', // Spices
      name: 'MDH Deggi Mirch Natural Kashmiri Red Chilli Powder',
      description: 'Famous blend of selected red chillies imparting glowing red colour and mild heat',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['deggi mirch', 'mdh', 'mirch', 'red chilli', 'spices'],
      variants: [
        {
          sku: 'MDH-DEGGI-100G',
          name: '100 g Carton',
          weight: 100,
          unit: 'g',
          price: 92.0,
          stock: 80,
          image: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000038',
      brandId: '20000000-0000-0000-0000-000000000025', // MDH
      categoryId: '11000000-0000-0000-0000-000000000012',
      name: 'MDH Garam Masala Blend',
      description: 'Asli Masale Sach Sach MDH. Aromatic blend of cardamom, clove, cinnamon, and pepper',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['garam masala', 'mdh', 'masala', 'spices'],
      variants: [
        {
          sku: 'MDH-GARAM-100G',
          name: '100 g Carton',
          weight: 100,
          unit: 'g',
          price: 98.0,
          stock: 70,
          image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000039',
      brandId: '20000000-0000-0000-0000-000000000026', // Everest
      categoryId: '11000000-0000-0000-0000-000000000012',
      name: 'Everest Pure Turmeric (Haldi) Powder',
      description: 'Bright golden organic Salem turmeric with high natural curcumin',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['turmeric', 'haldi', 'everest', 'curcumin', 'spices'],
      variants: [
        {
          sku: 'EVR-HALDI-200G',
          name: '200 g Carton',
          weight: 200,
          unit: 'g',
          price: 64.0,
          stock: 90,
          image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000040',
      brandId: '20000000-0000-0000-0000-000000000027', // Catch
      categoryId: '11000000-0000-0000-0000-000000000012',
      name: 'Catch Whole Cumin Seeds (Jeera)',
      description: 'Sortex cleaned intensely aromatic whole cumin seeds for tempering',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['jeera', 'cumin seeds', 'catch', 'tadka', 'spices'],
      variants: [
        {
          sku: 'CATCH-JEERA-100G',
          name: '100 g Pouch',
          weight: 100,
          unit: 'g',
          price: 68.0,
          stock: 75,
          image: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 7. DAIRY & MILK PRODUCTS ---
    {
      productId: '30000000-0000-0000-0000-000000000041',
      brandId: '20000000-0000-0000-0000-000000000011', // Amul
      categoryId: '11000000-0000-0000-0000-000000000004', // Dairy
      name: 'Amul Taaza Homogenised Toned Milk',
      description: 'Fresh toned milk with 3.0% fat, no preservatives, micro-filtered and pasteurised',
      isPerishable: true,
      storageType: 'chilled',
      tags: ['milk', 'amul', 'toned milk', 'dairy', 'doodh'],
      variants: [
        {
          sku: 'AMUL-TAAZA-1L',
          name: '1 L Tetra Pak',
          weight: 1000,
          unit: 'ml',
          price: 74.0,
          stock: 60,
          image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000042',
      brandId: '20000000-0000-0000-0000-000000000011', // Amul
      categoryId: '11000000-0000-0000-0000-000000000004',
      name: 'Amul Fresh Malai Paneer',
      description: 'Soft, melt-in-the-mouth cottage cheese blocks made from wholesome milk',
      isPerishable: true,
      storageType: 'chilled',
      tags: ['paneer', 'cottage cheese', 'amul', 'malai paneer'],
      variants: [
        {
          sku: 'AMUL-PANEER-200G',
          name: '200 g Pack',
          weight: 200,
          unit: 'g',
          price: 95.0,
          stock: 40,
          image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000043',
      brandId: '20000000-0000-0000-0000-000000000012', // Mother Dairy
      categoryId: '11000000-0000-0000-0000-000000000004',
      name: 'Mother Dairy Classic Thick Set Curd (Dahi)',
      description: 'Creamy thick traditional set curd full of active probiotic cultures',
      isPerishable: true,
      storageType: 'chilled',
      tags: ['dahi', 'curd', 'yogurt', 'mother dairy'],
      variants: [
        {
          sku: 'MD-DAHI-400G',
          name: '400 g Tub',
          weight: 400,
          unit: 'g',
          price: 40.0,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000044',
      brandId: '20000000-0000-0000-0000-000000000013', // Britannia
      categoryId: '11000000-0000-0000-0000-000000000004',
      name: 'Britannia Processed Cheese Slices',
      description: 'Individually wrapped creamy cheddar cheese slices for quick toast and burgers',
      isPerishable: true,
      storageType: 'chilled',
      tags: ['cheese', 'cheese slice', 'britannia', 'cheddar'],
      variants: [
        {
          sku: 'BRIT-CHZ-200G',
          name: '200 g (10 Slices)',
          weight: 200,
          unit: 'g',
          price: 150.0,
          stock: 35,
          image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000045',
      brandId: '20000000-0000-0000-0000-000000000047', // Fresh Mandi
      categoryId: '11000000-0000-0000-0000-000000000004',
      name: 'Farm Fresh White Table Eggs',
      description: 'Hygienically sorted and packed farm fresh graded protein eggs',
      isPerishable: true,
      storageType: 'ambient',
      tags: ['eggs', 'anda', 'breakfast', 'protein'],
      variants: [
        {
          sku: 'FARM-EGGS-6PCS',
          name: 'Pack of 6 Eggs',
          weight: 350,
          unit: 'g',
          price: 48.0,
          stock: 70,
          image: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'FARM-EGGS-12PCS',
          name: 'Pack of 12 Eggs',
          weight: 700,
          unit: 'g',
          price: 92.0,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 8. BISCUITS, SNACKS & NAMKEEN ---
    {
      productId: '30000000-0000-0000-0000-000000000046',
      brandId: '20000000-0000-0000-0000-000000000028', // Parle
      categoryId: '11000000-0000-0000-0000-000000000014', // Snacks
      name: 'Parle-G Original Glucose Biscuits',
      description: 'Indias favorite gold standard tea-time energy glucose biscuit',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['parle-g', 'biscuit', 'chai', 'glucose'],
      variants: [
        {
          sku: 'PARLE-G-250G',
          name: '250 g Pack',
          weight: 250,
          unit: 'g',
          price: 25.0,
          stock: 120,
          image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000047',
      brandId: '20000000-0000-0000-0000-000000000013', // Britannia
      categoryId: '11000000-0000-0000-0000-000000000014',
      name: 'Britannia Good Day Butter Cookies',
      description: 'Rich buttery taste sprinkled with delightful crunchy cashews and smiles',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['good day', 'butter cookie', 'britannia', 'biscuits'],
      variants: [
        {
          sku: 'GOOD-DAY-200G',
          name: '200 g Pack',
          weight: 200,
          unit: 'g',
          price: 45.0,
          stock: 95,
          image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000048',
      brandId: '20000000-0000-0000-0000-000000000030', // Haldirams
      categoryId: '11000000-0000-0000-0000-000000000014',
      name: 'Haldirams Classic Bikaneri Bhujia Sev',
      description: 'Crispy moth bean & gram flour noodles spiced with black pepper and cardamom',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['bhujia', 'namkeen', 'haldirams', 'sev', 'snacks'],
      variants: [
        {
          sku: 'HALD-BHUJIA-400G',
          name: '400 g Pouch',
          weight: 400,
          unit: 'g',
          price: 110.0,
          stock: 80,
          image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000049',
      brandId: '20000000-0000-0000-0000-000000000031', // Lays
      categoryId: '11000000-0000-0000-0000-000000000014',
      name: 'Lays Indias Magic Masala Potato Chips',
      description: 'Crunchy ridged potato chips coated in fiery North Indian street masalas',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['chips', 'lays', 'magic masala', 'potato chips'],
      variants: [
        {
          sku: 'LAYS-MAGIC-50G',
          name: '50 g Pouch',
          weight: 50,
          unit: 'g',
          price: 20.0,
          stock: 110,
          image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000050',
      brandId: '20000000-0000-0000-0000-000000000032', // Kurkure
      categoryId: '11000000-0000-0000-0000-000000000014',
      name: 'Kurkure Masala Munch Crispy Snack',
      description: 'Tedha hai par mera hai! Crispy corn puffs bursting with tangy chatpata spices',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['kurkure', 'namkeen', 'masala munch', 'puffs'],
      variants: [
        {
          sku: 'KURKURE-MUNCH-85G',
          name: '85 g Pouch',
          weight: 85,
          unit: 'g',
          price: 20.0,
          stock: 100,
          image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 9. INSTANT NOODLES ---
    {
      productId: '30000000-0000-0000-0000-000000000051',
      brandId: '20000000-0000-0000-0000-000000000033', // Maggi
      categoryId: '11000000-0000-0000-0000-000000000015', // Instant Food
      name: 'Maggi 2-Minute Masala Instant Noodles',
      description: 'Indias most cherished instant noodles with the iconic blend of 10 roasted spices',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['maggi', 'noodles', 'instant noodles', '2 minute noodles'],
      variants: [
        {
          sku: 'MAGGI-MASALA-70G',
          name: '70 g Single Pack',
          weight: 70,
          unit: 'g',
          price: 14.0,
          stock: 150,
          image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'MAGGI-MASALA-4PACK',
          name: '280 g (Pack of 4)',
          weight: 280,
          unit: 'g',
          price: 56.0,
          stock: 90,
          image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000052',
      brandId: '20000000-0000-0000-0000-000000000034', // Yippee
      categoryId: '11000000-0000-0000-0000-000000000015',
      name: 'Sunfeast Yippee Magic Masala Noodles',
      description: 'Non-sticky round block noodles that do not lump, loaded with veggies and spice',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['yippee', 'noodles', 'magic masala', 'sunfeast'],
      variants: [
        {
          sku: 'YIPPEE-MAGIC-260G',
          name: '260 g (Pack of 4)',
          weight: 260,
          unit: 'g',
          price: 52.0,
          stock: 75,
          image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 10. TEA, COFFEE & BEVERAGES ---
    {
      productId: '30000000-0000-0000-0000-000000000053',
      brandId: '20000000-0000-0000-0000-000000000015', // Tata
      categoryId: '11000000-0000-0000-0000-000000000016', // Beverages
      name: 'Tata Tea Premium Desh Ki Chai',
      description: 'Blend of badi patti for delicious aroma and choti patti for rich strong color',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['tea', 'chai', 'tata tea', 'chai patti'],
      variants: [
        {
          sku: 'TATA-TEA-PREM-500G',
          name: '500 g Pouch',
          weight: 500,
          unit: 'g',
          price: 260.0,
          stock: 65,
          image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000054',
      brandId: '20000000-0000-0000-0000-000000000035', // Red Label
      categoryId: '11000000-0000-0000-0000-000000000016',
      name: 'Brooke Bond Red Label Natural Care Tea',
      description: 'Infused with 5 Ayurvedic ingredients: Tulsi, Ashwagandha, Mulethi, Ginger & Cardamom',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['red label', 'tea', 'natural care', 'ayurvedic tea'],
      variants: [
        {
          sku: 'RED-LABEL-500G',
          name: '500 g Carton',
          weight: 500,
          unit: 'g',
          price: 295.0,
          stock: 55,
          image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000055',
      brandId: '20000000-0000-0000-0000-000000000036', // Nescafe
      categoryId: '11000000-0000-0000-0000-000000000016',
      name: 'Nescafe Classic 100% Pure Instant Coffee',
      description: 'Slow-roasted Robusta and Arabica beans delivering bold invigorating aroma',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['coffee', 'nescafe', 'instant coffee', 'nescafe classic'],
      variants: [
        {
          sku: 'NESCAFE-CLASSIC-50G',
          name: '50 g Glass Jar',
          weight: 50,
          unit: 'g',
          price: 195.0,
          stock: 60,
          image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000056',
      brandId: '20000000-0000-0000-0000-000000000037', // Bournvita
      categoryId: '11000000-0000-0000-0000-000000000016',
      name: 'Cadbury Bournvita Nutrition Chocolate Health Drink',
      description: 'Rich chocolate malt powder packed with Vitamin D, iron, and active minerals',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['bournvita', 'health drink', 'malt', 'chocolate milk'],
      variants: [
        {
          sku: 'BOURNVITA-500G',
          name: '500 g Refill Pouch',
          weight: 500,
          unit: 'g',
          price: 245.0,
          stock: 40,
          image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000057',
      brandId: '20000000-0000-0000-0000-000000000039', // Thums Up
      categoryId: '11000000-0000-0000-0000-000000000016',
      name: 'Thums Up Charged Carbonated Soft Drink',
      description: 'Taste the Thunder! Strong fizz and intense cola flavor with spicy notes',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['thums up', 'cold drink', 'cola', 'soda'],
      variants: [
        {
          sku: 'THUMS-UP-750ML',
          name: '750 ml Bottle',
          weight: 750,
          unit: 'ml',
          price: 45.0,
          stock: 80,
          image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000058',
      brandId: '20000000-0000-0000-0000-000000000040', // Bisleri
      categoryId: '11000000-0000-0000-0000-000000000016',
      name: 'Bisleri Purified Packaged Mineral Water',
      description: '10-stage purified mineral water with essential minerals and ozonation',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['water', 'bisleri', 'mineral water', 'paani'],
      variants: [
        {
          sku: 'BISLERI-1L',
          name: '1 L Bottle',
          weight: 1000,
          unit: 'ml',
          price: 20.0,
          stock: 120,
          image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
        },
        {
          sku: 'BISLERI-5L',
          name: '5 L Jar',
          weight: 5000,
          unit: 'ml',
          price: 70.0,
          stock: 40,
          image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 11. PERSONAL CARE, HAIR & HYGIENE ---
    {
      productId: '30000000-0000-0000-0000-000000000059',
      brandId: '20000000-0000-0000-0000-000000000041', // Close Up
      categoryId: '11000000-0000-0000-0000-000000000006', // Oral Care
      name: 'Close Up Everfresh Red Hot Gel Toothpaste',
      description: 'Antibacterial zinc mouthwash infused red gel for 12 hours of fresh breath',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['close up', 'red hot', 'gel', 'toothpaste', 'fresh breath'],
      variants: [
        {
          sku: 'CLOSEUP-RED-150G',
          name: '150 g Tube',
          weight: 150,
          unit: 'g',
          price: 95.0,
          stock: 65,
          image: 'https://images.unsplash.com/photo-1559591937-e129188d4474?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000060',
      brandId: '20000000-0000-0000-0000-000000000042', // Clinic Plus
      categoryId: '11000000-0000-0000-0000-000000000007', // Hair Care
      name: 'Clinic Plus Strong & Long Health Shampoo',
      description: 'Infused with milk protein formula to strengthen hair from root to tip',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['clinic plus', 'shampoo', 'hair', 'strong and long'],
      variants: [
        {
          sku: 'CLINIC-PLUS-340ML',
          name: '340 ml Bottle',
          weight: 340,
          unit: 'ml',
          price: 180.0,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000061',
      brandId: '20000000-0000-0000-0000-000000000043', // Parachute
      categoryId: '11000000-0000-0000-0000-000000000007',
      name: 'Parachute 100% Pure Coconut Hair Oil',
      description: 'Extracted from sun-dried copra coconuts, untouched by hands, edible pure oil',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['parachute', 'coconut oil', 'hair oil', 'nariyal tel'],
      variants: [
        {
          sku: 'PARA-COCO-250ML',
          name: '250 ml Bottle',
          weight: 230,
          unit: 'g',
          price: 110.0,
          stock: 75,
          image: 'https://images.unsplash.com/photo-1608248597359-bb5e8e89f665?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000062',
      brandId: '20000000-0000-0000-0000-000000000002', // Dettol
      categoryId: '11000000-0000-0000-0000-000000000001',
      name: 'Dettol Disinfectant Antiseptic Liquid',
      description: 'Multipurpose antiseptic disinfectant for first aid, medical hygiene, and personal bathing',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['dettol', 'antiseptic', 'disinfectant', 'hygiene'],
      variants: [
        {
          sku: 'DETTOL-LIQ-250ML',
          name: '250 ml Bottle',
          weight: 250,
          unit: 'ml',
          price: 145.0,
          stock: 60,
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 12. CLEANERS, LAUNDRY & PEST CONTROL ---
    {
      productId: '30000000-0000-0000-0000-000000000063',
      brandId: '20000000-0000-0000-0000-000000000005', // Rin
      categoryId: '11000000-0000-0000-0000-000000000002', // Washing soaps
      name: 'Rin Advanced Detergent Washing Soap Bar',
      description: 'Equipped with Bright Clean technology to keep white clothes dazzling bright',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['rin', 'detergent bar', 'washing soap', 'clothes soap'],
      variants: [
        {
          sku: 'RIN-BAR-250G',
          name: '250 g Bar',
          weight: 250,
          unit: 'g',
          price: 24.0,
          stock: 120,
          image: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000064',
      brandId: '20000000-0000-0000-0000-000000000009', // Vim
      categoryId: '11000000-0000-0000-0000-000000000003', // Dishwashing
      name: 'Vim Lemon Dishwash Liquid Gel',
      description: 'Power of 100 lemons. Fast-dissolving concentrated degreaser for utensils',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['vim', 'dishwash', 'gel', 'lemon', 'utensil cleaner'],
      variants: [
        {
          sku: 'VIM-GEL-500ML',
          name: '500 ml Bottle',
          weight: 500,
          unit: 'ml',
          price: 115.0,
          stock: 70,
          image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000065',
      brandId: '20000000-0000-0000-0000-000000000044', // Harpic
      categoryId: '11000000-0000-0000-0000-000000000017', // Home Cleaners
      name: 'Harpic Power Plus 10x Disinfectant Toilet Cleaner',
      description: 'Thick blue liquid formula that eliminates 99.9% of germs and removes stubborn limescale',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['harpic', 'toilet cleaner', 'disinfectant', 'bathroom'],
      variants: [
        {
          sku: 'HARPIC-BLUE-1L',
          name: '1 L Bottle',
          weight: 1000,
          unit: 'ml',
          price: 199.0,
          stock: 60,
          image: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000066',
      brandId: '20000000-0000-0000-0000-000000000045', // Lizol
      categoryId: '11000000-0000-0000-0000-000000000017',
      name: 'Lizol Disinfectant Surface Floor Cleaner (Citrus)',
      description: 'Kills 99.9% germs, removes grease stains and leaves 3x better fragrance',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['lizol', 'floor cleaner', 'surface cleaner', 'citrus'],
      variants: [
        {
          sku: 'LIZOL-CITRUS-1L',
          name: '1 L Bottle',
          weight: 1000,
          unit: 'ml',
          price: 215.0,
          stock: 55,
          image: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000067',
      brandId: '20000000-0000-0000-0000-000000000046', // Good Knight
      categoryId: '11000000-0000-0000-0000-000000000017',
      name: 'Good Knight Gold Flash Liquid Vaporizer Mosquito Refill',
      description: 'Advanced dual-mode release technology providing instant mosquito knockdown',
      isPerishable: false,
      storageType: 'ambient',
      tags: ['good knight', 'mosquito repellent', 'liquid refill', 'pest control'],
      variants: [
        {
          sku: 'GK-FLASH-45ML',
          name: '45 ml Refill Bottle',
          weight: 45,
          unit: 'ml',
          price: 85.0,
          stock: 90,
          image: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },

    // --- 13. FRESH FRUITS & VEGETABLES (KIRANA PRODUCE) ---
    {
      productId: '30000000-0000-0000-0000-000000000068',
      brandId: '20000000-0000-0000-0000-000000000047', // Fresh Mandi
      categoryId: '11000000-0000-0000-0000-000000000018', // Fresh Produce
      name: 'Fresh Red Onions (Nashik Pyaz)',
      description: 'Crisp pungent medium-sized farm harvested Nashik red onions',
      isPerishable: true,
      storageType: 'ambient',
      tags: ['onion', 'pyaz', 'vegetables', 'fresh mandi', 'cooking'],
      variants: [
        {
          sku: 'VEG-ONION-1KG',
          name: '1 kg Net Bag',
          weight: 1000,
          unit: 'g',
          price: 35.0,
          stock: 120,
          image: 'https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000069',
      brandId: '20000000-0000-0000-0000-000000000047',
      categoryId: '11000000-0000-0000-0000-000000000018',
      name: 'Fresh Golden Table Potatoes (Aloo)',
      description: 'Fresh earthy Agra golden potatoes, ideal for roasting, curries, and parathas',
      isPerishable: true,
      storageType: 'ambient',
      tags: ['potato', 'aloo', 'vegetables', 'fresh produce'],
      variants: [
        {
          sku: 'VEG-POTATO-1KG',
          name: '1 kg Net Bag',
          weight: 1000,
          unit: 'g',
          price: 30.0,
          stock: 150,
          image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000070',
      brandId: '20000000-0000-0000-0000-000000000047',
      categoryId: '11000000-0000-0000-0000-000000000018',
      name: 'Fresh Vine Ripe Hybrid Tomatoes (Tamatar)',
      description: 'Firm and juicy sun-ripened red tomatoes for flavorful curries and salads',
      isPerishable: true,
      storageType: 'ambient',
      tags: ['tomato', 'tamatar', 'vegetables', 'fresh'],
      variants: [
        {
          sku: 'VEG-TOMATO-1KG',
          name: '1 kg Pack',
          weight: 1000,
          unit: 'g',
          price: 40.0,
          stock: 90,
          image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000071',
      brandId: '20000000-0000-0000-0000-000000000047',
      categoryId: '11000000-0000-0000-0000-000000000018',
      name: 'Fresh Himachal Shimla Apples (Royal Delicious)',
      description: 'Crisp sweet handpicked red apples grown in high-altitude orchards',
      isPerishable: true,
      storageType: 'ambient',
      tags: ['apple', 'fruits', 'shimla apple', 'seb'],
      variants: [
        {
          sku: 'FRT-APPLE-1KG',
          name: '1 kg Box (Approx 4-5 pcs)',
          weight: 1000,
          unit: 'g',
          price: 180.0,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000072',
      brandId: '20000000-0000-0000-0000-000000000047',
      categoryId: '11000000-0000-0000-0000-000000000018',
      name: 'Fresh Robusta Golden Bananas (Kela)',
      description: 'Naturally ripened nutrient-dense potassium rich golden yellow bananas',
      isPerishable: true,
      storageType: 'ambient',
      tags: ['banana', 'kela', 'fruits', 'fresh produce'],
      variants: [
        {
          sku: 'FRT-BANANA-1DOZ',
          name: '1 Dozen (12 pcs)',
          weight: 1200,
          unit: 'g',
          price: 65.0,
          stock: 60,
          image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
  ];

  let totalVariantsSeeded = 0;

  for (const p of catalog) {
    const slug = p.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    // Check if product exists by slug (canonical unique key)
    const existingP = await pool.query(
      `SELECT id FROM products WHERE slug = $1 LIMIT 1`,
      [slug]
    );

    let actualProductId = p.productId;

    const brandObj = brands.find((b) => b.id === p.brandId);
    const resolvedBrandId =
      (brandObj && (brandSlugToId.get(brandObj.slug) || brandSlugToId.get(brandObj.name.toLowerCase()))) ||
      brandSlugToId.get(p.brandId) ||
      p.brandId;

    const catObj = categories.find((c) => c.id === p.categoryId);
    const resolvedCategoryId =
      (catObj && (categorySlugToId.get(catObj.slug) || categorySlugToId.get(catObj.name.toLowerCase()))) ||
      categorySlugToId.get(p.categoryId) ||
      p.categoryId;

    if (existingP.rows.length > 0) {
      actualProductId = existingP.rows[0].id;
      await pool.query(
        `UPDATE products SET
           brand_id = $2,
           primary_category_id = $3,
           name = $4,
           description = $5,
           is_perishable = $6,
           storage_type = $7,
           tags = $8
         WHERE id = $1`,
        [
          actualProductId,
          resolvedBrandId,
          resolvedCategoryId,
          p.name,
          p.description,
          p.isPerishable,
          p.storageType,
          p.tags,
        ]
      );
    } else {
      const pRes = await pool.query(
        `INSERT INTO products (
           id, brand_id, primary_category_id, name, slug, description,
           is_perishable, storage_type, tags, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
         RETURNING id`,
        [
          p.productId,
          resolvedBrandId,
          resolvedCategoryId,
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

      // Ensure price is up-to-date
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

  console.log(`✓ Upserted ${catalog.length} products and ${totalVariantsSeeded} variants with prices, stock & realistic images`);

  console.log('\n========================================================================');
  console.log('🎉 HUGE INDIAN GROCERY DATABASE SUCCESSFULLY DUMPED & READY!');
  console.log('========================================================================\n');

  await pool.end();
}

seedHugeIndianGroceryDataset().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
