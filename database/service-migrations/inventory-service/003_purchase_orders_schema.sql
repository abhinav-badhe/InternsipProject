-- ====================================================================
-- Service: Inventory Service
-- Migration: 003_purchase_orders_schema.sql
-- Description: Automated Purchase Orders (PO) and Supplier Management
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    contact_person VARCHAR(128),
    phone VARCHAR(32),
    email VARCHAR(128),
    lead_time_days INTEGER DEFAULT 2,
    rating NUMERIC(2, 1) DEFAULT 4.8,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Purchase Orders Header
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(32) NOT NULL UNIQUE,
    supplier_id UUID REFERENCES suppliers(id),
    supplier_name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'ISSUED', 'RECEIVED', 'CANCELLED'
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    item_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    issued_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    suggested_qty NUMERIC(12, 3) NOT NULL,
    ordered_qty NUMERIC(12, 3) NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL,
    line_total NUMERIC(12, 2) NOT NULL,
    received_qty NUMERIC(12, 3) DEFAULT 0.000,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
