import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT v.sku, v.variant_name, p.name as product_name, p.id as product_id
    FROM product_variants v 
    JOIN products p ON v.product_id = p.id 
    WHERE v.sku IN ('RIN-BAR-500G-2PK', 'BRIT-BREAD-LRG-500G', 'HNC-SHAMP-200G', 'MADHUR-SUGAR-2KG', 'COLG-TOOTH-200G')
  `);
  console.log(res.rows);
  await client.end();
}

main().catch(console.error);
