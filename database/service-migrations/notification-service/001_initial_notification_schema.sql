-- ====================================================================
-- Service: Notification Service
-- Migration: 001_initial_notification_schema.sql
-- Description: Multi-channel delivery logs, templates, and opt-out preferences
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_status AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'OPTED_OUT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id VARCHAR(64) NOT NULL,
    recipient_address VARCHAR(128) NOT NULL, -- phone or email
    channel notification_channel NOT NULL,
    template_code VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status notification_status NOT NULL DEFAULT 'QUEUED',
    provider_message_id VARCHAR(128),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notification_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notification_logs(status);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id VARCHAR(64) PRIMARY KEY,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    opted_out_marketing BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
