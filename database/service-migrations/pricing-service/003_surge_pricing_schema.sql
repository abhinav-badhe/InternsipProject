-- ====================================================================
-- Service: Pricing Service
-- Migration: 003_surge_pricing_schema.sql
-- Description: Dynamic surge pricing rules (Weather, High Demand, Late Night)
-- ====================================================================

CREATE TABLE IF NOT EXISTS surge_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    surge_type VARCHAR(32) NOT NULL, -- 'WEATHER', 'PEAK_HOURS', 'HIGH_DEMAND', 'LATE_NIGHT'
    fee_amount NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
    multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surge_rules_active ON surge_rules(is_active);

-- Seed default surge rules
INSERT INTO surge_rules (code, name, surge_type, fee_amount, multiplier, description, is_active)
VALUES
  ('RAIN_SURGE', 'Monsoon / Heavy Rain Surcharge', 'WEATHER', 25.00, 1.00, 'Rain fee passed 100% to delivery riders braving adverse weather.', FALSE),
  ('PEAK_DEMAND', 'Peak Evening Order Rush', 'HIGH_DEMAND', 20.00, 1.15, 'High fulfillment demand surge to balance dark store picking capacity.', FALSE),
  ('LATE_NIGHT', 'Midnight Delivery Surcharge', 'LATE_NIGHT', 30.00, 1.00, 'Late night rider safety and operational shift surcharge.', FALSE)
ON CONFLICT (code) DO NOTHING;
