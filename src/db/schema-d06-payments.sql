-- D06 - BSV Overlay Network Payment Processing & Revenue Management
-- Enterprise Payment Platform with BRC Standards Integration

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enhanced overlay receipts table for overlay network payments
CREATE TABLE IF NOT EXISTS overlay_receipts (
    receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id TEXT NOT NULL, -- Keeping TEXT for compatibility with existing system
    content_hash VARCHAR(64) NOT NULL,
    payer_identity_key VARCHAR(66), -- BRC-31 identity verification
    payer_address VARCHAR(50) NOT NULL,
    producer_id TEXT REFERENCES producers(producer_id),
    agent_id TEXT REFERENCES agents(agent_id), -- For agent marketplace payments

    -- Payment details
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_satoshis BIGINT NOT NULL,
    total_satoshis BIGINT NOT NULL,
    pricing_tier VARCHAR(20) DEFAULT 'standard',
    currency_code VARCHAR(3) DEFAULT 'BSV',

    -- BSV transaction details
    payment_txid VARCHAR(64),
    payment_vout INTEGER,
    payment_script TEXT,
    confirmation_height INTEGER,
    spv_proof BYTEA, -- SPV proof for payment verification

    -- Overlay network integration
    overlay_topics TEXT[] DEFAULT '{}', -- BRC-22 topics for payment notification
    settlement_network VARCHAR(50) DEFAULT 'bsv-main',
    cross_network_ref UUID, -- For cross-network settlements

    -- Receipt lifecycle
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, settled, consumed, expired, refunded
    expires_at TIMESTAMP NOT NULL,
    confirmed_at TIMESTAMP,
    consumed_at TIMESTAMP,

    -- Usage tracking (for D07 integration)
    download_allowance BIGINT DEFAULT 1,
    downloads_used INTEGER DEFAULT 0,
    bytes_allowance BIGINT,
    bytes_used BIGINT DEFAULT 0,

    -- Revenue allocation
    producer_share_satoshis BIGINT,
    platform_fee_satoshis BIGINT,
    agent_commission_satoshis BIGINT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- BRC-31 identity verification for payments
CREATE TABLE IF NOT EXISTS payment_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_key VARCHAR(66) NOT NULL UNIQUE,
    identity_certificate TEXT, -- BRC-31 certificate chain
    verification_level VARCHAR(20) DEFAULT 'basic', -- basic, verified, premium
    trust_score DECIMAL(3,2) DEFAULT 1.0,
    payment_history_count INTEGER DEFAULT 0,
    total_payments_satoshis BIGINT DEFAULT 0,
    last_payment_at TIMESTAMP,
    reputation_score DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Revenue tracking and analytics
CREATE TABLE IF NOT EXISTS revenue_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES overlay_receipts(receipt_id),
    producer_id TEXT REFERENCES producers(producer_id),

    -- Revenue breakdown
    gross_revenue_satoshis BIGINT NOT NULL,
    platform_fee_satoshis BIGINT NOT NULL,
    agent_commission_satoshis BIGINT DEFAULT 0,
    net_revenue_satoshis BIGINT NOT NULL,

    -- Payment method and network
    payment_method VARCHAR(20) DEFAULT 'bsv',
    settlement_network VARCHAR(50) DEFAULT 'bsv-main',

    -- Time-based analytics
    revenue_date DATE NOT NULL,
    revenue_hour INTEGER NOT NULL, -- 0-23 for hourly analytics

    -- Geographic and category data
    content_category VARCHAR(50),
    payer_region VARCHAR(10), -- ISO country code
    agent_type VARCHAR(50), -- For agent marketplace analytics

    created_at TIMESTAMP DEFAULT NOW()
);

