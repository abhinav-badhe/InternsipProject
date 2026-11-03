import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  console.log('Ensuring all 8 user products have complete variants, prices, and inventory...');

  const variantsToEnsure = [
    // 1. Amul Butter
    {
      productName: 'Amul Pasteurised Butter',
      brand: 'Amul',
      sku: 'AMUL-BTR-100G',
      variantName: '100 g Carton',
      weight: 100,
      unit: 'g',
      price: 58.0,
      stock: 60
    },
    {
      productName: 'Amul Pasteurised Butter',
      brand: 'Amul',
      sku: 'AMUL-BTR-500G',
      variantName: '500 g Carton',
      weight: 500,
      unit: 'g',
      price: 275.0,
      stock: 45
    },

    // 2. Lux Rose Soap
    {
      productName: 'Lux Rose & Vitamin E Bathing Soap',
      brand: 'Lux',
      sku: 'LUX-ROSE-100G',
      variantName: '100 g Single Bar',
      weight: 100,
      unit: 'g',
      price: 35.0,
      stock: 50
    },
    {
      productName: 'Lux Rose & Vitamin E Bathing Soap',
      brand: 'Lux',
      sku: 'LUX-ROSE-100G-3PK',
      variantName: '100 g (Pack of 3)',
      weight: 300,
      unit: 'g',
      price: 99.0,
      stock: 0 // Out of stock to test alternative suggestion
    },

    // 3. Bread
    {
      productName: 'Britannia Large Sandwich White Bread',
      brand: 'Britannia',
      sku: 'BRIT-BREAD-REG-400G',
      variantName: '400 g Regular Loaf',
      weight: 400,
      unit: 'g',
      price: 35.0,
      stock: 50
    },
    {
      productName: 'Britannia Large Sandwich White Bread',
      brand: 'Britannia',
      sku: 'BRIT-BREAD-LRG-500G',
      variantName: 'Large 500 g Loaf',
      weight: 500,
      unit: 'g',
      price: 50.0,
      stock: 35
    },

    // 4. Colgate Toothpaste
    {
      productName: 'Colgate Strong Teeth Anticavity Toothpaste',
      brand: 'Colgate',
      sku: 'COLG-TOOTH-100G',
      variantName: '100 g Tube',
      weight: 100,
      unit: 'g',
      price: 65.0,
      stock: 90
    },
    {
      productName: 'Colgate Strong Teeth Anticavity Toothpaste',
      brand: 'Colgate',
      sku: 'COLG-TOOTH-200G',
      variantName: '200 g Tube',
      weight: 200,
      unit: 'g',
      price: 110.0,
      stock: 75
    },

    // 5. Hair & Care
    {
      productName: 'Hair & Care Triple Blend Nourishing Shampoo',
      brand: 'Hair & Care',
      sku: 'HNC-SHAMP-100G',
      variantName: '100 ml Bottle',
      weight: 100,
      unit: 'ml',
      price: 85.0,
      stock: 50
    },
    {
      productName: 'Hair & Care Triple Blend Nourishing Shampoo',
      brand: 'Hair & Care',
      sku: 'HNC-SHAMP-200G',
      variantName: '200 ml Bottle',
      weight: 200,
      unit: 'ml',
      price: 155.0,
      stock: 40
    },

    // 6. Tata Salt
    {
      productName: 'Tata Salt Vacuum Evaporated Iodised Salt',
      brand: 'Tata',
      sku: 'TATA-SALT-500G',
      variantName: '500 g Pack',
      weight: 500,
      unit: 'g',
      price: 16.0,
      stock: 90
    },
    {
      productName: 'Tata Salt Vacuum Evaporated Iodised Salt',
      brand: 'Tata',
      sku: 'TATA-SALT-1KG',
      variantName: '1 kg Pouch',
      weight: 1,
      unit: 'kg',
      price: 28.0,
      stock: 120
    },

    // 7. Sugar
    {
      productName: 'Madhur Pure & Hygienic Refined Sugar',
      brand: 'Madhur',
      sku: 'MADHUR-SUGAR-1KG',
      variantName: '1 kg Bag',
      weight: 1,
      unit: 'kg',
      price: 55.0,
      stock: 80
    },
    {
      productName: 'Madhur Pure & Hygienic Refined Sugar',
      brand: 'Madhur',
      sku: 'MADHUR-SUGAR-2KG',
      variantName: '2 kg Bag',
      weight: 2,
      unit: 'kg',
      price: 105.0,
      stock: 65
    },
    {
      productName: 'Madhur Pure & Hygienic Refined Sugar',
      brand: 'Madhur',
      sku: 'MADHUR-SUGAR-5KG',
      variantName: '5 kg Bag',
      weight: 5,
      unit: 'kg',
      price: 255.0,
      stock: 30
    },

    // 8. Surf Excel
    {
      productName: 'Surf Excel Matic Top Load Detergent Powder',
      brand: 'Surf Excel',
      sku: 'SURF-TOPLOAD-1KG',
      variantName: '1 kg Box',
      weight: 1,
      unit: 'kg',
      price: 215.0,
      stock: 40
    },
    {
      productName: 'Surf Excel Matic Top Load Detergent Powder',
      brand: 'Surf Excel',
      sku: 'SURF-TOPLOAD-2KG',
      variantName: '2 kg Pack',
      weight: 2,
      unit: 'kg',
      price: 399.0,
      stock: 50
    },
    {
      productName: 'Surf Excel Matic Top Load Detergent Powder',
      brand: 'Surf Excel',
      sku: 'SURF-TOPLOAD-4KG',
      variantName: '4 kg Box',
      weight: 4,
      unit: 'kg',
      price: 749.0,
      stock: 25
    }
  ];

  for (const item of variantsToEnsure) {
    // Find product
    const prodRes = await pool.query(
      `SELECT id FROM products WHERE name ILIKE $1 LIMIT 1`,
      [item.productName]
    );

    if (prodRes.rows.length === 0) {
      console.warn(`Product not found: ${item.productName}`);
      continue;
    }

    const productId = prodRes.rows[0].id;

    // Insert or update variant
    await pool.query(
      `INSERT INTO product_variants (
        product_id, sku, variant_name, net_weight_value, measurement_unit, status
      ) VALUES ($1, $2, $3, $4, $5, 'active')
      ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        variant_name = EXCLUDED.variant_name,
        net_weight_value = EXCLUDED.net_weight_value,
        measurement_unit = EXCLUDED.measurement_unit,
        status = 'active'`,
      [productId, item.sku, item.variantName, item.weight, item.unit]
    );

    // Update base price
    await pool.query(`UPDATE base_prices SET is_active = FALSE WHERE sku = $1`, [item.sku]);
    await pool.query(
      `INSERT INTO base_prices (sku, amount, currency, is_active)
       VALUES ($1, $2, 'INR', TRUE)`,
      [item.sku, item.price]
    );

    // Update stock balance
    await pool.query(
      `INSERT INTO stock_balances (location_id, sku, on_hand_qty, reserved_qty)
       VALUES ('80000000-0000-0000-0000-000000000001', $1, $2, 0)
       ON CONFLICT (location_id, sku) DO UPDATE SET
         on_hand_qty = EXCLUDED.on_hand_qty`,
      [item.sku, item.stock]
    );

    console.log(`  ✓ Variant ${item.sku} (${item.variantName}) -> ₹${item.price}, stock: ${item.stock}`);
  }

  console.log('✅ All variants successfully ensured in PostgreSQL database!');
  await pool.end();
}

main().catch(console.error);

