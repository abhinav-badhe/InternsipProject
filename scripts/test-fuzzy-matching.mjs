import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

function normalizeQuery(str) {
  return str
    .toLowerCase()
    .replace(/\bsandwitch\b/g, 'sandwich')
    .replace(/\blaoding\b/g, 'load')
    .replace(/\bpoweder\b/g, 'powder')
    .replace(/\bhair\s+and\s+care\b/g, 'hair care')
    .replace(/\bthese+e?\b/g, '')
    .replace(/\bsende?\b/g, '');
}

async function searchItem(queryLine) {
  // Strip leading list numbering (e.g. "1. " or "7. ")
  const strippedLine = queryLine.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•*]\s*/, '').trim();
  const norm = normalizeQuery(strippedLine);

  // Extract weight/pack tokens like "500", "2", "4", "200" from the stripped line
  const numToken = strippedLine.match(/(\d+)\s*(g|gm|gms|kg|kgs|ml|l|pcs)?/i)?.[1];

  const words = norm
    .replace(/(\d+)\s*(gms?|kgs?|pcs|pieces|pack|packs|boxes?|bottles?)\b/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3);

  const res = await pool.query(`
    SELECT p.id as product_id, p.name as product_name, p.primary_category_id,
           b.name as brand_name,
           v.sku, v.variant_name,
           COALESCE(bp.amount, 50) as selling_price,
           COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = TRUE
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    WHERE v.status = 'active'
  `);

  let best = null;
  let bestScore = 0;

  for (const item of res.rows) {
    const fullText = `${item.brand_name || ''} ${item.product_name} ${item.variant_name}`.toLowerCase();
    let score = 0;

    for (const w of words) {
      if (fullText.includes(w)) {
        score += 3;
      }
    }

    if (numToken && (item.variant_name.includes(numToken) || item.sku.includes(numToken))) {
      score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return { query: queryLine, match: best, score: bestScore };
}

async function main() {
  const testLines = [
    '1. amul butter 500 gms',
    '2. lux rose soap 3 pcs',
    '3. large sandwitch bread',
    '4. colgate toothpaste 2 pcs',
    '5. hair and care shampoo 200 gms',
    '6. tata salt 500 gms',
    '7. sugar 2 kgs',
    '8. surf excel top laoding poweder 4 kgs'
  ];

  for (const line of testLines) {
    const res = await searchItem(line);
    console.log(`Input: "${line}"`);
    if (res.match) {
      console.log(`  -> Match: [${res.match.brand_name}] ${res.match.product_name} (${res.match.variant_name}) | SKU: ${res.match.sku} | Stock: ${res.match.available_stock} (Score: ${res.score})`);
    } else {
      console.log('  -> No match');
    }
  }

  await pool.end();
}

main().catch(console.error);
