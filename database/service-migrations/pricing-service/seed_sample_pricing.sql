-- ====================================================================
-- Service: Pricing & Promotions Service
-- Seed: seed_sample_pricing.sql
-- Description: Seed tax rates and effective prices matching catalog SKUs
-- ====================================================================

BEGIN;

-- 1. Standard Tax Rates (e.g. India GST brackets)
INSERT INTO tax_rates (id, name, rate_percent)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'GST Exempt (Fresh Produce/Milk)', 0.00),
  ('50000000-0000-0000-0000-000000000002', 'GST 5% (Essential Food Items)', 5.00),
  ('50000000-0000-0000-0000-000000000003', 'GST 18% (Soaps & Cleaning)', 18.00)
ON CONFLICT (id) DO NOTHING;

-- 2. Base Prices for SKUs
INSERT INTO base_prices (id, sku, currency, amount, tax_rate_id, effective_from, is_active)
VALUES
  -- Dove Soaps (18% GST)
  ('60000000-0000-0000-0000-000000000001', 'DOVE-BAR-75G', 'INR', 52.0000, '50000000-0000-0000-0000-000000000003', NOW(), TRUE),
  ('60000000-0000-0000-0000-000000000002', 'DOVE-BAR-125G-4PK', 'INR', 220.0000, '50000000-0000-0000-0000-000000000003', NOW(), TRUE),

  -- Rin Washing Soaps (18% GST)
  ('60000000-0000-0000-0000-000000000003', 'RIN-BAR-250G', 'INR', 20.0000, '50000000-0000-0000-0000-000000000003', NOW(), TRUE),
  ('60000000-0000-0000-0000-000000000004', 'RIN-BAR-500G-2PK', 'INR', 38.0000, '50000000-0000-0000-0000-000000000003', NOW(), TRUE),

  -- Vim Utensil Soaps (18% GST)
  ('60000000-0000-0000-0000-000000000005', 'VIM-BAR-150G', 'INR', 15.0000, '50000000-0000-0000-0000-000000000003', NOW(), TRUE),
  ('60000000-0000-0000-0000-000000000006', 'VIM-BAR-300G-SCRUB', 'INR', 32.0000, '50000000-0000-0000-0000-000000000003', NOW(), TRUE),

  -- Amul Milk (0% GST - Exempt)
  ('60000000-0000-0000-0000-000000000007', 'AMUL-TZ-500ML', 'INR', 27.0000, '50000000-0000-0000-0000-000000000001', NOW(), TRUE),
  ('60000000-0000-0000-0000-000000000008', 'AMUL-TZ-1L', 'INR', 54.0000, '50000000-0000-0000-0000-000000000001', NOW(), TRUE),

  -- Onions (0% GST - Exempt)
  ('60000000-0000-0000-0000-000000000009', 'PROD-ONION-1KG', 'INR', 35.0000, '50000000-0000-0000-0000-000000000001', NOW(), TRUE),
  ('60000000-0000-0000-0000-000000000010', 'PROD-ONION-5KG', 'INR', 160.0000, '50000000-0000-0000-0000-000000000001', NOW(), TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Sample Promotional Discount
INSERT INTO promotions (id, code, description, discount_type, discount_value, min_order_amount, is_active)
VALUES
  ('70000000-0000-0000-0000-000000000001', 'WELCOME10', '10% off on first order above ₹199', 'PERCENTAGE', 10.00, 199.0000, TRUE),
  ('70000000-0000-0000-0000-000000000002', 'FLAT50', 'Flat ₹50 off on orders above ₹499', 'FIXED_AMOUNT', 50.00, 499.0000, TRUE)
ON CONFLICT (id) DO NOTHING;

COMMIT;
