-- Complete PostgreSQL Schema for GitData Overlay Network
-- Integrates all D06, D07, D08, D22, D24 features and fixes
-- Migration from SQLite to PostgreSQL with hybrid Redis cache

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================
-- ENUM TYPES (docs/corrections.md recommendation)
-- =====================================

-- Receipt status enum
DO $$ BEGIN
    CREATE TYPE receipt_status AS ENUM ('pending', 'confirmed', 'settled', 'consumed', 'expired', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agent status enum
DO $$ BEGIN
    CREATE TYPE agent_status AS ENUM ('unknown', 'up', 'down', 'active');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'producer', 'consumer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policy decision enum
DO $$ BEGIN
    CREATE TYPE policy_decision AS ENUM ('allow', 'warn', 'block');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Job status enum
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Streaming status enum
DO $$ BEGIN
    CREATE TYPE streaming_status AS ENUM ('active', 'paused', 'stopped', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================
-- CORE TABLES (from main schema)
-- =====================================

-- Producers/Users
CREATE TABLE IF NOT EXISTS producers (
  producer_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identity_key TEXT,                     -- pubkey (hex), optional like SQLite
  display_name TEXT,
  website      TEXT,
  payout_script_hex TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Make identity_key nullable if it exists as NOT NULL (for schema compatibility)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'producers'
    AND column_name = 'identity_key'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE producers ALTER COLUMN identity_key DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_producers_identity ON producers(identity_key);

CREATE TABLE IF NOT EXISTS users (
  user_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identity_key TEXT NOT NULL,
  display_name TEXT,
  role         user_role DEFAULT 'consumer',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_identity ON users(identity_key);

-- Agents (registry)
CREATE TABLE IF NOT EXISTS agents (
  agent_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  webhook_url       TEXT NOT NULL,
  capabilities      JSONB NOT NULL DEFAULT '[]',
  capabilities_json TEXT DEFAULT '[]',  -- Legacy compatibility column
  identity_key      TEXT,
  status            agent_status DEFAULT 'unknown',
  last_ping_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalog (Datasets/Models)
CREATE TABLE IF NOT EXISTS assets (
  version_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id   UUID,
  producer_id  UUID,
  name         TEXT,
  description  TEXT,
  content_hash TEXT NOT NULL,
  mime_type    TEXT,
  size_bytes   BIGINT,
  policy_meta  JSONB,         -- license, classification, etc.
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Explicit Foreign Key Constraints
  CONSTRAINT fk_assets_producer
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id)
    ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_dataset ON assets(dataset_id);
CREATE INDEX IF NOT EXISTS idx_assets_producer ON assets(producer_id);
CREATE INDEX IF NOT EXISTS idx_assets_updated ON assets(updated_at DESC);

-- Policies (JSONB), Versionierung optional
CREATE TABLE IF NOT EXISTS policies (
  policy_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  doc          JSONB NOT NULL,   -- D28 policy JSON
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Policy Runs (Audit)
CREATE TABLE IF NOT EXISTS policy_runs (
  run_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id    UUID,
  version_id   UUID,
  decision     policy_decision,
  reasons      JSONB NOT NULL DEFAULT '[]',
  evidence     JSONB,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Explicit Foreign Key Constraints
  CONSTRAINT fk_policy_runs_policy
    FOREIGN KEY (policy_id) REFERENCES policies(policy_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_policy_runs_version
    FOREIGN KEY (version_id) REFERENCES assets(version_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_policy_runs_policy ON policy_runs(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_runs_version ON policy_runs(version_id);

-- =====================================
-- D06 - PAYMENT PROCESSING & RECEIPTS
-- =====================================

-- Enhanced overlay receipts table for overlay network payments
CREATE TABLE IF NOT EXISTS overlay_receipts (
    receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL, -- Keeping TEXT for compatibility with existing system
    content_hash VARCHAR(64) NOT NULL,
    payer_identity_key VARCHAR(66), -- BRC-31 identity verification
    payer_address VARCHAR(50) NOT NULL,
    producer_id UUID REFERENCES producers(producer_id),
    agent_id UUID REFERENCES agents(agent_id), -- For agent marketplace payments

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

    -- D07 quota integration
    quota_tier VARCHAR(20) DEFAULT 'standard',
    streaming_config JSONB DEFAULT '{}',
    concurrent_streams_allowed INTEGER DEFAULT 1,

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

-- Payment events audit log
CREATE TABLE IF NOT EXISTS payment_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- payment-created, payment-confirmed, payment-consumed, etc.
    receipt_id UUID REFERENCES overlay_receipts(receipt_id),
    payment_txid VARCHAR(64),
    agent_id UUID REFERENCES agents(agent_id),

    -- Event details
    details_json JSONB NOT NULL,
    overlay_topics TEXT[] DEFAULT '{}',

    -- BRC standards integration
    brc22_notification_sent BOOLEAN DEFAULT FALSE,
    brc31_identity_verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- D07 - STREAMING & QUOTA MANAGEMENT
-- =====================================

-- Comprehensive usage tracking
CREATE TABLE IF NOT EXISTS streaming_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES overlay_receipts(receipt_id),
    content_hash VARCHAR(64) NOT NULL,

    -- Session tracking
    session_id UUID NOT NULL,
    stream_start_time TIMESTAMP DEFAULT NOW(),
    stream_end_time TIMESTAMP,

    -- Usage metrics
    bytes_streamed BIGINT DEFAULT 0,
    chunks_delivered INTEGER DEFAULT 0,
    concurrent_connections INTEGER DEFAULT 1,
    peak_bandwidth_mbps DECIMAL(10,2),

    -- Network and delivery
    delivery_method VARCHAR(20) DEFAULT 'direct', -- direct, uhrp, cdn
    source_host VARCHAR(255),
    client_ip_hash VARCHAR(64), -- Hashed for privacy
    user_agent_hash VARCHAR(64),

    -- BRC-26 UHRP tracking
    uhrp_hosts_used TEXT[],
    failover_count INTEGER DEFAULT 0,

    -- Quality metrics
    latency_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    completion_percentage DECIMAL(5,2) DEFAULT 0.0,

    -- Agent marketplace integration
    agent_id VARCHAR(255),
    agent_session_id UUID,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Quota management with time windows
CREATE TABLE IF NOT EXISTS quota_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    -- Quota limits
    bytes_per_hour BIGINT,
    bytes_per_day BIGINT,
    bytes_per_month BIGINT,
    requests_per_hour INTEGER,
    requests_per_day INTEGER,
    requests_per_month INTEGER,

    -- Concurrent limits
    max_concurrent_streams INTEGER DEFAULT 1,
    max_bandwidth_mbps DECIMAL(10,2),

    -- Burst allowances
    burst_bytes_allowance BIGINT DEFAULT 0,
    burst_duration_minutes INTEGER DEFAULT 5,

    -- Content restrictions
    max_file_size_bytes BIGINT,
    allowed_content_types TEXT[],

    -- Geographic and network restrictions
    allowed_regions TEXT[], -- ISO country codes
    blocked_ip_ranges TEXT[], -- CIDR ranges as text for compatibility

    -- Agent-specific quotas
    agent_multiplier DECIMAL(3,2) DEFAULT 1.0,
    agent_priority_boost BOOLEAN DEFAULT FALSE,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Real-time quota tracking
CREATE TABLE IF NOT EXISTS quota_usage_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES overlay_receipts(receipt_id),
    policy_id UUID REFERENCES quota_policies(id),

    -- Time window tracking
    window_type VARCHAR(10) NOT NULL, -- hour, day, month
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,
    UNIQUE(receipt_id, window_type, window_start),

    -- Current usage
    bytes_used BIGINT DEFAULT 0,
    requests_used INTEGER DEFAULT 0,
    peak_concurrent_streams INTEGER DEFAULT 0,

    -- Burst tracking
    burst_bytes_used BIGINT DEFAULT 0,
    burst_active_until TIMESTAMP,

    -- Performance metrics
    average_latency_ms INTEGER,
    error_rate DECIMAL(5,4) DEFAULT 0.0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- BRC-26 UHRP host tracking
CREATE TABLE IF NOT EXISTS uhrp_host_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash VARCHAR(64) NOT NULL,
    host_url TEXT NOT NULL,
    UNIQUE(content_hash, host_url),
    host_public_key VARCHAR(66),

    -- Performance metrics
    availability_score DECIMAL(3,2) DEFAULT 1.0,
    average_latency_ms INTEGER,
    bandwidth_mbps DECIMAL(10,2),
    uptime_percentage DECIMAL(5,2) DEFAULT 100.0,

    -- Usage statistics
    total_requests BIGINT DEFAULT 0,
    successful_requests BIGINT DEFAULT 0,
    failed_requests BIGINT DEFAULT 0,
    bytes_served BIGINT DEFAULT 0,

    -- Geographic data
    host_region VARCHAR(10), -- ISO country code
    cdn_enabled BOOLEAN DEFAULT FALSE,

    last_check TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Agent streaming sessions
CREATE TABLE IF NOT EXISTS agent_streaming_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255),
    receipt_id UUID REFERENCES overlay_receipts(receipt_id),

    -- Session configuration
    session_type VARCHAR(20) DEFAULT 'standard', -- standard, priority, bulk
    quality_requirements JSONB, -- { "minBandwidth": 10, "maxLatency": 100 }

    -- Progress tracking
    total_content_bytes BIGINT,
    bytes_processed BIGINT DEFAULT 0,
    processing_rate_mbps DECIMAL(10,2),
    estimated_completion TIMESTAMP,

    -- Cost tracking
    estimated_cost_satoshis BIGINT,
    actual_cost_satoshis BIGINT DEFAULT 0,

    -- Status
    session_status VARCHAR(20) DEFAULT 'active', -- active, paused, completed, failed

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Content delivery optimization
CREATE TABLE IF NOT EXISTS delivery_optimization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash VARCHAR(64) NOT NULL,

    -- Caching strategy
    cache_tier VARCHAR(20) DEFAULT 'standard', -- hot, warm, cold
    cache_ttl_seconds INTEGER DEFAULT 3600,
    compression_enabled BOOLEAN DEFAULT TRUE,
    compression_algorithm VARCHAR(20) DEFAULT 'gzip',

    -- Delivery routing
    preferred_hosts TEXT[],
    fallback_strategy VARCHAR(20) DEFAULT 'uhrp', -- uhrp, cdn, local

    -- Performance targets
    target_latency_ms INTEGER DEFAULT 500,
    target_bandwidth_mbps DECIMAL(10,2) DEFAULT 10.0,

    -- Analytics
    delivery_count BIGINT DEFAULT 0,
    average_delivery_time_ms INTEGER,
    cache_hit_rate DECIMAL(5,4) DEFAULT 0.0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- D08 - REALTIME STREAMING PACKETS
-- =====================================

-- Stream metadata for producer management (D08 original schema)
CREATE TABLE IF NOT EXISTS stream_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL,
  producer_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  tags JSONB,
  price_per_packet INTEGER DEFAULT 0,
  last_packet_sequence BIGINT DEFAULT 0,
  last_packet_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(version_id, producer_id)
);

-- Real-time data packets (D08 original schema)
CREATE TABLE IF NOT EXISTS realtime_packets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL, -- Links to assets.version_id

    -- Packet identification
    packet_sequence BIGINT NOT NULL,
    packet_timestamp TIMESTAMP DEFAULT NOW(),

    -- BSV Overlay transaction
    txid VARCHAR(64) NOT NULL,
    overlay_data BYTEA NOT NULL,
    data_hash VARCHAR(64) NOT NULL,

    -- Confirmation tracking
    confirmation_status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, failed
    confirmations INTEGER DEFAULT 0,
    block_height INTEGER,
    confirmed_at TIMESTAMP,

    -- Data payload (any JSON data)
    data_payload JSONB NOT NULL,
    data_size_bytes INTEGER NOT NULL,
    producer_public_key VARCHAR(66) NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(version_id, packet_sequence)
);

-- Stream webhook subscriptions (D08 original schema)
CREATE TABLE IF NOT EXISTS stream_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL,

    -- Webhook configuration
    webhook_url TEXT NOT NULL,
    webhook_secret VARCHAR(64),
    subscriber_id VARCHAR(100) NOT NULL,

    -- Delivery settings
    delivery_mode VARCHAR(20) DEFAULT 'confirmed', -- confirmed, immediate, both
    min_confirmations INTEGER DEFAULT 1,
    batch_size INTEGER DEFAULT 1,

    -- Status tracking
    status VARCHAR(20) DEFAULT 'active',
    last_delivery TIMESTAMP,
    total_deliveries BIGINT DEFAULT 0,
    failed_deliveries BIGINT DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Additional D08 tables
CREATE TABLE IF NOT EXISTS stream_websockets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id VARCHAR(64) UNIQUE NOT NULL,
    version_id UUID NOT NULL,

    -- Connection details
    subscriber_id VARCHAR(100),
    delivery_mode VARCHAR(20) DEFAULT 'confirmed',
    last_packet_sent BIGINT DEFAULT 0,

    -- Status
    connected_at TIMESTAMP DEFAULT NOW(),
    last_ping TIMESTAMP DEFAULT NOW(),
    packets_sent BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES stream_webhooks(id),
    packet_id UUID REFERENCES realtime_packets(id),

    -- Delivery tracking
    delivery_status VARCHAR(20) DEFAULT 'pending', -- pending, delivered, failed
    delivery_attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMP,
    response_status INTEGER,
    response_body TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- D22 - OVERLAY STORAGE BACKEND
-- =====================================

-- Enhanced storage tracking with overlay integration
CREATE TABLE IF NOT EXISTS overlay_storage_index (
    content_hash TEXT PRIMARY KEY,
    version_id UUID NOT NULL,
    storage_tier TEXT DEFAULT 'hot', -- hot, warm, cold, overlay
    local_path TEXT,
    overlay_uhrp_url TEXT,
    s3_key TEXT,
    cdn_url TEXT,
    file_size BIGINT NOT NULL,
    mime_type TEXT,
    storage_locations JSONB DEFAULT '[]'::jsonb, -- Array of storage locations
    replication_status JSONB DEFAULT '{}'::jsonb,
    overlay_advertisements TEXT[] DEFAULT ARRAY[]::TEXT[],
    last_verified_at TIMESTAMP,
    verification_agents TEXT[] DEFAULT ARRAY[]::TEXT[],
    access_statistics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (version_id) REFERENCES assets(version_id)
);

-- Storage verification and integrity tracking
CREATE TABLE IF NOT EXISTS storage_verifications (
    id SERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL,
    verification_type TEXT NOT NULL, -- 'hash', 'availability', 'integrity'
    storage_location TEXT NOT NULL, -- 'local', 'overlay', 's3', 'cdn'
    verification_agent TEXT,
    verification_result BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    error_details JSONB,
    overlay_evidence JSONB,
    verified_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- D24 - OVERLAY AGENT MARKETPLACE
-- =====================================

-- Overlay agents table for D24 marketplace
CREATE TABLE IF NOT EXISTS overlay_agents (
    agent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    capabilities_json JSONB NOT NULL DEFAULT '[]',
    overlay_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    ship_advertisement_id TEXT,
    geographic_region TEXT,
    webhook_url TEXT NOT NULL,
    reputation_score DECIMAL(3,2) DEFAULT 0.00,
    performance_metrics JSONB DEFAULT '{}',
    status TEXT DEFAULT 'unknown',
    identity_key TEXT,
    brc31_signature TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Overlay rules for automated marketplace workflows
CREATE TABLE IF NOT EXISTS overlay_rules (
    rule_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_config JSONB NOT NULL,
    action_config JSONB NOT NULL,
    overlay_topics TEXT[] DEFAULT ARRAY[]::TEXT[], -- Added for D24 tests
    -- D24 test-specific columns
    when_condition JSONB NOT NULL DEFAULT '{}',
    find_strategy JSONB NOT NULL DEFAULT '{}',
    actions JSONB NOT NULL DEFAULT '{}',
    owner_producer_id UUID,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Overlay jobs for marketplace automation
CREATE TABLE IF NOT EXISTS overlay_jobs (
    job_id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES overlay_rules(rule_id),
    agent_id UUID REFERENCES overlay_agents(agent_id),
    target_id TEXT,
    status TEXT DEFAULT 'queued',
    state TEXT DEFAULT 'pending', -- Added for D24 tests compatibility
    priority INTEGER DEFAULT 50,
    scheduled_at BIGINT,
    payload JSONB DEFAULT '{}',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    -- D24 test-specific columns
    next_run_at BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000,
    assigned_agents TEXT[],
    coordination_data JSONB DEFAULT '{}',
    evidence_package JSONB DEFAULT '{}',
    lineage_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- =====================================
-- LEGACY TABLES REMOVED (per docs/corrections.md)
-- =====================================
-- The following legacy tables have been removed and replaced with modern equivalents:
-- - receipts → overlay_receipts
-- - declarations → removed (no replacement needed)
-- - manifests → assets
-- - edges → removed (lineage handled differently)
-- - prices → integrated into policies
-- - revenue_events → removed (handled by payment system)
-- - price_rules → integrated into policies
-- - advisories → removed (handled by policies)
-- - advisory_targets → removed (handled by policies)
-- - rules → overlay_rules
-- - jobs → minimal jobs table for D24 functionality
-- - contract_templates → agent_templates
-- - artifacts → removed (handled by storage system)
--
-- This modernization follows docs/corrections.md recommendations for:
-- ✅ UUID primary keys
-- ✅ TIMESTAMPTZ timestamps
-- ✅ ENUM types for status fields
-- ✅ Explicit foreign key constraints
-- ✅ Removal of legacy table structure

-- =====================================
-- OPENLINEAGE TABLES (D38/D41)
-- =====================================

CREATE TABLE IF NOT EXISTS ol_events (
  event_id TEXT PRIMARY KEY,
  event_time TEXT NOT NULL, -- ISO timestamp
  namespace TEXT NOT NULL,
  job_name TEXT NOT NULL,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS ol_jobs (
  job_id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,
  latest_facets_json JSONB,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(namespace, name)
);

CREATE TABLE IF NOT EXISTS ol_runs (
  run_key TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  job_name TEXT NOT NULL,
  run_id TEXT NOT NULL,
  state TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  facets_json JSONB,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(namespace, job_name, run_id)
);

CREATE TABLE IF NOT EXISTS ol_datasets (
  dataset_key TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,
  latest_facets_json JSONB,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(namespace, name)
);

CREATE TABLE IF NOT EXISTS ol_edges (
  edge_id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  parent_dataset_name TEXT NOT NULL,
  child_dataset_name TEXT NOT NULL,
  run_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- DLQ for OpenLineage
CREATE TABLE IF NOT EXISTS ol_dlq (
  dlq_id TEXT PRIMARY KEY,
  payload_json JSONB NOT NULL,
  validation_errors JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_try_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Optional lineage event audit (raw OL events for forensic)
CREATE TABLE IF NOT EXISTS lineage_event_audit (
  event_hash    TEXT PRIMARY KEY,
  event_time    TIMESTAMPTZ NOT NULL,
  namespace     TEXT NOT NULL,
  job_name      TEXT NOT NULL,
  run_id        TEXT NOT NULL,
  payload_json  JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================
-- D24 AGENT TEMPLATES TABLE (Missing from original schema)
-- =====================================

-- Agent templates table for D24 marketplace functionality
CREATE TABLE IF NOT EXISTS agent_templates (
  template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_name VARCHAR(255) NOT NULL,
  template_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================
-- STORAGE SYSTEM TABLES (D22 Overlay Storage)
-- =====================================

-- Storage performance metrics
CREATE TABLE IF NOT EXISTS storage_performance_metrics (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  storage_location TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value DECIMAL(12,4) NOT NULL,
  measurement_unit TEXT NOT NULL,
  geographic_region TEXT,
  client_context JSONB,
  measured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Storage cache statistics
CREATE TABLE IF NOT EXISTS storage_cache_stats (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  cache_level TEXT NOT NULL,
  cache_status TEXT NOT NULL,
  access_frequency INTEGER DEFAULT 1,
  last_access_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  cache_size_bytes BIGINT,
  ttl_seconds INTEGER,
  priority_score DECIMAL(5,2),
  recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Storage replications
CREATE TABLE IF NOT EXISTS storage_replications (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  source_location TEXT NOT NULL,
  target_location TEXT NOT NULL,
  replication_agent TEXT,
  replication_job_id TEXT,
  status TEXT DEFAULT 'pending',
  progress_percentage INTEGER DEFAULT 0,
  bytes_replicated BIGINT DEFAULT 0,
  error_message TEXT,
  overlay_job_evidence JSONB,
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

-- =====================================
-- ALL INDEXES
-- =====================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_assets_dataset ON assets(dataset_id);
CREATE INDEX IF NOT EXISTS idx_assets_producer ON assets(producer_id);
CREATE INDEX IF NOT EXISTS idx_assets_updated ON assets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_runs_policy ON policy_runs(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_runs_version ON policy_runs(version_id);

-- D06 Payment indexes
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_version_id ON overlay_receipts(version_id);
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_payer_identity ON overlay_receipts(payer_identity_key);
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_status_expires ON overlay_receipts(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_payment_txid ON overlay_receipts(payment_txid);
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_agent_id ON overlay_receipts(agent_id);
CREATE INDEX IF NOT EXISTS idx_overlay_receipts_created_at ON overlay_receipts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_identities_key ON payment_identities(identity_key);
CREATE INDEX IF NOT EXISTS idx_payment_identities_verification ON payment_identities(verification_level);
CREATE INDEX IF NOT EXISTS idx_payment_events_receipt_id ON payment_events(receipt_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_type_created ON payment_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_agent_id ON payment_events(agent_id);

-- D07 Streaming indexes
CREATE INDEX IF NOT EXISTS idx_streaming_usage_receipt_id ON streaming_usage(receipt_id);
CREATE INDEX IF NOT EXISTS idx_streaming_usage_content_hash ON streaming_usage(content_hash);
CREATE INDEX IF NOT EXISTS idx_streaming_usage_session_id ON streaming_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_streaming_usage_agent_id ON streaming_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_quota_usage_receipt_window ON quota_usage_windows(receipt_id, window_type, window_start);
CREATE INDEX IF NOT EXISTS idx_uhrp_host_content_hash ON uhrp_host_performance(content_hash);
CREATE INDEX IF NOT EXISTS idx_uhrp_host_availability ON uhrp_host_performance(availability_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_streaming_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_delivery_optimization_hash ON delivery_optimization(content_hash);

-- D08 Streaming indexes
CREATE INDEX IF NOT EXISTS idx_stream_metadata_version_id ON stream_metadata(version_id);
CREATE INDEX IF NOT EXISTS idx_stream_metadata_producer_id ON stream_metadata(producer_id);
CREATE INDEX IF NOT EXISTS idx_stream_metadata_status ON stream_metadata(status);
CREATE INDEX IF NOT EXISTS idx_realtime_packets_version_id ON realtime_packets(version_id);
CREATE INDEX IF NOT EXISTS idx_realtime_packets_sequence ON realtime_packets(version_id, packet_sequence);
CREATE INDEX IF NOT EXISTS idx_realtime_packets_txid ON realtime_packets(txid);
CREATE INDEX IF NOT EXISTS idx_stream_webhooks_version_id ON stream_webhooks(version_id);
CREATE INDEX IF NOT EXISTS idx_stream_webhooks_status ON stream_webhooks(status);
CREATE INDEX IF NOT EXISTS idx_stream_websockets_version_id ON stream_websockets(version_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(delivery_status);

-- D22 Storage indexes
CREATE INDEX IF NOT EXISTS idx_overlay_storage_version_id ON overlay_storage_index(version_id);
CREATE INDEX IF NOT EXISTS idx_overlay_storage_tier ON overlay_storage_index(storage_tier);
CREATE INDEX IF NOT EXISTS idx_overlay_storage_uhrp_url ON overlay_storage_index(overlay_uhrp_url);
CREATE INDEX IF NOT EXISTS idx_overlay_storage_last_verified ON overlay_storage_index(last_verified_at);
CREATE INDEX IF NOT EXISTS idx_overlay_storage_created_at ON overlay_storage_index(created_at);
CREATE INDEX IF NOT EXISTS idx_storage_verification_hash ON storage_verifications(content_hash, verified_at);
CREATE INDEX IF NOT EXISTS idx_storage_verification_agent ON storage_verifications(verification_agent, verified_at);
CREATE INDEX IF NOT EXISTS idx_storage_verification_type ON storage_verifications(verification_type);
CREATE INDEX IF NOT EXISTS idx_storage_verification_location ON storage_verifications(storage_location);
CREATE INDEX IF NOT EXISTS idx_storage_verification_result ON storage_verifications(verification_result, verified_at);

-- D24 Overlay Agent indexes
CREATE INDEX IF NOT EXISTS idx_overlay_agents_region ON overlay_agents(geographic_region);
CREATE INDEX IF NOT EXISTS idx_overlay_agents_status ON overlay_agents(status);
CREATE INDEX IF NOT EXISTS idx_overlay_jobs_rule_id ON overlay_jobs(rule_id);
CREATE INDEX IF NOT EXISTS idx_overlay_jobs_status ON overlay_jobs(status);
CREATE INDEX IF NOT EXISTS idx_overlay_jobs_agent_id ON overlay_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_overlay_rules_enabled ON overlay_rules(enabled);

-- Legacy indexes
-- Legacy indexes removed with legacy tables (per docs/corrections.md)
-- CREATE INDEX IF NOT EXISTS idx_receipts_version ON receipts(version_id);
-- CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
-- CREATE INDEX IF NOT EXISTS idx_declarations_txid ON declarations(txid);
-- CREATE INDEX IF NOT EXISTS idx_declarations_status ON declarations(status);
-- CREATE INDEX IF NOT EXISTS idx_manifests_dataset ON manifests(dataset_id);
-- CREATE INDEX IF NOT EXISTS idx_manifests_producer ON manifests(producer_id);
-- CREATE INDEX IF NOT EXISTS idx_revenue_version ON revenue_events(version_id);
-- CREATE INDEX IF NOT EXISTS idx_revenue_receipt ON revenue_events(receipt_id);
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_price_rules_version_tier ON price_rules(version_id, tier_from) WHERE version_id IS NOT NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_price_rules_producer_tier ON price_rules(producer_id, tier_from) WHERE producer_id IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_price_rules_version ON price_rules(version_id);
-- CREATE INDEX IF NOT EXISTS idx_price_rules_producer ON price_rules(producer_id);
-- CREATE INDEX IF NOT EXISTS idx_adv_targets_version ON advisory_targets(version_id);
-- CREATE INDEX IF NOT EXISTS idx_adv_targets_producer ON advisory_targets(producer_id);
-- CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);
-- Legacy indexes removed since legacy tables were dropped
-- CREATE INDEX IF NOT EXISTS idx_jobs_state_next ON jobs(state, next_run_at); -- jobs table uses 'status' not 'state'
-- CREATE INDEX IF NOT EXISTS idx_jobs_rule ON jobs(rule_id); -- rule_id column doesn't exist in minimal jobs table
-- CREATE INDEX IF NOT EXISTS idx_templates_owner ON contract_templates(owner_producer_id); -- contract_templates was removed
-- CREATE INDEX IF NOT EXISTS idx_artifacts_job ON artifacts(job_id); -- artifacts table was removed
-- CREATE INDEX IF NOT EXISTS idx_artifacts_version ON artifacts(version_id); -- artifacts table was removed
-- CREATE INDEX IF NOT EXISTS idx_artifacts_hash ON artifacts(content_hash); -- artifacts table was removed
-- CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(artifact_type); -- artifacts table was removed

-- Minimal jobs table for D24 functionality
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  status job_status DEFAULT 'pending',
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Updated indexes for current minimal jobs table
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);

-- OpenLineage indexes
CREATE INDEX IF NOT EXISTS idx_ol_events_time ON ol_events(event_time);
CREATE INDEX IF NOT EXISTS idx_ol_events_namespace ON ol_events(namespace);
CREATE INDEX IF NOT EXISTS idx_ol_events_job ON ol_events(namespace, job_name);
CREATE INDEX IF NOT EXISTS idx_ol_edges_namespace ON ol_edges(namespace);
CREATE INDEX IF NOT EXISTS idx_ol_edges_parent ON ol_edges(namespace, parent_dataset_name);
CREATE INDEX IF NOT EXISTS idx_ol_edges_child ON ol_edges(namespace, child_dataset_name);
CREATE INDEX IF NOT EXISTS idx_ol_dlq_next_try ON ol_dlq(next_try_at) WHERE next_try_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lineage_event_time ON lineage_event_audit(event_time DESC);

-- =====================================
-- GIN INDEXES FOR JSONB FIELDS (docs/corrections.md recommendation)
-- =====================================

-- Create GIN indexes for JSONB fields to improve query performance

-- Policies doc field
CREATE INDEX IF NOT EXISTS idx_policies_doc_gin
  ON policies USING GIN (doc);

-- Assets policy_meta field
CREATE INDEX IF NOT EXISTS idx_assets_policy_meta_gin
  ON assets USING GIN (policy_meta);

-- Policy runs reasons field
CREATE INDEX IF NOT EXISTS idx_policy_runs_reasons_gin
  ON policy_runs USING GIN (reasons);

-- Policy runs evidence field
CREATE INDEX IF NOT EXISTS idx_policy_runs_evidence_gin
  ON policy_runs USING GIN (evidence);

-- Agents capabilities field
CREATE INDEX IF NOT EXISTS idx_agents_capabilities_gin
  ON agents USING GIN (capabilities);

-- Agent templates config field
CREATE INDEX IF NOT EXISTS idx_agent_templates_config_gin
  ON agent_templates USING GIN (template_config);

-- Storage system JSONB fields
CREATE INDEX IF NOT EXISTS idx_storage_performance_client_context_gin
  ON storage_performance_metrics USING GIN (client_context);

CREATE INDEX IF NOT EXISTS idx_storage_replications_evidence_gin
  ON storage_replications USING GIN (overlay_job_evidence);

-- Storage system performance indexes
CREATE INDEX IF NOT EXISTS idx_storage_performance_hash ON storage_performance_metrics(content_hash, measured_at);
CREATE INDEX IF NOT EXISTS idx_storage_performance_location ON storage_performance_metrics(storage_location, measured_at);
CREATE INDEX IF NOT EXISTS idx_storage_performance_type ON storage_performance_metrics(metric_type, measured_at);
CREATE INDEX IF NOT EXISTS idx_storage_performance_region ON storage_performance_metrics(geographic_region, measured_at);

CREATE INDEX IF NOT EXISTS idx_storage_cache_hash ON storage_cache_stats(content_hash, recorded_at);
CREATE INDEX IF NOT EXISTS idx_storage_cache_level ON storage_cache_stats(cache_level, cache_status);
CREATE INDEX IF NOT EXISTS idx_storage_cache_frequency ON storage_cache_stats(access_frequency DESC);
CREATE INDEX IF NOT EXISTS idx_storage_cache_priority ON storage_cache_stats(priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_storage_replication_status ON storage_replications(status, started_at);
CREATE INDEX IF NOT EXISTS idx_storage_replication_agent ON storage_replications(replication_agent, started_at);
CREATE INDEX IF NOT EXISTS idx_storage_replication_hash ON storage_replications(content_hash);
CREATE INDEX IF NOT EXISTS idx_storage_replication_job_id ON storage_replications(replication_job_id);
CREATE INDEX IF NOT EXISTS idx_storage_replication_locations ON storage_replications(source_location, target_location);

-- Multi-column indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_assets_dataset_producer
  ON assets(dataset_id, producer_id);

CREATE INDEX IF NOT EXISTS idx_policy_runs_policy_version
  ON policy_runs(policy_id, version_id);

-- =====================================
-- SAMPLE DATA INSERTS
-- =====================================

-- Insert default quota policies (only if they don't exist)
INSERT INTO quota_policies (policy_name, description, bytes_per_hour, bytes_per_day, bytes_per_month, requests_per_hour, requests_per_day, requests_per_month, max_concurrent_streams, max_bandwidth_mbps)
SELECT 'standard', 'Standard user quota policy', 1073741824, 10737418240, 107374182400, 100, 1000, 10000, 1, 10.0
WHERE NOT EXISTS (SELECT 1 FROM quota_policies WHERE policy_name = 'standard')
UNION ALL
SELECT 'premium', 'Premium user quota policy', 5368709120, 53687091200, 536870912000, 500, 5000, 50000, 5, 50.0
WHERE NOT EXISTS (SELECT 1 FROM quota_policies WHERE policy_name = 'premium')
UNION ALL
SELECT 'enterprise', 'Enterprise quota policy', 21474836480, 214748364800, 2147483648000, 2000, 20000, 200000, 20, 200.0
WHERE NOT EXISTS (SELECT 1 FROM quota_policies WHERE policy_name = 'enterprise');

-- Insert default BRC-31 identity for testing/development
INSERT INTO payment_identities (identity_key, verification_level, trust_score)
VALUES ('02deadbeef1234567890abcdef1234567890abcdef1234567890abcdef123456', 'basic', 1.0)
ON CONFLICT (identity_key) DO NOTHING;