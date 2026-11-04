-- 003_customer_addresses_gps_schema.sql
-- Adds GPS lat and lng columns for exact doorstep delivery navigation

CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(128) NOT NULL,
  label VARCHAR(32) NOT NULL DEFAULT 'HOME',
  recipient_name VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  flat_number VARCHAR(128),
  street VARCHAR(256) NOT NULL,
  landmark VARCHAR(256),
  city VARCHAR(64) NOT NULL DEFAULT 'Bengaluru',
  pincode VARCHAR(16) NOT NULL DEFAULT '560102',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7);
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7);

