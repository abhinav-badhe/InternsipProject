-- ====================================================================
-- Service: Pricing & Promotions Service
-- Migration: 001_initial_pricing_schema.sql
-- Description: Effective-dated prices, tax rates, and discount rules
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Promotion types
DO $$ BEGIN
    CREATE TYPE promo_type AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tax Rates Table
CREATE TABLE IF NOT EXISTS tax_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    rate_percent NUMERIC(5, 2) NOT NULL, -- e.g. 5.00 for 5% GST, 18.00 for 18%
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_non_negative_tax CHECK (rate_percent >= 0)
);

-- 3. Base Prices Table (Effective-dated pricing per SKU)
CREATE TABLE IF NOT EXISTS base_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    amount NUMERIC(12, 4) NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ, -- NULL means indefinitely active until superseded
    tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_positive_price CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_base_prices_sku_effective ON base_prices(sku, effective_from, effective_to);

-- 4. Promotions & Discount Codes
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(32) NOT NULL UNIQUE,
    description TEXT,
    discount_type promo_type NOT NULL,
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(12, 4) DEFAULT 0,
    max_discount_amount NUMERIC(12, 4),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_positive_discount CHECK (discount_value > 0)
);

CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
