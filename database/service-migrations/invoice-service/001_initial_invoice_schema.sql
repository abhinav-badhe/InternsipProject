-- ====================================================================
-- Service: Invoice Service
-- Migration: 001_initial_invoice_schema.sql
-- Description: Sequential tax-compliant invoices, lines, and secure access audit log
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Sequential Invoice Number Generator
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 10001 INCREMENT BY 1;

-- 2. Invoices Master Table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(32) NOT NULL UNIQUE, -- e.g. INV-2026-10001
    order_id UUID NOT NULL UNIQUE,
    order_number VARCHAR(32) NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(128) NOT NULL,
    customer_gstin VARCHAR(32),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    subtotal NUMERIC(12, 4) NOT NULL,
    discount_total NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    cgst_total NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    sgst_total NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    delivery_fee NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    grand_total NUMERIC(12, 4) NOT NULL,
    pdf_storage_key VARCHAR(255) NOT NULL,
    is_signed BOOLEAN NOT NULL DEFAULT TRUE,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);

-- 3. Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    description VARCHAR(255) NOT NULL,
    hsn_code VARCHAR(16) NOT NULL DEFAULT '3401',
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12, 4) NOT NULL,
    discount_amount NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    taxable_amount NUMERIC(12, 4) NOT NULL,
    gst_rate_percent NUMERIC(5, 2) NOT NULL,
    cgst_amount NUMERIC(12, 4) NOT NULL,
    sgst_amount NUMERIC(12, 4) NOT NULL,
    line_total NUMERIC(12, 4) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoicelines_invoice ON invoice_lines(invoice_id);

-- 4. Invoice Access Audit Log (Scenario 14 security verification)
CREATE TABLE IF NOT EXISTS invoice_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    accessed_by_user_id VARCHAR(64) NOT NULL,
    user_role VARCHAR(32) NOT NULL,
    access_type VARCHAR(32) NOT NULL, -- 'GENERATE_SIGNED_URL', 'DOWNLOAD'
    ip_address VARCHAR(45),
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);