-- Payment method configurations
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    method_name VARCHAR(50) NOT NULL UNIQUE,
    network VARCHAR(50) NOT NULL, -- bsv-main, bsv-test, etc.
    is_active BOOLEAN DEFAULT TRUE,

    -- BSV-specific configuration
    wallet_public_key VARCHAR(66),
    derivation_path VARCHAR(100),
    min_confirmation_depth INTEGER DEFAULT 6,

    -- Fee configuration
    base_fee_satoshis BIGINT DEFAULT 0,
    percentage_fee DECIMAL(5,4) DEFAULT 0.0,

    -- Rate limiting
    max_amount_satoshis BIGINT,
    daily_limit_satoshis BIGINT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent payment authorization
CREATE TABLE IF NOT EXISTS agent_payment_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT REFERENCES agents(agent_id),
    authorized_by UUID REFERENCES payment_identities(id),

    -- Authorization limits
    max_payment_satoshis BIGINT NOT NULL,
    daily_limit_satoshis BIGINT NOT NULL,
    monthly_limit_satoshis BIGINT NOT NULL,

    -- Spending tracking
    daily_spent_satoshis BIGINT DEFAULT 0,
    monthly_spent_satoshis BIGINT DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,

    -- Authorization status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Cross-network settlement tracking
CREATE TABLE IF NOT EXISTS cross_network_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_batch_id UUID NOT NULL,
    source_network VARCHAR(50) NOT NULL,
    target_network VARCHAR(50) NOT NULL,

    -- Settlement details
    total_receipts INTEGER NOT NULL,
    total_amount_satoshis BIGINT NOT NULL,
    settlement_txid VARCHAR(64),
    settlement_fee_satoshis BIGINT,

    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', -- pending, broadcasting, confirmed, failed
    initiated_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,

    -- BRC-22 overlay integration
    overlay_notification_sent BOOLEAN DEFAULT FALSE,
    notification_topics TEXT[]
);

-- Payment events audit log
CREATE TABLE IF NOT EXISTS payment_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- payment-created, payment-confirmed, payment-consumed, etc.
    receipt_id UUID REFERENCES overlay_receipts(receipt_id),
    payment_txid VARCHAR(64),
    agent_id TEXT REFERENCES agents(agent_id),

    -- Event details
    details_json JSONB NOT NULL,
    overlay_topics TEXT[] DEFAULT '{}',

    -- BRC standards integration
    brc22_notification_sent BOOLEAN DEFAULT FALSE,
    brc31_identity_verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);

