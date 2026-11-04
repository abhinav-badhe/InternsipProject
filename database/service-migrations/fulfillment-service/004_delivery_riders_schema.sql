-- ====================================================================
-- Service: Fulfillment Service
-- Migration: 004_delivery_riders_schema.sql
-- Description: Real-world Rider Fleet schema, Shopkeeper onboarding, and Rider Auth
-- ====================================================================

CREATE TABLE IF NOT EXISTS delivery_riders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(128) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'OFFLINE', -- 'OFFLINE', 'ONLINE', 'ON_DELIVERY', 'ON_BREAK'
    vehicle_type VARCHAR(32) NOT NULL DEFAULT 'EV_2W', -- 'EV_2W', 'MOTORCYCLE', 'BICYCLE'
    vehicle_number VARCHAR(32) NOT NULL,
    driving_license VARCHAR(64) NOT NULL,
    dark_store_id UUID,
    dark_store_name VARCHAR(128) DEFAULT 'Dark Store #04 - HSR Sector 2',
    kyc_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED', -- 'PENDING', 'VERIFIED', 'REJECTED'
    current_lat NUMERIC(10, 6) DEFAULT 12.914142,
    current_lng NUMERIC(10, 6) DEFAULT 77.641151,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    total_orders_completed INTEGER DEFAULT 0,
    earnings_today NUMERIC(10, 2) DEFAULT 0.00,
    cod_collected_today NUMERIC(10, 2) DEFAULT 0.00,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    pin_code VARCHAR(6) DEFAULT '1234',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riders_phone ON delivery_riders(phone);
CREATE INDEX IF NOT EXISTS idx_riders_status ON delivery_riders(status);

ALTER TABLE delivery_assignments 
    ADD COLUMN IF NOT EXISTS rider_uuid UUID REFERENCES delivery_riders(id);

-- Seed initial fleet riders if none exist
INSERT INTO delivery_riders (id, full_name, phone, email, status, vehicle_type, vehicle_number, driving_license, dark_store_name, pin_code, rating, total_orders_completed, earnings_today)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'Rahul Sharma', '+91 98765 00112', 'rahul.rider@freshcart.in', 'ONLINE', 'EV_2W', 'KA-05-EQ-4412', 'DL-04-2022-88192', 'Dark Store #04 - HSR Sector 2', '1234', 4.90, 8, 760.00),
    ('a0000000-0000-0000-0000-000000000002', 'Vikram Singh', '+91 98765 00113', 'vikram.rider@freshcart.in', 'OFFLINE', 'MOTORCYCLE', 'KA-01-AB-1299', 'DL-01-2021-44710', 'Dark Store #04 - HSR Sector 2', '1234', 4.85, 5, 450.00)
ON CONFLICT (phone) DO UPDATE 
SET updated_at = NOW();
