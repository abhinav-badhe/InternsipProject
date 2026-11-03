-- ====================================================================
-- Service: Identity & Access Service
-- Migration: 002_mfa_schema.sql
-- Description: Multi-Factor Authentication (MFA / 2FA OTP) challenges and user MFA preference
-- ====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(64);

CREATE TABLE IF NOT EXISTS mfa_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket VARCHAR(64) UNIQUE NOT NULL,
    otp_code VARCHAR(16) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_ticket ON mfa_challenges(ticket);
CREATE INDEX IF NOT EXISTS idx_mfa_user ON mfa_challenges(user_id);