-- BSV blockchain integration
CREATE TABLE IF NOT EXISTS bsv_transactions (
    txid VARCHAR(64) PRIMARY KEY,
    raw_tx TEXT NOT NULL,
    block_hash VARCHAR(64),
    block_height INTEGER,
    confirmations INTEGER DEFAULT 0,

    -- SPV data
    merkle_proof BYTEA,
    block_header BYTEA,

    -- Processing status
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, invalid
    processed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent spending analytics
CREATE TABLE IF NOT EXISTS agent_spending_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT REFERENCES agents(agent_id),

    -- Time period
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- hourly, daily, weekly, monthly

    -- Spending metrics
    total_spent_satoshis BIGINT NOT NULL,
    transaction_count INTEGER NOT NULL,
    average_transaction_satoshis BIGINT NOT NULL,

    -- Budget utilization
    daily_budget_satoshis BIGINT,
    monthly_budget_satoshis BIGINT,
    budget_utilization_percent DECIMAL(5,2),

    -- Performance metrics
    successful_payments INTEGER DEFAULT 0,
    failed_payments INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2),

    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_version_id ON overlay_receipts(version_id);
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_payer_identity ON overlay_receipts(payer_identity_key);
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_status_expires ON overlay_receipts(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_payment_txid ON overlay_receipts(payment_txid);
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_agent_id ON overlay_receipts(agent_id);
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_created_at ON overlay_receipts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_log_producer_date ON revenue_log(producer_id, revenue_date);
CREATE INDEX IF NOT EXISTS idx_revenue_log_date_hour ON revenue_log(revenue_date, revenue_hour);
CREATE INDEX IF NOT EXISTS idx_revenue_log_receipt_id ON revenue_log(receipt_id);

CREATE INDEX IF NOT EXISTS idx_payment_identities_key ON payment_identities(identity_key);
CREATE INDEX IF NOT EXISTS idx_payment_identities_verification ON payment_identities(verification_level);

CREATE INDEX IF NOT EXISTS idx_agent_auth_agent_id ON agent_payment_authorizations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_auth_authorized_by ON agent_payment_authorizations(authorized_by);
CREATE INDEX IF NOT EXISTS idx_agent_auth_active ON agent_payment_authorizations(is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_settlements_batch_id ON cross_network_settlements(settlement_batch_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON cross_network_settlements(status, initiated_at);

CREATE INDEX IF NOT EXISTS idx_payment_events_receipt_id ON payment_events(receipt_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_type_created ON payment_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_agent_id ON payment_events(agent_id);

CREATE INDEX IF NOT EXISTS idx_bsv_transactions_block ON bsv_transactions(block_height DESC);
CREATE INDEX IF NOT EXISTS idx_bsv_transactions_status ON bsv_transactions(status);

CREATE INDEX IF NOT EXISTS idx_agent_spending_agent_period ON agent_spending_analytics(agent_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_agent_spending_period_type ON agent_spending_analytics(period_type, period_start DESC);

-- Views for common queries

-- Revenue analytics view
CREATE OR REPLACE VIEW revenue_analytics_daily AS
SELECT
    revenue_date,
    producer_id,
    content_category,
    payment_method,
    SUM(gross_revenue_satoshis) as daily_gross_revenue,
    SUM(net_revenue_satoshis) as daily_net_revenue,
    SUM(platform_fee_satoshis) as daily_platform_fees,
    SUM(agent_commission_satoshis) as daily_agent_commissions,
    COUNT(*) as transaction_count,
    COUNT(DISTINCT receipt_id) as unique_receipts
FROM revenue_log
GROUP BY revenue_date, producer_id, content_category, payment_method
ORDER BY revenue_date DESC;

-- Agent payment summary view
CREATE OR REPLACE VIEW agent_payment_summary AS
SELECT
    a.agent_id,
    a.name as agent_name,
    apa.max_payment_satoshis,
    apa.daily_limit_satoshis,
    apa.monthly_limit_satoshis,
    apa.daily_spent_satoshis,
    apa.monthly_spent_satoshis,
    apa.is_active,
    COALESCE(COUNT(or_table.receipt_id), 0) as total_payments,
    COALESCE(SUM(or_table.total_satoshis), 0) as total_spent_satoshis
FROM agents a
LEFT JOIN agent_payment_authorizations apa ON a.agent_id = apa.agent_id
LEFT JOIN overlay_receipts or_table ON a.agent_id = or_table.agent_id
WHERE apa.is_active = true OR apa.is_active IS NULL
GROUP BY a.agent_id, a.name, apa.max_payment_satoshis, apa.daily_limit_satoshis,
         apa.monthly_limit_satoshis, apa.daily_spent_satoshis, apa.monthly_spent_satoshis, apa.is_active;

-- Payment status overview
CREATE OR REPLACE VIEW payment_status_overview AS
SELECT
    status,
    COUNT(*) as count,
    SUM(total_satoshis) as total_amount_satoshis,
    AVG(total_satoshis) as average_amount_satoshis,
    MIN(created_at) as earliest_payment,
    MAX(created_at) as latest_payment
FROM overlay_receipts
GROUP BY status
ORDER BY count DESC;

-- Insert default payment method
INSERT INTO payment_methods (method_name, network, is_active, min_confirmation_depth, base_fee_satoshis, percentage_fee)
VALUES ('bsv', 'bsv-main', true, 6, 0, 0.0)
ON CONFLICT (method_name) DO NOTHING;

-- Insert default BRC-31 identity for testing/development
INSERT INTO payment_identities (identity_key, verification_level, trust_score)
VALUES ('02deadbeef1234567890abcdef1234567890abcdef1234567890abcdef123456', 'basic', 1.0)
ON CONFLICT (identity_key) DO NOTHING;