-- ====================================================================
-- Service: Inventory Service
-- Seed: seed_sample_inventory.sql
-- Description: Seed initial store locations and stock balances (including 1 unit test scenario)
-- ====================================================================

BEGIN;

-- 1. Main Store / Warehouse Location
INSERT INTO stock_locations (id, code, name, is_active)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'STORE-MAIN-01', 'Downtown Omnichannel Superstore', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Initial Stock Balances
INSERT INTO stock_balances (location_id, sku, on_hand_qty, reserved_qty)
VALUES
  -- Dove single bar: Plenty in stock (100 units)
  ('80000000-0000-0000-0000-000000000001', 'DOVE-BAR-75G', 100.000, 0.000),

  -- Dove 4-Pack: Exactly 1 sellable unit left (For Testing Acceptance Scenario 1!)
  ('80000000-0000-0000-0000-000000000001', 'DOVE-BAR-125G-4PK', 1.000, 0.000),

  -- Rin Washing Soaps:
  ('80000000-0000-0000-0000-000000000001', 'RIN-BAR-250G', 80.000, 0.000),
  ('80000000-0000-0000-0000-000000000001', 'RIN-BAR-500G-2PK', 40.000, 0.000),

  -- Vim Utensil Soaps:
  ('80000000-0000-0000-0000-000000000001', 'VIM-BAR-150G', 120.000, 0.000),
  ('80000000-0000-0000-0000-000000000001', 'VIM-BAR-300G-SCRUB', 60.000, 0.000),

  -- Milk (Perishable - fresh daily receipts):
  ('80000000-0000-0000-0000-000000000001', 'AMUL-TZ-500ML', 50.000, 0.000),
  ('80000000-0000-0000-0000-000000000001', 'AMUL-TZ-1L', 30.000, 0.000),

  -- Onions (By weight):
  ('80000000-0000-0000-0000-000000000001', 'PROD-ONION-1KG', 200.000, 0.000),
  ('80000000-0000-0000-0000-000000000001', 'PROD-ONION-5KG', 50.000, 0.000)
ON CONFLICT (location_id, sku) DO NOTHING;

-- 3. Initial Receipts Ledger Entries
INSERT INTO stock_movement_ledger (location_id, sku, quantity_delta, balance_after, reason, reference_id, actor)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'DOVE-BAR-75G', 100.000, 100.000, 'RECEIPT', 'PO-INITIAL-001', 'system_seed'),
  ('80000000-0000-0000-0000-000000000001', 'DOVE-BAR-125G-4PK', 1.000, 1.000, 'RECEIPT', 'PO-INITIAL-001', 'system_seed');

COMMIT;
