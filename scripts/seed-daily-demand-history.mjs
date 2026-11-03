import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function seedDemandHistory() {
  console.log('Seeding 60-day daily demand history for all SKUs...');

  // 1. Fetch all active variants and their base prices
  const variantsRes = await pool.query(`
    SELECT v.sku, COALESCE(bp.amount, 50.00) as unit_price
    FROM product_variants v
    LEFT JOIN (
      SELECT DISTINCT ON (sku) sku, amount 
      FROM base_prices 
      WHERE is_active = TRUE 
      ORDER BY sku, created_at DESC
    ) bp ON v.sku = bp.sku
  `);

  const variants = variantsRes.rows;
  console.log(`Found ${variants.length} SKUs to seed.`);

  // Clear older synthetic history if any
  await pool.query('DELETE FROM daily_sku_demand');

  const today = new Date();
  let totalRows = 0;

  // Insert in batches of 500
  let batchValues = [];
  const BATCH_SIZE = 400;

  for (const variant of variants) {
    const sku = variant.sku;
    const price = Number(variant.unit_price) || 45.0;

    // Define baseline velocity based on SKU category/type
    let baseDailyMean = 6.0;
    if (sku.includes('MILK') || sku.includes('BREAD') || sku.includes('EGG')) {
      baseDailyMean = 14.0; // High frequency perishables
    } else if (sku.includes('SALT') || sku.includes('SUGAR') || sku.includes('ATTA') || sku.includes('BTR')) {
      baseDailyMean = 9.0; // Staples
    } else if (sku.includes('SOAP') || sku.includes('TOOTH') || sku.includes('SHAMP') || sku.includes('SURF')) {
      baseDailyMean = 5.0; // Personal care & cleaning
    } else {
      baseDailyMean = 4.0;
    }

    for (let dayOffset = 60; dayOffset >= 1; dayOffset--) {
      const date = new Date(today.getTime() - dayOffset * 86400000);
      const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday

      // Weekend surge (Saturday & Sunday get 35% - 50% more demand)
      const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.45 : 1.0;
      // Midweek dip (Wednesday slightly lower)
      const midweekFactor = (dayOfWeek === 3) ? 0.90 : 1.0;
      // Slight upward store growth trend (5% growth over 60 days)
      const trendFactor = 1.0 + (60 - dayOffset) * (0.05 / 60);
      // Random variance
      const noise = (Math.sin(dayOffset * 0.7) * 0.15) + ((Math.random() - 0.5) * 0.25);

      const calculatedUnits = Math.max(1, Math.round(baseDailyMean * weekendFactor * midweekFactor * trendFactor * (1.0 + noise)));
      const grossRevenue = Number((calculatedUnits * price).toFixed(2));
      const dateStr = date.toISOString().split('T')[0];

      batchValues.push({
        id: crypto.randomUUID(),
        sku,
        date: dateStr,
        units_sold: calculatedUnits,
        gross_revenue: grossRevenue,
        units_cancelled: Math.random() < 0.1 ? 1 : 0,
        stockout_minutes: 0,
      });

      if (batchValues.length >= BATCH_SIZE) {
        await insertBatch(batchValues);
        totalRows += batchValues.length;
        batchValues = [];
      }
    }
  }

  if (batchValues.length > 0) {
    await insertBatch(batchValues);
    totalRows += batchValues.length;
  }

  console.log(`Successfully seeded ${totalRows} daily demand records into daily_sku_demand!`);
  await pool.end();
}

async function insertBatch(rows) {
  const valueStrings = [];
  const params = [];
  let paramIdx = 1;

  for (const r of rows) {
    valueStrings.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, NOW())`);
    params.push(r.id, r.sku, r.date, r.units_sold, r.gross_revenue, r.units_cancelled, r.stockout_minutes);
    paramIdx += 7;
  }

  await pool.query(
    `INSERT INTO daily_sku_demand (id, sku, date, units_sold, gross_revenue, units_cancelled, stockout_minutes, created_at)
     VALUES ${valueStrings.join(', ')}`,
    params
  );
}

seedDemandHistory().catch(err => {
  console.error('Failed to seed demand history:', err);
  process.exit(1);
});

