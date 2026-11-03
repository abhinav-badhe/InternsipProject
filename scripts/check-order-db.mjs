import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const res = await pool.query('SELECT order_number, channel, status, grand_total, reservation_id FROM orders WHERE order_number = $1', ['ORD-557181-213']);
console.log('ORDER IN DATABASE:', res.rows[0]);

const items = await pool.query('SELECT sku, product_name, variant_name, quantity, unit_price FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = $1)', ['ORD-557181-213']);
console.log('ORDER ITEMS:', items.rows);

const resv = await pool.query('SELECT * FROM stock_reservations WHERE id = $1', [res.rows[0].reservation_id]);
console.log('RESERVATION RECORD:', resv.rows[0]);

await pool.end();

