-- ====================================================================
-- Service: Fulfillment Service
-- Migration: 001_initial_fulfillment_schema.sql
-- Description: Pick lists, FEFO rotation, substitution proposals, and dispatches
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Status Enums
DO $$ BEGIN
    CREATE TYPE pick_list_status AS ENUM ('GENERATED', 'ASSIGNED', 'PICKING', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pick_item_status AS ENUM ('PENDING', 'PICKED', 'SUBSTITUTION_PROPOSED', 'SUBSTITUTED', 'OUT_OF_STOCK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE substitution_status AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Pick Lists
CREATE TABLE IF NOT EXISTS pick_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL,
    order_number VARCHAR(32) NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    assigned_picker_id VARCHAR(64),
    status pick_list_status NOT NULL DEFAULT 'GENERATED',
    zone VARCHAR(32) NOT NULL DEFAULT 'MAIN_STORE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_picklist_order ON pick_lists(order_id);
CREATE INDEX IF NOT EXISTS idx_picklist_status ON pick_lists(status);

-- 3. Pick Items
CREATE TABLE IF NOT EXISTS pick_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity_requested INTEGER NOT NULL,
    quantity_picked INTEGER NOT NULL DEFAULT 0,
    batch_number VARCHAR(64),
    expiry_date DATE,
    status pick_item_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickitems_picklist ON pick_items(pick_list_id);

-- 4. Substitution Proposals (Scenario 10 integration)
CREATE TABLE IF NOT EXISTS substitution_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pick_item_id UUID NOT NULL REFERENCES pick_items(id) ON DELETE CASCADE,
    pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
    original_sku VARCHAR(64) NOT NULL,
    proposed_sku VARCHAR(64) NOT NULL,
    proposed_product_name VARCHAR(255) NOT NULL,
    price_delta NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status substitution_status NOT NULL DEFAULT 'PENDING_APPROVAL',
    customer_decision_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_substitutions_status ON substitution_proposals(status);
