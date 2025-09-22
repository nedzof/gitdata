-- D07 BSV Overlay Network Data Streaming & Quota Management Schema
-- Enterprise Data Delivery Platform with BRC Standards Integration

-- Extended receipts table for streaming quotas (builds on D06)
ALTER TABLE overlay_receipts ADD COLUMN IF NOT EXISTS streaming_config JSONB DEFAULT '{}';
ALTER TABLE overlay_receipts ADD COLUMN IF NOT EXISTS quota_tier VARCHAR(20) DEFAULT 'standard';
ALTER TABLE overlay_receipts ADD COLUMN IF NOT EXISTS concurrent_streams_allowed INTEGER DEFAULT 1;

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_streaming_usage_receipt_id ON streaming_usage(receipt_id);
CREATE INDEX IF NOT EXISTS idx_streaming_usage_content_hash ON streaming_usage(content_hash);
CREATE INDEX IF NOT EXISTS idx_streaming_usage_session_id ON streaming_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_streaming_usage_agent_id ON streaming_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_quota_usage_receipt_window ON quota_usage_windows(receipt_id, window_type, window_start);
CREATE INDEX IF NOT EXISTS idx_uhrp_host_content_hash ON uhrp_host_performance(content_hash);
CREATE INDEX IF NOT EXISTS idx_uhrp_host_availability ON uhrp_host_performance(availability_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_streaming_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_delivery_optimization_hash ON delivery_optimization(content_hash);

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

-- Insert sample content delivery optimization rules (only if they don't exist)
INSERT INTO delivery_optimization (content_hash, cache_tier, cache_ttl_seconds, compression_enabled, target_latency_ms, target_bandwidth_mbps)
SELECT 'sample-content-hash-1', 'hot', 1800, true, 200, 25.0
WHERE NOT EXISTS (SELECT 1 FROM delivery_optimization WHERE content_hash = 'sample-content-hash-1')
UNION ALL
SELECT 'sample-content-hash-2', 'warm', 3600, true, 500, 10.0
WHERE NOT EXISTS (SELECT 1 FROM delivery_optimization WHERE content_hash = 'sample-content-hash-2')
UNION ALL
SELECT 'sample-content-hash-3', 'cold', 7200, false, 1000, 5.0
WHERE NOT EXISTS (SELECT 1 FROM delivery_optimization WHERE content_hash = 'sample-content-hash-3');