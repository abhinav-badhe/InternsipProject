-- ====================================================================
-- Service: Fulfillment Service
-- Migration: 005_delivery_partner_module_schema.sql
-- Description: Independent Delivery Partner enrollment, auth, atomic order acceptance, and tracking
-- ====================================================================

-- 1. Extend delivery_riders table with credentials, emergency, and KYC fields
ALTER TABLE delivery_riders
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20),
    ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10),
    ADD COLUMN IF NOT EXISTS pan_number VARCHAR(32),
    ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(32),
    ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'DELIVERY_PARTNER',
    ADD COLUMN IF NOT EXISTS total_earnings_all_time NUMERIC(12, 2) DEFAULT 0.00;

-- 2. Extend delivery_assignments with reached_store_at and atomic acceptance support
ALTER TABLE delivery_assignments
    ADD COLUMN IF NOT EXISTS reached_store_at TIMESTAMPTZ;

-- Clean up any historical duplicate assignments, keeping the latest one per order
DELETE FROM delivery_assignments da1
WHERE status NOT IN ('CANCELLED')
  AND created_at < (
    SELECT MAX(da2.created_at) 
    FROM delivery_assignments da2 
    WHERE da2.order_id = da1.order_id AND da2.status NOT IN ('CANCELLED')
  );

-- 3. Prevent duplicate active assignments at database level (First-acceptance-wins ACID guarantee)
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_assignments_active_order 
    ON delivery_assignments(order_id) 
    WHERE status NOT IN ('CANCELLED');

-- 4. Extend orders with ready_for_pickup flag and timestamp
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS ready_for_pickup BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ready_for_pickup_at TIMESTAMPTZ;

-- 5. Create index for fast queries on available orders
CREATE INDEX IF NOT EXISTS idx_orders_ready_for_pickup ON orders(status, ready_for_pickup);
