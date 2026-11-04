-- ====================================================================
-- Service: Payment Service
-- Migration: 003_payment_gateway_and_splits_schema.sql
-- Description: Split payments ledger and payment gateway transaction tracking
-- ====================================================================

CREATE TABLE IF NOT EXISTS payment_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(64) NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    wallet_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gateway_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gateway_provider VARCHAR(32) NOT NULL DEFAULT 'RAZORPAY',
    gateway_order_id VARCHAR(128),
    gateway_payment_id VARCHAR(128),
    wallet_transaction_id UUID,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'FAILED', 'REFUNDED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_split_amounts CHECK (total_amount > 0 AND wallet_amount >= 0 AND gateway_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_splits_order ON payment_splits(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_customer ON payment_splits(customer_id);

