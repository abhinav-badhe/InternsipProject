import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { CATEGORY_DEFINITIONS, pool, DEFAULT_LOCATION_ID, esc, num, rootDir } from './catalog-data-defs.mjs';
import { BRAND_DEFINITIONS } from './catalog-brands-defs.mjs';
import { buildAllProducts } from './generate-all-catalog-items.mjs';

const DUMP_FILE_PATH = path.join(rootDir, 'database', 'dumps', 'grocery_superstore_full_catalog_dump.sql');

async function run() {
  console.log('='.repeat(75));
  console.log('🚀 SEEDING 1,100 GROCERY PRODUCTS (100 PER CATEGORY) & GENERATING SQL DUMP');
  console.log('='.repeat(75));

  const client = await pool.connect();
  let dumpSql = '';

  dumpSql += `-- ====================================================================\n`;
  dumpSql += `-- COMPLETE SUPERMARKET & OMNICHANNEL GROCERY PLATFORM SQL DUMP\n`;
  dumpSql += `-- Total Categories: 11 Departments\n`;
  dumpSql += `-- Total Products: 1,100 (100 products per category)\n`;
  dumpSql += `-- Generated at: ${new Date().toISOString()}\n`;
  dumpSql += `-- ====================================================================\n\n`;
  dumpSql += `BEGIN;\n\n`;

  try {
    // 1. Stock Location
    console.log('\n[1/5] Verifying Stock Location...');
    await client.query(
      `INSERT INTO stock_locations (id, code, name, is_active)
       VALUES ($1, 'STORE-MAIN-01', 'Downtown Omnichannel Superstore', TRUE)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [DEFAULT_LOCATION_ID]
    );
    dumpSql += `-- 1. Stock Location\n`;
    dumpSql += `INSERT INTO stock_locations (id, code, name, is_active) VALUES ('${DEFAULT_LOCATION_ID}', 'STORE-MAIN-01', 'Downtown Omnichannel Superstore', TRUE) ON CONFLICT (id) DO NOTHING;\n\n`;

    // 2. Categories
    console.log(`[2/5] Seeding ${CATEGORY_DEFINITIONS.length} Categories...`);
    dumpSql += `-- 2. Categories\n`;
    for (const cat of CATEGORY_DEFINITIONS) {
      const aliasSql = `ARRAY[${cat.aliases.map(a => esc(a)).join(', ')}]::TEXT[]`;
      await client.query(
        `INSERT INTO categories (name, slug, description, image_url, aliases, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           image_url = EXCLUDED.image_url,
           aliases = EXCLUDED.aliases`,
        [cat.name, cat.slug, cat.description, cat.image_url, cat.aliases]
      );
      dumpSql += `INSERT INTO categories (name, slug, description, image_url, aliases, is_active) VALUES (${esc(cat.name)}, ${esc(cat.slug)}, ${esc(cat.description)}, ${esc(cat.image_url)}, ${aliasSql}, TRUE) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, image_url = EXCLUDED.image_url;\n`;
    }

    const categoryIdBySlug = {};
    const allCatsRes = await client.query('SELECT id, slug FROM categories');
    for (const row of allCatsRes.rows) {
      categoryIdBySlug[row.slug] = row.id;
    }
    const defaultCatId = allCatsRes.rows[0].id;
    console.log(`  ✓ Inserted/Updated and mapped ${allCatsRes.rows.length} categories`);

    // 3. Brands
    console.log(`\n[3/5] Seeding ${BRAND_DEFINITIONS.length} Brands...`);
    dumpSql += `\n-- 3. Brands\n`;
    for (const brand of BRAND_DEFINITIONS) {
      await client.query(
        `INSERT INTO brands (name, slug, is_active)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`,
        [brand.name, brand.slug]
      );
      dumpSql += `INSERT INTO brands (name, slug, is_active) VALUES (${esc(brand.name)}, ${esc(brand.slug)}, TRUE) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;\n`;
    }

    const brandIdBySlug = {};
    const allBrandsRes = await client.query('SELECT id, slug FROM brands');
    for (const row of allBrandsRes.rows) {
      brandIdBySlug[row.slug] = row.id;
    }
    const defaultBrandId = allBrandsRes.rows[0].id;
    console.log(`  ✓ Inserted/Updated and mapped ${allBrandsRes.rows.length} brands`);

    // 4. Products & Variants (1,100 items)
    console.log('\n[4/5] Building & Bulk Seeding 1,100 Products across 11 Categories...');
    const allProducts = buildAllProducts();
    console.log(`  ✓ Generated ${allProducts.length} product items in memory.`);

    dumpSql += `\n-- 4. Products, Variants, Prices & Balances (1,100 Items)\n`;

    // Process in batches of 50 with bulk multi-row queries
    const BATCH_SIZE = 50;
    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
      const batch = allProducts.slice(i, i + BATCH_SIZE);

      const prodValues = [];
      const varValues = [];
      const priceValues = [];
      const stockValues = [];

      for (const p of batch) {
        const finalCategoryId = categoryIdBySlug[p.categorySlug] || defaultCatId;
        const finalBrandId = brandIdBySlug[p.brandSlug] || defaultBrandId;
        const uniqueSlug = `${p.slug.slice(0, 50)}-${p.sku.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

        const prodId = crypto.createHash('md5').update(`prod_${p.sku}`).digest('hex');
        const formattedProdId = `${prodId.slice(0, 8)}-${prodId.slice(8, 12)}-4${prodId.slice(13, 16)}-a${prodId.slice(17, 20)}-${prodId.slice(20, 32)}`;
        const varId = crypto.createHash('md5').update(`var_${p.sku}`).digest('hex');
        const formattedVarId = `${varId.slice(0, 8)}-${varId.slice(8, 12)}-4${varId.slice(13, 16)}-a${varId.slice(17, 20)}-${varId.slice(20, 32)}`;

        const tagsSql = `ARRAY[${p.tags.map(t => esc(t)).join(', ')}]::TEXT[]`;
        prodValues.push(`(${esc(formattedProdId)}, ${esc(finalBrandId)}, ${esc(finalCategoryId)}, ${esc(p.name)}, ${esc(uniqueSlug)}, ${esc(p.description)}, ${tagsSql}, TRUE)`);
        varValues.push(`(${esc(formattedVarId)}, ${esc(formattedProdId)}, ${esc(p.sku)}, ${esc(p.barcode)}, ${esc(p.variantName)}, ${num(p.weightValue)}, ${esc(p.measurementUnit)}, ARRAY[${esc(p.imageUrl)}]::TEXT[], 'active')`);
        priceValues.push(`(${esc(p.sku)}, 'INR', ${num(p.price)}, TRUE)`);
        stockValues.push(`('${DEFAULT_LOCATION_ID}', ${esc(p.sku)}, ${num(p.stock)}, 0)`);

        // Append to SQL dump
        dumpSql += `INSERT INTO products (id, brand_id, primary_category_id, name, slug, description, tags, is_active) VALUES (${esc(formattedProdId)}, ${esc(finalBrandId)}, ${esc(finalCategoryId)}, ${esc(p.name)}, ${esc(uniqueSlug)}, ${esc(p.description)}, ${tagsSql}, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, primary_category_id = EXCLUDED.primary_category_id;\n`;
        dumpSql += `INSERT INTO product_variants (id, product_id, sku, barcode, variant_name, net_weight_value, measurement_unit, image_urls, status) VALUES (${esc(formattedVarId)}, ${esc(formattedProdId)}, ${esc(p.sku)}, ${esc(p.barcode)}, ${esc(p.variantName)}, ${num(p.weightValue)}, ${esc(p.measurementUnit)}, ARRAY[${esc(p.imageUrl)}]::TEXT[], 'active') ON CONFLICT (sku) DO UPDATE SET image_urls = EXCLUDED.image_urls;\n`;
        dumpSql += `INSERT INTO base_prices (sku, currency, amount, is_active) VALUES (${esc(p.sku)}, 'INR', ${num(p.price)}, TRUE);\n`;
        dumpSql += `INSERT INTO stock_balances (location_id, sku, on_hand_qty, reserved_qty) VALUES ('${DEFAULT_LOCATION_ID}', ${esc(p.sku)}, ${num(p.stock)}, 0) ON CONFLICT (location_id, sku) DO UPDATE SET on_hand_qty = EXCLUDED.on_hand_qty;\n\n`;
      }

      await client.query(`
        INSERT INTO products (id, brand_id, primary_category_id, name, slug, description, tags, is_active)
        VALUES ${prodValues.join(',\n')}
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          brand_id = EXCLUDED.brand_id,
          primary_category_id = EXCLUDED.primary_category_id,
          description = EXCLUDED.description,
          tags = EXCLUDED.tags;

        INSERT INTO product_variants (id, product_id, sku, barcode, variant_name, net_weight_value, measurement_unit, image_urls, status)
        VALUES ${varValues.join(',\n')}
        ON CONFLICT (sku) DO UPDATE SET
          variant_name = EXCLUDED.variant_name,
          image_urls = EXCLUDED.image_urls,
          net_weight_value = EXCLUDED.net_weight_value;

        INSERT INTO base_prices (sku, currency, amount, is_active)
        VALUES ${priceValues.join(',\n')}
        ON CONFLICT DO NOTHING;

        INSERT INTO stock_balances (location_id, sku, on_hand_qty, reserved_qty)
        VALUES ${stockValues.join(',\n')}
        ON CONFLICT (location_id, sku) DO UPDATE SET
          on_hand_qty = EXCLUDED.on_hand_qty;
      `);

      process.stdout.write(`\r  ✓ Bulk Seeded ${Math.min(i + BATCH_SIZE, allProducts.length)} / ${allProducts.length} items`);
    }

    console.log('\n  ✓ All 1,100 items successfully saved in PostgreSQL!');

    // 5. Daily Demand History (Seeding realistic demand history for forecasting)
    console.log('\n[5/5] Generating Historical Daily SKU Demand for ML Forecasting...');
    const demandSampleSkus = allProducts.slice(0, 30).map(p => p.sku);
    const demandValues = [];
    for (const sku of demandSampleSkus) {
      for (let day = 30; day >= 0; day--) {
        const d = new Date(Date.now() - day * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const unitsSold = Math.floor(10 + Math.random() * 25);
        demandValues.push(`(${esc(sku)}, '${d}', ${unitsSold})`);
      }
    }
    await client.query(`
      INSERT INTO daily_sku_demand (sku, date, units_sold)
      VALUES ${demandValues.join(',\n')}
      ON CONFLICT (sku, date) DO UPDATE SET units_sold = EXCLUDED.units_sold;
    `);
    console.log(`  ✓ Historical demand records seeded for ML analytics tournament.`);

    dumpSql += `COMMIT;\n`;

    // Write SQL Dump to Disk
    console.log(`\nWriting full SQL dump file to: ${DUMP_FILE_PATH}`);
    fs.writeFileSync(DUMP_FILE_PATH, dumpSql, 'utf8');
    const dumpStats = fs.statSync(DUMP_FILE_PATH);
    console.log(`  ✓ SQL Dump created: ${(dumpStats.size / (1024 * 1024)).toFixed(2)} MB`);

    console.log('\n' + '='.repeat(75));
    console.log('>>> COMPLETE 1,100 PRODUCT GROCERY DATABASE SEEDED & DUMPED SUCCESSFULLY! <<<');
    console.log('='.repeat(75));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('\n✗ Error during seeding and dumping:', err);
  process.exit(1);
});
