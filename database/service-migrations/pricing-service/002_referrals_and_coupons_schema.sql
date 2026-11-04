-- ====================================================================
-- Service: Pricing & Promotions Service
-- Migration: 002_referrals_and_coupons_schema.sql
-- Description: Dynamic Coupon Engine Seeds & Customer Referral System
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Seed Active High-Value Coupons (Idempotent ON CONFLICT)
INSERT INTO promotions (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, is_active)
VALUES 
  ('WELCOME50', 'Flat ₹50 OFF on your first grocery basket (Min order ₹199)', 'FIXED_AMOUNT', 50.00, 199.00, 50.00, TRUE),
  ('SAVE10', '10% OFF on all fresh fruits, veggies & staples (Min order ₹300)', 'PERCENTAGE', 10.00, 300.00, 100.00, TRUE),
  ('FREESHIP', 'Free Express Home Delivery on orders above ₹149', 'FREE_SHIPPING', 40.00, 149.00, 40.00, TRUE),
  ('FLAT100', 'Flat ₹100 instant discount on mega restock (Min order ₹699)', 'FIXED_AMOUNT', 100.00, 699.00, 100.00, TRUE),
  ('FRESH20', '20% Mega Savings for Weekend Super Savers (Min order ₹499)', 'PERCENTAGE', 20.00, 499.00, 150.00, TRUE)
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description,
    discount_type = EXCLUDED.discount_type,
    discount_value = EXCLUDED.discount_value,
    min_order_amount = EXCLUDED.min_order_amount,
    max_discount_amount = EXCLUDED.max_discount_amount,
    is_active = TRUE;

-- 2. Customer Referral Program
CREATE TABLE IF NOT EXISTS customer_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_customer_id VARCHAR(64) NOT NULL,
    referral_code VARCHAR(32) NOT NULL UNIQUE,
    referee_customer_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REDEEMED', 'REWARDED'
    reward_amount NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    redeemed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON customer_referrals(referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON customer_referrals(referral_code);

