-- ====================================================================
-- Service: Fulfillment Service
-- Migration: 002_delivery_partner_schema.sql
-- Description: Delivery rider assignments, live GPS tracking, and delivery milestones
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS delivery_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL,
    order_number VARCHAR(32) NOT NULL,
    rider_id VARCHAR(64) NOT NULL,
    rider_name VARCHAR(128) NOT NULL,
    rider_phone VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED', -- ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED, FAILED
    current_lat NUMERIC(10, 6) DEFAULT 12.914142,
    current_lng NUMERIC(10, 6) DEFAULT 77.641151,
    estimated_arrival_minutes INTEGER DEFAULT 12,
    delivery_address JSONB,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    proof_signature TEXT,
    proof_notes TEXT,
    delivery_otp VARCHAR(8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_order ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_rider ON delivery_assignments(rider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_assignments(status);

