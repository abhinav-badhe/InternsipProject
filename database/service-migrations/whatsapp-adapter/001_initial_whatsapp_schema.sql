-- ====================================================================
-- Service: WhatsApp Adapter
-- Migration: 001_initial_whatsapp_schema.sql
-- Description: Message deduplication, conversational session state, and message history
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Processed Message Deduplication Table (Acceptance Scenario 8)
-- Prevents duplicate orders if Meta or network retransmits webhooks
CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (
    message_id VARCHAR(128) PRIMARY KEY,
    from_phone VARCHAR(32) NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_messages_time ON whatsapp_processed_messages(processed_at DESC);

-- 2. WhatsApp Conversational Session State
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(32) NOT NULL UNIQUE,
    customer_id VARCHAR(64),
    stage VARCHAR(32) NOT NULL DEFAULT 'IDLE',
    cart_items JSONB NOT NULL DEFAULT '[]'::JSONB,
    pending_context JSONB,
    last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);

-- 3. Durable Conversation Message History
CREATE TABLE IF NOT EXISTS whatsapp_conversation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES whatsapp_sessions(session_id) ON DELETE CASCADE,
    direction VARCHAR(8) NOT NULL, -- 'INBOUND', 'OUTBOUND'
    message_type VARCHAR(32) NOT NULL, -- 'text', 'interactive_button', 'interactive_list', 'template'
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_history_session ON whatsapp_conversation_history(session_id, created_at DESC);
