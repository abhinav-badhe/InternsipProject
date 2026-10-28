-- ====================================================================
-- Service: Analytics & Predictive ML Service
-- Migration: 001_initial_analytics_schema.sql
-- Description: Aggregated daily SKU demand, ML forecast predictions, and stockout alerts
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Daily SKU Demand Aggregates (Populated by domain events - zero cross-service OLTP joins)
CREATE TABLE IF NOT EXISTS daily_sku_demand (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) NOT NULL,
    date DATE NOT NULL,
    units_sold INTEGER NOT NULL DEFAULT 0,
    gross_revenue NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    units_cancelled INTEGER NOT NULL DEFAULT 0,
    stockout_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (sku, date)
);

CREATE INDEX IF NOT EXISTS idx_demand_sku_date ON daily_sku_demand(sku, date);

-- 2. Forecast Predictions (Acceptance Scenario 15: Tags model version and data freshness)
CREATE TABLE IF NOT EXISTS forecast_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) NOT NULL,
    forecast_date DATE NOT NULL,
    predicted_demand_units NUMERIC(10, 2) NOT NULL,
    confidence_interval_lower NUMERIC(10, 2) NOT NULL,
    confidence_interval_upper NUMERIC(10, 2) NOT NULL,
    model_version VARCHAR(32) NOT NULL, -- e.g. 'v1.0.0-baseline-ma7'
    training_window_days INTEGER NOT NULL DEFAULT 30,
    data_freshness_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (sku, forecast_date, model_version)
);

CREATE INDEX IF NOT EXISTS idx_forecast_sku ON forecast_predictions(sku, forecast_date);

-- 3. Stockout Risk Alerts
CREATE TABLE IF NOT EXISTS stockout_risk_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) NOT NULL,
    current_authoritative_stock INTEGER NOT NULL,
    daily_burn_rate NUMERIC(10, 2) NOT NULL,
    days_of_supply NUMERIC(10, 2) NOT NULL,
    supplier_lead_time_days INTEGER NOT NULL,
    risk_level VARCHAR(16) NOT NULL, -- 'LOW', 'MEDIUM', 'CRITICAL'
    recommended_reorder_units INTEGER NOT NULL,
    model_version VARCHAR(32) NOT NULL,
    data_freshness_timestamp TIMESTAMPTZ NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stockout_risk_level ON stockout_risk_alerts(risk_level, resolved);
