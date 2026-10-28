-- ====================================================================
-- Service: Catalog Service
-- Seed: seed_sample_catalog.sql
-- Description: Baseline seed demonstrating category tree, "soap" disambiguation, and various grocery product types
-- ====================================================================

BEGIN;

-- 1. Root & Child Categories
-- Soaps & Cleaning root
INSERT INTO categories (id, parent_id, name, slug, description, aliases, display_order)
VALUES 
  ('10000000-0000-0000-0000-000000000001', NULL, 'Personal Care', 'personal-care', 'Personal hygiene and body care products', ARRAY['personal care', 'hygiene'], 1),
  ('10000000-0000-0000-0000-000000000002', NULL, 'Household & Laundry', 'household-laundry', 'Cleaning and laundry essentials', ARRAY['cleaning', 'laundry', 'household'], 2),
  ('10000000-0000-0000-0000-000000000003', NULL, 'Kitchen & Dishwashing', 'kitchen-dishwashing', 'Dishwashing and kitchen care', ARRAY['kitchen', 'utensil cleaning'], 3),
  ('10000000-0000-0000-0000-000000000004', NULL, 'Dairy & Eggs', 'dairy-eggs', 'Fresh dairy, milk, butter, and eggs', ARRAY['dairy', 'milk', 'breakfast'], 4),
  ('10000000-0000-0000-0000-000000000005', NULL, 'Fruits & Vegetables', 'fruits-vegetables', 'Fresh farm produce', ARRAY['produce', 'veggies', 'fruits'], 5)
ON CONFLICT (id) DO NOTHING;

