-- ====================================================================
-- Service: Catalog Service
-- Seed: seed_sample_catalog.sql
-- Description: Complete omnichannel grocery catalog dataset with publicly accessible images
-- ====================================================================

BEGIN;

-- 1. Categories with Public Images and Aliases
INSERT INTO categories (id, parent_id, name, slug, description, image_url, aliases, display_order, is_active)
VALUES 
  ('11000000-0000-0000-0000-000000000001', NULL, 'Bathing Soaps & Body Wash', 'bathing-soaps', 'Luxury moisturizing bathing bars, herbal cleansers, and refreshing body washes', 'https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=600&q=80', ARRAY['soap', 'soaps', 'bathing soap', 'body wash', 'shower gel', 'bath bar'], 1, TRUE),
  ('11000000-0000-0000-0000-000000000002', NULL, 'Washing Soaps & Detergent Bars', 'washing-soaps', 'Stain-fighting detergent bars and fabric washing soaps for bright clothes', 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80', ARRAY['soap', 'soaps', 'washing soap', 'detergent bar', 'clothes soap'], 2, TRUE),
  ('11000000-0000-0000-0000-000000000003', NULL, 'Dishwashing & Utensil Soaps', 'utensil-soaps', 'Degreasing dishwash bars, liquids, and pastes for sparkling clean cookware', 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80', ARRAY['soap', 'soaps', 'dish soap', 'utensil soap', 'dishwash bar', 'dishwashing'], 3, TRUE),
  ('11000000-0000-0000-0000-000000000004', NULL, 'Dairy, Butter & Eggs', 'dairy-butter', 'Farm-fresh milk, salted & unsalted butter, cheese blocks, paneer, and eggs', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80', ARRAY['dairy', 'butter', 'milk', 'cheese', 'paneer', 'eggs', 'curd', 'dahi'], 4, TRUE),
  ('11000000-0000-0000-0000-000000000005', NULL, 'Breads & Bakery', 'bread-bakery', 'Freshly baked sandwich breads, whole wheat loaves, buns, and crusty baguettes', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', ARRAY['bread', 'bakery', 'toast', 'buns', 'cookies', 'biscuits', 'pav'], 5, TRUE),
  ('11000000-0000-0000-0000-000000000006', NULL, 'Oral Care & Toothpastes', 'oral-care', 'Anticavity toothpastes, enamel protection gel, and oral hygiene care', 'https://images.unsplash.com/photo-1559591937-e129188d4474?auto=format&fit=crop&w=600&q=80', ARRAY['toothpaste', 'oral care', 'toothbrush', 'mouthwash', 'paste', 'teeth'], 6, TRUE),
  ('11000000-0000-0000-0000-000000000007', NULL, 'Hair Care & Shampoos', 'hair-care', 'Nourishing botanical shampoos, deep conditioners, and pure hair oils', 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80', ARRAY['shampoo', 'hair care', 'hair oil', 'conditioner', 'hair'], 7, TRUE),
  ('11000000-0000-0000-0000-000000000008', NULL, 'Staples, Flours, Salt & Sugar', 'staples-salt-sugar', 'Vacuum iodised salt, refined sugar, premium wheat flour (atta), and dal pulses', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80', ARRAY['salt', 'sugar', 'atta', 'flour', 'rice', 'dal', 'pulses', 'staples', 'oil'], 8, TRUE),
  ('11000000-0000-0000-0000-000000000009', NULL, 'Laundry Powders & Detergents', 'laundry-powders', 'Top load, front load, and hand-wash laundry powders with active enzymes', 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80', ARRAY['detergent', 'washing powder', 'laundry powder', 'surf', 'detergent liquid'], 9, TRUE),
  ('11000000-0000-0000-0000-000000000010', NULL, 'Tea, Coffee & Beverages', 'beverages-tea-coffee', 'Aromatic whole leaf teas, roasted instant coffee beans, and fruit juices', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80', ARRAY['tea', 'chai', 'coffee', 'juice', 'beverages', 'drinks', 'cold drink'], 10, TRUE),
  ('11000000-0000-0000-0000-000000000011', NULL, 'Snacks, Biscuits & Instant Food', 'snacks-instant-food', 'Crispy potato chips, instant 2-minute noodles, gourmet cookies, and namkeen', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80', ARRAY['snacks', 'chips', 'noodles', 'maggi', 'biscuits', 'namkeen'], 11, TRUE),
  ('10000000-0000-0000-0000-000000000005', NULL, 'Fresh Fruits & Farm Vegetables', 'fruits-vegetables', 'Daily harvest organic potatoes, crisp onions, ripe tomatoes, apples, and bananas', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80', ARRAY['vegetables', 'fruits', 'onion', 'potato', 'tomato', 'apple', 'banana', 'fresh'], 12, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  aliases = EXCLUDED.aliases,
  is_active = TRUE;

-- 2. Brands with Logos
INSERT INTO brands (id, name, slug, logo_url, is_active)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Dove', 'dove', 'https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000002', 'Dettol', 'dettol', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000003', 'Rin', 'rin', 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000004', 'Vim', 'vim', 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000005', 'Amul', 'amul', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000006', 'Lux', 'lux', 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000007', 'Pears', 'pears', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000008', 'Britannia', 'britannia', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000009', 'Colgate', 'colgate', 'https://images.unsplash.com/photo-1559591937-e129188d4474?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000010', 'Hair & Care', 'hair-care', 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000011', 'Tata', 'tata', 'https://images.unsplash.com/photo-1518110903495-cdffac505a60?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000012', 'Madhur', 'madhur', 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000013', 'Surf Excel', 'surf-excel', 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000014', 'Aashirvaad', 'aashirvaad', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000015', 'Fortune', 'fortune', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000016', 'Maggi', 'maggi', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000017', 'Nescafe', 'nescafe', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000018', 'Lay’s', 'lays', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=200&q=80', TRUE),
  ('20000000-0000-0000-0000-000000000019', 'Farm Fresh', 'farm-fresh', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=200&q=80', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url,
  is_active = TRUE;

-- 3. Core Grocery Products
INSERT INTO products (id, brand_id, primary_category_id, name, slug, description, is_perishable, storage_type, shelf_life_days, is_veg, tags, is_active)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Dove Cream Beauty Bathing Bar', 'dove-cream-beauty-bathing-bar', 'Enriched with 1/4 moisturizing cream for soft, smooth, glowing skin', FALSE, 'ambient', 730, TRUE, ARRAY['soap', 'bathing', 'dove', 'moisturizer'], TRUE),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'Dettol Original Germ Protection Bathing Soap', 'dettol-original-germ-protection-bathing-soap', 'Trusted 99.9% germ defense with classic pine fragrance', FALSE, 'ambient', 730, TRUE, ARRAY['soap', 'dettol', 'germ protection', 'hygiene'], TRUE),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000007', '11000000-0000-0000-0000-000000000001', 'Pears Pure & Gentle Bathing Bar', 'pears-pure-gentle-bathing-bar', 'Transparent glycerine bathing bar preserving skin natural hydration', FALSE, 'ambient', 730, TRUE, ARRAY['soap', 'pears', 'glycerine', 'pure'], TRUE),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000006', '11000000-0000-0000-0000-000000000001', 'Lux Rose & Vitamin E Bathing Soap', 'lux-rose-vitamin-e-bathing-soap', 'French rose essence and Vitamin E for glowing radiant skin', FALSE, 'ambient', 730, TRUE, ARRAY['soap', 'lux', 'rose', 'fragrance'], TRUE),
  ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000004', 'Amul Pasteurised Butter', 'amul-pasteurised-butter', 'Classic delicious salted butter made from fresh pure cow & buffalo milk', TRUE, 'chilled', 180, TRUE, ARRAY['butter', 'amul', 'dairy', 'breakfast'], TRUE),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000008', '11000000-0000-0000-0000-000000000005', 'Britannia Large Sandwich White Bread', 'britannia-large-sandwich-white-bread', 'Soft, airy sandwich slices perfect for morning toast and clubhouse sandwiches', TRUE, 'ambient', 5, TRUE, ARRAY['bread', 'sandwich', 'britannia', 'bakery'], TRUE),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000009', '11000000-0000-0000-0000-000000000006', 'Colgate Strong Teeth Anticavity Toothpaste', 'colgate-strong-teeth-anticavity-toothpaste', 'Amino Shakti formula adds natural calcium for 2x stronger teeth', FALSE, 'ambient', 730, TRUE, ARRAY['colgate', 'toothpaste', 'anticavity', 'oral care'], TRUE),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000010', '11000000-0000-0000-0000-000000000007', 'Hair & Care Triple Blend Nourishing Shampoo', 'hair-care-triple-blend-nourishing-shampoo', 'Enriched with aloe vera, olive oil, and green tea for silky frizz-free hair', FALSE, 'ambient', 730, TRUE, ARRAY['shampoo', 'hair care', 'hair & care', 'nourishing'], TRUE),
  ('30000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000011', '11000000-0000-0000-0000-000000000008', 'Tata Salt Vacuum Evaporated Iodised Salt', 'tata-salt-vacuum-evaporated-iodised-salt', 'Desh Ka Namak: Untouched by hand, 100% vacuum evaporated iodised salt', FALSE, 'ambient', 730, TRUE, ARRAY['salt', 'tata salt', 'iodised', 'staple'], TRUE),
  ('30000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000012', '11000000-0000-0000-0000-000000000008', 'Madhur Pure & Hygienic Refined Sugar', 'madhur-pure-hygienic-refined-sugar', 'Sulphur-free double refined crystal sugar for daily cooking & desserts', FALSE, 'ambient', 730, TRUE, ARRAY['sugar', 'madhur', 'sweet', 'staple'], TRUE),
  ('30000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000013', '11000000-0000-0000-0000-000000000009', 'Surf Excel Matic Top Load Detergent Powder', 'surf-excel-matic-top-load-detergent-powder', 'Formulated for high water levels with vibrating stain removal power', FALSE, 'ambient', 730, TRUE, ARRAY['detergent', 'surf excel', 'powder', 'top load'], TRUE),
  ('30000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000004', 'Amul Taaza Homogenised Toned Milk', 'amul-taaza-homogenised-toned-milk', 'Long-life UHT processed toned milk with zero bacteria', TRUE, 'ambient', 180, TRUE, ARRAY['milk', 'amul', 'toned milk', 'beverage'], TRUE),
  ('30000000-0000-0000-0000-000000000023', '20000000-0000-0000-0000-000000000014', '11000000-0000-0000-0000-000000000008', 'Aashirvaad Superior MP Sharbati Whole Wheat Atta', 'aashirvaad-superior-mp-sharbati-whole-wheat-atta', '100% whole wheat stone ground flour for extra soft fluffy rotis', FALSE, 'ambient', 180, TRUE, ARRAY['atta', 'flour', 'wheat', 'roti', 'aashirvaad'], TRUE),
  ('30000000-0000-0000-0000-000000000024', '20000000-0000-0000-0000-000000000015', '11000000-0000-0000-0000-000000000008', 'Fortune Sunlite Refined Sunflower Oil', 'fortune-sunlite-refined-sunflower-oil', 'Light and healthy cooking oil rich in natural Vitamin E', FALSE, 'ambient', 270, TRUE, ARRAY['oil', 'cooking oil', 'sunflower oil', 'fortune'], TRUE),
  ('30000000-0000-0000-0000-000000000027', '20000000-0000-0000-0000-000000000017', '11000000-0000-0000-0000-000000000010', 'Nescafe Classic 100% Pure Instant Coffee', 'nescafe-classic-100-pure-instant-coffee', 'Rich dark roasted Robusta beans for a bold aromatic morning kick', FALSE, 'ambient', 540, TRUE, ARRAY['coffee', 'nescafe', 'instant coffee', 'beverage'], TRUE),
  ('30000000-0000-0000-0000-000000000028', '20000000-0000-0000-0000-000000000016', '11000000-0000-0000-0000-000000000011', 'Maggi 2-Minute Instant Masala Noodles', 'maggi-2-minute-instant-masala-noodles', 'India’s favorite noodles seasoned with a blend of 10 roasted aromatic spices', FALSE, 'ambient', 270, TRUE, ARRAY['noodles', 'maggi', 'instant food', 'snack'], TRUE),
  ('30000000-0000-0000-0000-000000000029', '20000000-0000-0000-0000-000000000018', '11000000-0000-0000-0000-000000000011', 'Lay’s India’s Magic Masala Potato Chips', 'lays-indias-magic-masala-potato-chips', 'Thinly sliced crispy potatoes cooked in fragrant Indian spices', FALSE, 'ambient', 120, TRUE, ARRAY['chips', 'lays', 'potato chips', 'snack'], TRUE),
  ('30000000-0000-0000-0000-000000000030', '20000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000005', 'Fresh Farm Red Onions', 'fresh-farm-red-onions', 'Crisp, pungent red onions sourced directly from local grower collectives', TRUE, 'ambient', 14, TRUE, ARRAY['onion', 'vegetables', 'fresh', 'farm'], TRUE),
  ('30000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000005', 'Fresh Shimla Royal Delicious Apples', 'fresh-shimla-royal-delicious-apples', 'Sweet, crisp, juicy highland red apples rich in antioxidants', TRUE, 'chilled', 21, TRUE, ARRAY['apple', 'fruits', 'shimla', 'healthy'], TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  storage_type = EXCLUDED.storage_type,
  is_active = TRUE;

-- 4. Product Variants with Public Image URLs
INSERT INTO product_variants (id, product_id, sku, barcode, variant_name, net_weight_value, measurement_unit, image_urls, status)
VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'DOVE-BAR-75G', '8901030010012', '75 g Single Bar', 75.000, 'g', ARRAY['https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'DOVE-BAR-125G-4PK', '8901030010043', '125 g (Pack of 4)', 500.000, 'g', ARRAY['https://images.unsplash.com/photo-1607006314644-8cb3b80b0676?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'DETTOL-ORIG-75G', '8901030020011', '75 g Single Bar', 75.000, 'g', ARRAY['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'DETTOL-ORIG-125G-3PK', '8901030020028', '125 g (Pack of 3)', 375.000, 'g', ARRAY['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 'PEARS-PURE-75G', '8901030030010', '75 g Single Bar', 75.000, 'g', ARRAY['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000003', 'PEARS-PURE-125G-3PK', '8901030030027', '125 g (Pack of 3)', 375.000, 'g', ARRAY['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000004', 'LUX-ROSE-100G-3PK', '8901030040019', '100 g (Pack of 3)', 300.000, 'g', ARRAY['https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000010', 'AMUL-BTR-500G', '8901262010013', '500 g Carton', 500.000, 'g', ARRAY['https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000010', 'AMUL-BTR-100G', '8901262010020', '100 g Pack', 100.000, 'g', ARRAY['https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000011', 'BRIT-BREAD-LRG-500G', '8901063010010', 'Large 500 g Loaf', 500.000, 'g', ARRAY['https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000012', 'COLG-TOOTH-200G', '8901314010015', '200 g Tube', 200.000, 'g', ARRAY['https://images.unsplash.com/photo-1559591937-e129188d4474?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000012', 'COLG-TOOTH-100G', '8901314010022', '100 g Tube', 100.000, 'g', ARRAY['https://images.unsplash.com/photo-1559591937-e129188d4474?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000013', 'HNC-SHAMP-200G', '8901088010018', '200 ml Bottle', 200.000, 'ml', ARRAY['https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000014', 'TATA-SALT-500G', '8904043901011', '500 g Pack', 500.000, 'g', ARRAY['https://images.unsplash.com/photo-1518110903495-cdffac505a60?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000014', 'TATA-SALT-1KG', '8904043901028', '1 kg Pack', 1.000, 'kg', ARRAY['https://images.unsplash.com/photo-1518110903495-cdffac505a60?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000015', 'MADHUR-SUGAR-2KG', '8906014410013', '2 kg Bag', 2.000, 'kg', ARRAY['https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000017', '30000000-0000-0000-0000-000000000015', 'MADHUR-SUGAR-1KG', '8906014410020', '1 kg Bag', 1.000, 'kg', ARRAY['https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000018', '30000000-0000-0000-0000-000000000016', 'SURF-TOPLOAD-4KG', '8901030801016', '4 kg Box', 4.000, 'kg', ARRAY['https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000019', '30000000-0000-0000-0000-000000000016', 'SURF-TOPLOAD-2KG', '8901030801023', '2 kg Pack', 2.000, 'kg', ARRAY['https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000020', 'AMUL-TZ-1L', '8901262010105', '1 Litre Tetra Pak', 1.000, 'l', ARRAY['https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000023', 'AASH-ATTA-5KG', '8901725010017', '5 kg Bag', 5.000, 'kg', ARRAY['https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000024', 'FORT-OIL-1L', '8906007280012', '1 Litre Pouch', 1.000, 'l', ARRAY['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000023', '30000000-0000-0000-0000-000000000027', 'NESC-COFFEE-100G', '8901058010012', '100 g Glass Jar', 100.000, 'g', ARRAY['https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000024', '30000000-0000-0000-0000-000000000028', 'MAGGI-MASALA-280G-4PK', '8901058840015', 'Pack of 4 (280 g)', 280.000, 'g', ARRAY['https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000025', '30000000-0000-0000-0000-000000000029', 'LAYS-MASALA-90G', '8901491101018', '90 g Bag', 90.000, 'g', ARRAY['https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000026', '30000000-0000-0000-0000-000000000030', 'ONION-RED-1KG', NULL, '1 kg Mesh Bag', 1.000, 'kg', ARRAY['https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80'], 'active'),
  ('40000000-0000-0000-0000-000000000027', '30000000-0000-0000-0000-000000000031', 'APPLE-SHIMLA-1KG', NULL, '1 kg Pack (Approx. 4-5 Apples)', 1.000, 'kg', ARRAY['https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80'], 'active')
ON CONFLICT (sku) DO UPDATE SET
  variant_name = EXCLUDED.variant_name,
  image_urls = EXCLUDED.image_urls,
  status = 'active';

COMMIT;
