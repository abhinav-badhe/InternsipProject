-- Preserve existing subscriptions while enabling per-channel, retry-safe creation.
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS channel VARCHAR(16) NOT NULL DEFAULT 'WEB';
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS creation_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_creation_key ON customer_subscriptions(creation_key);
