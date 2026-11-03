-- ====================================================================
-- Service: Order Service
-- Migration: 003_customer_subscriptions_schema.sql
-- Description: Recurring daily milk & essentials subscriptions
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_number VARCHAR(32) NOT NULL UNIQUE,
    customer_id VARCHAR(64) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    variant_name VARCHAR(128) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    frequency VARCHAR(32) NOT NULL DEFAULT 'DAILY', -- 'DAILY', 'ALTERNATE_DAYS', 'WEEKDAYS_ONLY', 'WEEKLY'
    delivery_slot VARCHAR(64) NOT NULL DEFAULT '07:00 AM - 09:00 AM',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'CANCELLED'
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    next_delivery_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
    delivery_address JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_customer_id ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subs_status_next_date ON customer_subscriptions(status, next_delivery_date);
