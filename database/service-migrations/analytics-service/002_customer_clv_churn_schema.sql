-- ====================================================================
-- Service: Analytics & Predictive ML Service
-- Migration: 002_customer_clv_churn_schema.sql
-- Description: Customer Lifetime Value (CLV) and Churn Risk Prediction (RFM Analytics)
-- ====================================================================

CREATE TABLE IF NOT EXISTS customer_clv_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id VARCHAR(64) NOT NULL UNIQUE,
    customer_name VARCHAR(128) NOT NULL DEFAULT 'FreshCart Shopper',
    customer_phone VARCHAR(32),
    total_orders INTEGER NOT NULL DEFAULT 1,
    total_spend NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    average_order_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    days_since_last_order INTEGER NOT NULL DEFAULT 0,
    predicted_monthly_orders NUMERIC(5, 2) NOT NULL DEFAULT 3.50,
    predicted_annual_clv NUMERIC(12, 2) NOT NULL DEFAULT 12000.00,
    churn_probability NUMERIC(4, 2) NOT NULL DEFAULT 0.15,
    churn_risk_level VARCHAR(16) NOT NULL DEFAULT 'LOW', -- 'LOW', 'MEDIUM', 'HIGH'
    segment VARCHAR(32) NOT NULL DEFAULT 'LOYAL_REGULAR', -- 'VIP_CHAMPION', 'LOYAL_REGULAR', 'AT_RISK', 'HIBERNATING', 'NEW'
    recommended_action TEXT,
    last_order_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clv_churn_risk ON customer_clv_predictions(churn_risk_level);
CREATE INDEX IF NOT EXISTS idx_clv_segment ON customer_clv_predictions(segment);

-- Seed realistic predictive customer profiles
INSERT INTO customer_clv_predictions (
  customer_id, customer_name, customer_phone, total_orders, total_spend, average_order_value,
  days_since_last_order, predicted_monthly_orders, predicted_annual_clv, churn_probability,
  churn_risk_level, segment, recommended_action, last_order_at
)
VALUES
  ('cust_101', 'Priya Sharma', '+91 98111 22334', 18, 9840.00, 546.67, 2, 8.5, 52480.00, 0.05, 'LOW', 'VIP_CHAMPION', 'VIP Priority delivery & complimentary samples', NOW() - INTERVAL '2 days'),
  ('cust_102', 'Rahul Verma', '+91 98222 33445', 9, 3915.00, 435.00, 5, 4.2, 21924.00, 0.12, 'LOW', 'LOYAL_REGULAR', 'Morning milk subscription prompt', NOW() - INTERVAL '5 days'),
  ('cust_103', 'Ananya Patel', '+91 98333 44556', 5, 2450.00, 490.00, 16, 1.8, 10584.00, 0.48, 'MEDIUM', 'AT_RISK', 'Send ₹50 reactivate coupon: WELCOME50', NOW() - INTERVAL '16 days'),
  ('cust_104', 'Vikram Malhotra', '+91 98444 55667', 3, 1180.00, 393.33, 34, 0.5, 2360.00, 0.85, 'HIGH', 'HIBERNATING', 'Automated WhatsApp "We miss you" reminder with free delivery', NOW() - INTERVAL '34 days'),
  ('cust_demo', 'Abhinav Badhe', '+91 98765 43210', 6, 2890.00, 481.67, 1, 6.0, 34680.00, 0.08, 'LOW', 'VIP_CHAMPION', 'Referral program ambassador invite', NOW() - INTERVAL '1 day')
ON CONFLICT (customer_id) DO NOTHING;

