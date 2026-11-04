-- ====================================================================
-- Service: Fulfillment Service
-- Migration: 003_wave_fulfillment_schema.sql
-- Description: Dark Store Batch Picking & Wave Fulfillment
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS fulfillment_waves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wave_number VARCHAR(32) NOT NULL UNIQUE,
    zone VARCHAR(64) NOT NULL DEFAULT 'ZONE_A',
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNED', -- 'PLANNED', 'IN_PROGRESS', 'COMPLETED'
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_items INTEGER NOT NULL DEFAULT 0,
    picker_id VARCHAR(64),
    picker_name VARCHAR(128),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wave_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wave_id UUID NOT NULL REFERENCES fulfillment_waves(id) ON DELETE CASCADE,
    order_id UUID NOT NULL,
    order_number VARCHAR(32) NOT NULL,
    tote_number VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wave_pick_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wave_id UUID NOT NULL REFERENCES fulfillment_waves(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    product_name VARCHAR(128) NOT NULL,
    total_quantity_requested INTEGER NOT NULL DEFAULT 1,
    quantity_picked INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PICKED'
    aisle_bay VARCHAR(32) DEFAULT 'A-01-R',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wave_status ON fulfillment_waves(status);
CREATE INDEX IF NOT EXISTS idx_wave_orders_wave ON wave_orders(wave_id);
CREATE INDEX IF NOT EXISTS idx_wave_items_wave ON wave_pick_items(wave_id);
