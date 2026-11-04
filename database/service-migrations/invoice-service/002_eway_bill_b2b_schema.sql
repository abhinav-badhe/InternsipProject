-- ====================================================================
-- Service: Invoice Service
-- Migration: 002_eway_bill_b2b_schema.sql
-- Description: E-Way Bill Generation & B2B GST Invoicing (> ₹50,000 Compliance)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS eway_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    eway_bill_number VARCHAR(32) NOT NULL UNIQUE,
    invoice_id UUID,
    invoice_number VARCHAR(64) NOT NULL,
    order_id UUID NOT NULL,
    order_number VARCHAR(32) NOT NULL,
    supply_type VARCHAR(32) NOT NULL DEFAULT 'OUTWARD',
    sub_supply_type VARCHAR(32) NOT NULL DEFAULT 'SUPPLY',
    gstin_supplier VARCHAR(32) NOT NULL DEFAULT '29AABCF1234F1Z5',
    supplier_name VARCHAR(128) NOT NULL DEFAULT 'FreshCart Quick Commerce Pvt Ltd',
    gstin_recipient VARCHAR(32) NOT NULL,
    recipient_name VARCHAR(128) NOT NULL,
    from_pincode VARCHAR(10) NOT NULL DEFAULT '560102',
    to_pincode VARCHAR(10) NOT NULL,
    total_invoice_value NUMERIC(12, 2) NOT NULL,
    hsn_code VARCHAR(16) NOT NULL DEFAULT '1905',
    transporter_id VARCHAR(32) DEFAULT 'TRANS-DELHIVERY-01',
    transporter_name VARCHAR(128) DEFAULT 'FreshCart Hyperlocal Express Logistics',
    vehicle_number VARCHAR(32) DEFAULT 'KA-05-EQ-4412',
    approximate_distance_km INTEGER NOT NULL DEFAULT 8,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'CANCELLED', 'EXPIRED'
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day'),
    nic_portal_ack_number VARCHAR(64),
    qr_code_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eway_order ON eway_bills(order_id);
CREATE INDEX IF NOT EXISTS idx_eway_number ON eway_bills(eway_bill_number);
