-- ====================================================================
-- Service: Catalog Service
-- Migration: 002_reviews_and_recipes_schema.sql
-- Description: Customer product reviews, ratings, and Recipe Bundles
-- ====================================================================

CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(128) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_verified_buyer BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON product_reviews(customer_id);

CREATE TABLE IF NOT EXISTS recipe_bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL,
    slug VARCHAR(128) NOT NULL UNIQUE,
    cuisine VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    prep_time_minutes INTEGER NOT NULL DEFAULT 20,
    servings INTEGER NOT NULL DEFAULT 4,
    image_url TEXT,
    bundle_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_bundle_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES recipe_bundles(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    product_name VARCHAR(128) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit VARCHAR(32) NOT NULL DEFAULT 'pack'
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_bundle_items(recipe_id);

-- Seed Initial Recipe Bundles
INSERT INTO recipe_bundles (id, name, slug, cuisine, description, prep_time_minutes, servings, image_url, bundle_discount_percent, is_active)
VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Homestyle Dal Tadka & Jeera Rice', 'dal-tadka-jeera-rice', 'North Indian', 'Comforting yellow toor dal tempered with cumin, garlic, and fresh tomatoes, served with aromatic basmati rice.', 25, 4, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80', 12.00, TRUE),
  ('b2222222-2222-2222-2222-222222222222', 'Creamy Italian Penne Pasta', 'creamy-italian-penne-pasta', 'Italian', 'Classic al dente penne pasta tossed in rich herb tomato sauce, garnished with mozzarella and oregano.', 20, 2, 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=600&auto=format&fit=crop&q=80', 10.00, TRUE),
  ('b3333333-3333-3333-3333-333333333333', 'Classic Mumbai Pav Bhaji', 'mumbai-pav-bhaji', 'Street Food', 'Mouth-watering spiced mashed vegetable curry served with golden butter-toasted ladi pav and lemon wedges.', 30, 4, 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600&auto=format&fit=crop&q=80', 15.00, TRUE),
  ('b4444444-4444-4444-4444-444444444444', 'Royal Kadai Paneer', 'royal-kadai-paneer', 'North Indian', 'Succulent fresh paneer cubes cooked in a fragrant freshly ground coriander and red chili masala gravy.', 25, 4, 'https://images.unsplash.com/photo-1567184109191-3783b856947d?w=600&auto=format&fit=crop&q=80', 10.00, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Seed Bundle Ingredients
INSERT INTO recipe_bundle_items (recipe_id, sku, product_name, quantity, unit)
VALUES
  ('b1111111-1111-1111-1111-111111111111', 'TOMATO-HYB-1KG', 'Fresh Hybrid Tomatoes', 1, '1 kg'),
  ('b1111111-1111-1111-1111-111111111111', 'ONION-RED-1KG', 'Fresh Red Onions', 1, '1 kg'),
  ('b1111111-1111-1111-1111-111111111111', 'AMUL-BTR-100G', 'Amul Pasteurized Butter', 1, '100 g'),

  ('b2222222-2222-2222-2222-222222222222', 'MAGGI-NOODLE-4PK', 'Maggi 2-Minute Noodles / Pasta', 2, 'pack'),
  ('b2222222-2222-2222-2222-222222222222', 'AMUL-CHZ-200G', 'Amul Processed Cheese Block', 1, '200 g'),
  ('b2222222-2222-2222-2222-222222222222', 'TOMATO-HYB-1KG', 'Fresh Hybrid Tomatoes', 1, '1 kg'),

  ('b3333333-3333-3333-3333-333333333333', 'POTATO-1KG', 'Fresh Baby Potatoes', 1, '1 kg'),
  ('b3333333-3333-3333-3333-333333333333', 'TOMATO-HYB-1KG', 'Fresh Hybrid Tomatoes', 1, '1 kg'),
  ('b3333333-3333-3333-3333-333333333333', 'ONION-RED-1KG', 'Fresh Red Onions', 1, '1 kg'),
  ('b3333333-3333-3333-3333-333333333333', 'AMUL-BTR-100G', 'Amul Pasteurized Butter', 2, '100 g'),
  ('b3333333-3333-3333-3333-333333333333', 'BRD-WHT-400G', 'Fresh Whole Wheat Bread / Pav', 1, '400 g'),

  ('b4444444-4444-4444-4444-444444444444', 'AMUL-TAAZA-1L', 'Amul Taaza Fresh Toned Milk', 1, '1 L'),
  ('b4444444-4444-4444-4444-444444444444', 'TOMATO-HYB-1KG', 'Fresh Hybrid Tomatoes', 1, '1 kg'),
  ('b4444444-4444-4444-4444-444444444444', 'ONION-RED-1KG', 'Fresh Red Onions', 1, '1 kg')
ON CONFLICT DO NOTHING;

