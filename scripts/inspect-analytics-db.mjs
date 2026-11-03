import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('Tables:', tables.rows.map(r => r.table_name));

  const demandCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'daily_sku_demand'");
  console.log('daily_sku_demand columns:', demandCols.rows);

  const demandCount = await pool.query("SELECT count(1) as count FROM daily_sku_demand");
  console.log('daily_sku_demand rows:', demandCount.rows[0].count);

  const sampleDemand = await pool.query("SELECT * FROM daily_sku_demand LIMIT 5");
  console.log('daily_sku_demand sample:', sampleDemand.rows);

  const forecastPredCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'forecast_predictions'");
  console.log('forecast_predictions columns:', forecastPredCols.rows);

  const alertsCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stockout_risk_alerts'");
  console.log('stockout_risk_alerts columns:', alertsCols.rows);

  await pool.end();
}

main().catch(console.error);

