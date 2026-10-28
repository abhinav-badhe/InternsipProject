-- ====================================================================
-- Service: Payment Service
-- Migration: 001_initial_payment_schema.sql
-- Description: Payment attempts, provider event deduplication, and refund ledger
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Payment Attempts Table
CREATE TABLE IF NOT EXISTS payment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(64) NOT NULL,
    provider_session_id VARCHAR(128) NOT NULL UNIQUE,
    provider_payment_id VARCHAR(128),
    amount NUMERIC(12, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED'
    provider_signature VARCHAR(256),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_positive_payment_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_order ON payment_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_session ON payment_attempts(provider_session_id);

-- 2. Webhook Event Deduplication Table (Acceptance Scenario 3 & Deduplication)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    provider_event_id VARCHAR(128) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Refunds Table
CREATE TABLE IF NOT EXISTS payment_refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_attempt_id UUID NOT NULL REFERENCES payment_attempts(id) ON DELETE RESTRICT,
    order_id VARCHAR(64) NOT NULL,
    refund_amount NUMERIC(12, 4) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'INITIATED', -- 'INITIATED', 'SUCCEEDED', 'FAILED'
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_positive_refund CHECK (refund_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON payment_refunds(order_id);
