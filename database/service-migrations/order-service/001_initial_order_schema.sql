-- ====================================================================
-- Service: Order Service
-- Migration: 001_initial_order_schema.sql
-- Description: Immutable order records, line item snapshots, idempotency keys, and saga state
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Order Status & Channel Enums
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'PENDING_CONFIRMATION',
        'AWAITING_PAYMENT',
        'CONFIRMED',
        'PICKING',
        'PACKED',
        'DISPATCHED',
        'DELIVERED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_channel AS ENUM ('WEB', 'WHATSAPP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Orders Master Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(32) NOT NULL UNIQUE,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE, -- Crucial for Scenario 2 (duplicate checkout protection)
    customer_id VARCHAR(64) NOT NULL,
    channel order_channel NOT NULL,
    status order_status NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    subtotal NUMERIC(12, 4) NOT NULL,
    discount_total NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    tax_total NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    delivery_fee NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    grand_total NUMERIC(12, 4) NOT NULL,
    reservation_id UUID NOT NULL,
    payment_intent_id VARCHAR(128),
    delivery_address JSONB NOT NULL,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);

-- 3. Immutable Order Items Snapshot
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    variant_name VARCHAR(150) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    unit_price NUMERIC(12, 4) NOT NULL,
    net_amount NUMERIC(12, 4) NOT NULL,
    tax_amount NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    CONSTRAINT chk_order_item_qty CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 4. Order Saga / Workflow Audit Log
CREATE TABLE IF NOT EXISTS order_saga_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    step VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'STARTED', 'COMPLETED', 'FAILED', 'COMPENSATING'
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_saga_order ON order_saga_log(order_id);
