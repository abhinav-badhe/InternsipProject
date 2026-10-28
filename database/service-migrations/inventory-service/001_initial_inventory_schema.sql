-- ====================================================================
-- Service: Inventory Service
-- Migration: 001_initial_inventory_schema.sql
-- Description: Concurrency-safe stock balances, movement ledger, and reservations
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Stock Locations (Stores / Dark stores / Warehouses)
CREATE TABLE IF NOT EXISTS stock_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Stock Balances Table (Current balance projection per SKU and location)
-- Rule: Sellable = on_hand - reserved. Must never drop below zero.
CREATE TABLE IF NOT EXISTS stock_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE RESTRICT,
    sku VARCHAR(64) NOT NULL,
    on_hand_qty NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    reserved_qty NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_on_hand_non_negative CHECK (on_hand_qty >= 0),
    CONSTRAINT chk_reserved_non_negative CHECK (reserved_qty >= 0),
    CONSTRAINT chk_sellable_non_negative CHECK (on_hand_qty >= reserved_qty),
    UNIQUE(location_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_sku ON stock_balances(sku);

-- 3. Append-only Stock Movement Ledger
CREATE TABLE IF NOT EXISTS stock_movement_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE RESTRICT,
    sku VARCHAR(64) NOT NULL,
    quantity_delta NUMERIC(12, 3) NOT NULL,
    balance_after NUMERIC(12, 3) NOT NULL,
    reason VARCHAR(30) NOT NULL, -- 'RECEIPT', 'SALE', 'ADJUSTMENT', 'DAMAGE', 'EXPIRED', 'RETURN'
    reference_id VARCHAR(64),
    actor VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_sku_time ON stock_movement_ledger(sku, created_at DESC);

-- 4. Stock Reservations Table
CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY,
    order_id VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED'
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_valid_status CHECK (status IN ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_status_expiry ON stock_reservations(status, expires_at);

-- 5. Reservation Items Table
CREATE TABLE IF NOT EXISTS stock_reservation_items (
    reservation_id UUID NOT NULL REFERENCES stock_reservations(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE RESTRICT,
    sku VARCHAR(64) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    PRIMARY KEY(reservation_id, sku),
    CONSTRAINT chk_reservation_qty_positive CHECK (quantity > 0)
);