-- Subcategories (Crucial: 3 distinct "soap" subcategories for disambiguation)
INSERT INTO categories (id, parent_id, name, slug, description, aliases, display_order)
VALUES
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Bathing Soaps & Body Wash', 'bathing-soaps', 'Body soaps, beauty bars, and body washes', ARRAY['soap', 'bath soap', 'bathing soap', 'body wash', 'sabun'], 1),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Washing Soaps & Detergent Bars', 'washing-soaps', 'Cloth washing bars and laundry detergent soaps', ARRAY['soap', 'washing soap', 'cloth soap', 'detergent bar', 'rin'], 2),
  ('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Dishwashing & Utensil Soaps', 'utensil-soaps', 'Utensil cleaning bars, liquids, and scrubs', ARRAY['soap', 'utensil soap', 'dish soap', 'dishwash bar', 'vim bar', 'bartan sabun'], 3),
  ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'Milk & Cream', 'milk-cream', 'Fresh pasteurized and homogenized milk', ARRAY['milk', 'doodh'], 4),
  ('11000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'Fresh Vegetables', 'fresh-vegetables', 'Daily cooking vegetables and roots', ARRAY['vegetables', 'sabzi'], 5)
ON CONFLICT (id) DO NOTHING;

-- 2. Brands
INSERT INTO brands (id, name, slug, logo_url)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Dove', 'dove', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Dove_logo.svg/320px-Dove_logo.svg.png'),
  ('20000000-0000-0000-0000-000000000002', 'Dettol', 'dettol', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Dettol_logo.svg/320px-Dettol_logo.svg.png'),
  ('20000000-0000-0000-0000-000000000003', 'Rin', 'rin', NULL),
  ('20000000-0000-0000-0000-000000000004', 'Vim', 'vim', NULL),
  ('20000000-0000-0000-0000-000000000005', 'Amul', 'amul', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Amul_official_logo.svg/320px-Amul_official_logo.svg.png')
ON CONFLICT (id) DO NOTHING;

-- 3. Products
INSERT INTO products (id, brand_id, primary_category_id, name, slug, description, is_perishable, storage_type, shelf_life_days, is_veg, tags)
VALUES
  -- Bathing soap product
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Dove Cream Beauty Bathing Bar', 'dove-cream-beauty-bathing-bar', 'Gentle moisturizing bathing bar soap enriched with 1/4 moisturizing cream', FALSE, 'ambient', 730, TRUE, ARRAY['soap', 'bathing', 'moisturizing', 'skincare']),
  -- Washing soap product
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000002', 'Rin Advanced Detergent Bar', 'rin-advanced-detergent-bar', 'High-performance laundry detergent bar for bright, clean whites and colored clothes', FALSE, 'ambient', 730, TRUE, ARRAY['soap', 'washing', 'laundry', 'cloth-cleaning']),
  -- Utensil soap product
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000003', 'Vim Lemon Dishwash Bar', 'vim-lemon-dishwash-bar', 'Power of 100 lemons dishwash bar that removes tough grease from utensils easily', FALSE, 'ambient', 730, TRUE, ARRAY['soap', 'utensil', 'dishwash', 'kitchen-cleaning']),
  -- Dairy milk
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000004', 'Amul Taaza Homogenised Toned Milk', 'amul-taaza-toned-milk', 'Pure, fresh homogenized toned cow/buffalo milk with minimum 3.0% fat', TRUE, 'chilled', 2, TRUE, ARRAY['dairy', 'milk', 'fresh', 'breakfast']),
  -- Fresh Produce (Loose / Sold by weight)
  ('30000000-0000-0000-0000-000000000005', NULL, '11000000-0000-0000-0000-000000000005', 'Fresh Red Onions', 'fresh-red-onions', 'Farm fresh pungent red cooking onions', TRUE, 'ambient', 14, TRUE, ARRAY['produce', 'vegetables', 'daily-staple'])
ON CONFLICT (id) DO NOTHING;

-- 4. Product Variants (SKUs with Pack Sizes, Net Weights, Barcodes)
INSERT INTO product_variants (id, product_id, sku, barcode, variant_name, net_weight_value, measurement_unit, image_urls, status)
VALUES
  -- Dove Soaps (75g vs 125g pack of 4)
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'DOVE-BAR-75G', '8901030010012', '75 g Single Bar', 75.000, 'g', ARRAY['https://images.unsplash.com/photo-1607006314644-8e10034a7424?w=500'], 'active'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'DOVE-BAR-125G-4PK', '8901030010043', '125 g (Pack of 4)', 500.000, 'g', ARRAY['https://images.unsplash.com/photo-1607006314644-8e10034a7424?w=500'], 'active'),

  -- Rin Washing Soap (250g vs 500g 2-pack)
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'RIN-BAR-250G', '8901030020011', '250 g Single Bar', 250.000, 'g', ARRAY['https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500'], 'active'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'RIN-BAR-500G-2PK', '8901030020028', '500 g (Pack of 2)', 500.000, 'g', ARRAY['https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500'], 'active'),

  -- Vim Dishwash Soap (150g vs 300g with scrubber)
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 'VIM-BAR-150G', '8901030030010', '150 g Bar', 150.000, 'g', ARRAY['https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=500'], 'active'),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000003', 'VIM-BAR-300G-SCRUB', '8901030030027', '300 g with Scrubber', 300.000, 'g', ARRAY['https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=500'], 'active'),

  -- Amul Milk (500 ml pouch vs 1 Litre)
  ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000004', 'AMUL-TZ-500ML', '8901262010051', '500 ml Pouch', 500.000, 'ml', ARRAY['https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500'], 'active'),
  ('40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000004', 'AMUL-TZ-1L', '8901262010105', '1 Litre Carton', 1.000, 'l', ARRAY['https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500'], 'active'),

  -- Onions (1 kg bag vs 5 kg bag)
  ('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000005', 'PROD-ONION-1KG', NULL, '1 kg Bag', 1.000, 'kg', ARRAY['https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500'], 'active'),
  ('40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000005', 'PROD-ONION-5KG', NULL, '5 kg Value Pack', 5.000, 'kg', ARRAY['https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500'], 'active')
ON CONFLICT (id) DO NOTHING;

-- 5. Variant Attributes
INSERT INTO variant_attributes (variant_id, attribute_name, attribute_value)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'Form', 'Bar'),
  ('40000000-0000-0000-0000-000000000001', 'Fragrance', 'Mild Floral'),
  ('40000000-0000-0000-0000-000000000007', 'Fat Content', '3.0% Minimum'),
  ('40000000-0000-0000-0000-000000000007', 'SNF', '8.5% Minimum')
ON CONFLICT (variant_id, attribute_name) DO NOTHING;

COMMIT;
