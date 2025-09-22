-- D22 - BSV Overlay Network Storage Backend Database Schema
-- Enhanced storage tracking with BRC-26 UHRP integration

-- Enhanced storage tracking with overlay integration
CREATE TABLE IF NOT EXISTS overlay_storage_index (
    content_hash TEXT PRIMARY KEY,
    version_id TEXT NOT NULL,
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
    FOREIGN KEY (version_id) REFERENCES manifests(version_id)
);

-- Create indexes for overlay_storage_index
CREATE INDEX IF NOT EXISTS idx_overlay_storage_version_id ON overlay_storage_index(version_id);
CREATE INDEX IF NOT EXISTS idx_overlay_storage_tier ON overlay_storage_index(storage_tier);
CREATE INDEX IF NOT EXISTS idx_overlay_storage_uhrp_url ON overlay_storage_index(overlay_uhrp_url);
CREATE INDEX IF NOT EXISTS idx_overlay_storage_last_verified ON overlay_storage_index(last_verified_at);
CREATE INDEX IF NOT EXISTS idx_overlay_storage_created_at ON overlay_storage_index(created_at);

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

-- Create indexes for storage_verifications
CREATE INDEX IF NOT EXISTS idx_storage_verification_hash ON storage_verifications(content_hash, verified_at);
CREATE INDEX IF NOT EXISTS idx_storage_verification_agent ON storage_verifications(verification_agent, verified_at);
CREATE INDEX IF NOT EXISTS idx_storage_verification_type ON storage_verifications(verification_type);
CREATE INDEX IF NOT EXISTS idx_storage_verification_location ON storage_verifications(storage_location);
CREATE INDEX IF NOT EXISTS idx_storage_verification_result ON storage_verifications(verification_result, verified_at);

-- Storage access and download tracking
CREATE TABLE IF NOT EXISTS storage_access_logs (
    id SERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL,
    access_method TEXT NOT NULL, -- 'local', 'uhrp', 'presigned', 'cdn'
    client_id TEXT,
    bytes_transferred BIGINT,
    range_start BIGINT,
    range_end BIGINT,
    response_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    overlay_route JSONB, -- Overlay network routing information
    accessed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for storage_access_logs
CREATE INDEX IF NOT EXISTS idx_storage_access_hash ON storage_access_logs(content_hash, accessed_at);
CREATE INDEX IF NOT EXISTS idx_storage_access_method ON storage_access_logs(access_method, accessed_at);
CREATE INDEX IF NOT EXISTS idx_storage_access_client ON storage_access_logs(client_id, accessed_at);
CREATE INDEX IF NOT EXISTS idx_storage_access_success ON storage_access_logs(success, accessed_at);
CREATE INDEX IF NOT EXISTS idx_storage_access_bytes ON storage_access_logs(bytes_transferred);

-- Storage replication coordination
CREATE TABLE IF NOT EXISTS storage_replications (
    id SERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL,
    source_location TEXT NOT NULL,
    target_location TEXT NOT NULL,
    replication_agent TEXT,
    replication_job_id TEXT,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed
    progress_percentage INTEGER DEFAULT 0,
    bytes_replicated BIGINT DEFAULT 0,
    error_message TEXT,
    overlay_job_evidence JSONB,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Create indexes for storage_replications
CREATE INDEX IF NOT EXISTS idx_storage_replication_status ON storage_replications(status, started_at);
CREATE INDEX IF NOT EXISTS idx_storage_replication_agent ON storage_replications(replication_agent, started_at);
CREATE INDEX IF NOT EXISTS idx_storage_replication_hash ON storage_replications(content_hash);
CREATE INDEX IF NOT EXISTS idx_storage_replication_job_id ON storage_replications(replication_job_id);
CREATE INDEX IF NOT EXISTS idx_storage_replication_locations ON storage_replications(source_location, target_location);

-- Storage quotas and user limits
CREATE TABLE IF NOT EXISTS storage_quotas (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    identity_key TEXT,
    quota_type TEXT DEFAULT 'default', -- 'default', 'premium', 'custom'
    total_quota_bytes BIGINT NOT NULL,
    used_quota_bytes BIGINT DEFAULT 0,
    storage_tier_limits JSONB DEFAULT '{"hot": 10737418240, "warm": 53687091200, "cold": -1}'::jsonb, -- 10GB hot, 50GB warm, unlimited cold
    overlay_enabled BOOLEAN DEFAULT true,
    replication_factor INTEGER DEFAULT 3,
    verification_frequency_hours INTEGER DEFAULT 6,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes for storage_quotas
CREATE INDEX IF NOT EXISTS idx_storage_quotas_user_id ON storage_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_quotas_identity_key ON storage_quotas(identity_key);
CREATE INDEX IF NOT EXISTS idx_storage_quotas_type ON storage_quotas(quota_type);

-- UHRP (Universal Hash Resolution Protocol) advertisements
CREATE TABLE IF NOT EXISTS uhrp_advertisements (
    id SERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL,
    advertisement_id TEXT NOT NULL UNIQUE,
    storage_provider TEXT NOT NULL,
    storage_capability JSONB NOT NULL, -- Storage capability details
    advertisement_data JSONB NOT NULL, -- BRC-88 SHIP/SLAP advertisement data
    resolution_endpoints TEXT[] DEFAULT ARRAY[]::TEXT[],
    geographic_regions TEXT[] DEFAULT ARRAY[]::TEXT[],
    availability_score DECIMAL(3,2) DEFAULT 1.0,
    bandwidth_mbps INTEGER,
    cost_per_gb_satoshis INTEGER,
    ttl_hours INTEGER DEFAULT 24,
    published_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
    last_verified_at TIMESTAMP,
    active BOOLEAN DEFAULT true
);

-- Create indexes for uhrp_advertisements
CREATE INDEX IF NOT EXISTS idx_uhrp_advertisements_hash ON uhrp_advertisements(content_hash);
CREATE INDEX IF NOT EXISTS idx_uhrp_advertisements_provider ON uhrp_advertisements(storage_provider);
CREATE INDEX IF NOT EXISTS idx_uhrp_advertisements_active ON uhrp_advertisements(active, expires_at);
CREATE INDEX IF NOT EXISTS idx_uhrp_advertisements_regions ON uhrp_advertisements USING GIN(geographic_regions);
CREATE INDEX IF NOT EXISTS idx_uhrp_advertisements_availability ON uhrp_advertisements(availability_score);

-- Storage performance metrics
CREATE TABLE IF NOT EXISTS storage_performance_metrics (
    id SERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL,
    storage_location TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- 'latency', 'bandwidth', 'availability', 'cost'
    metric_value DECIMAL(12,4) NOT NULL,
    measurement_unit TEXT NOT NULL, -- 'ms', 'mbps', 'percentage', 'satoshis_per_gb'
    geographic_region TEXT,
    client_context JSONB,
    measured_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for storage_performance_metrics
CREATE INDEX IF NOT EXISTS idx_storage_performance_hash ON storage_performance_metrics(content_hash, measured_at);
CREATE INDEX IF NOT EXISTS idx_storage_performance_location ON storage_performance_metrics(storage_location, measured_at);
CREATE INDEX IF NOT EXISTS idx_storage_performance_type ON storage_performance_metrics(metric_type, measured_at);
CREATE INDEX IF NOT EXISTS idx_storage_performance_region ON storage_performance_metrics(geographic_region, measured_at);

-- Storage cache statistics
CREATE TABLE IF NOT EXISTS storage_cache_stats (
    id SERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL,
    cache_level TEXT NOT NULL, -- 'memory', 'disk', 'overlay'
    cache_status TEXT NOT NULL, -- 'hit', 'miss', 'evicted', 'expired'
    access_frequency INTEGER DEFAULT 1,
    last_access_at TIMESTAMP DEFAULT NOW(),
    cache_size_bytes BIGINT,
    ttl_seconds INTEGER,
    priority_score DECIMAL(5,2),
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for storage_cache_stats
CREATE INDEX IF NOT EXISTS idx_storage_cache_hash ON storage_cache_stats(content_hash, recorded_at);
CREATE INDEX IF NOT EXISTS idx_storage_cache_level ON storage_cache_stats(cache_level, cache_status);
CREATE INDEX IF NOT EXISTS idx_storage_cache_frequency ON storage_cache_stats(access_frequency DESC);
CREATE INDEX IF NOT EXISTS idx_storage_cache_priority ON storage_cache_stats(priority_score DESC);

-- Functions for maintaining updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_overlay_storage_index_updated_at ON overlay_storage_index;
CREATE TRIGGER update_overlay_storage_index_updated_at
    BEFORE UPDATE ON overlay_storage_index
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_storage_quotas_updated_at ON storage_quotas;
CREATE TRIGGER update_storage_quotas_updated_at
    BEFORE UPDATE ON storage_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries

-- Storage location summary view
CREATE OR REPLACE VIEW storage_location_summary AS
SELECT
    content_hash,
    version_id,
    storage_tier,
    CASE
        WHEN local_path IS NOT NULL THEN 'local'
        ELSE NULL
    END as has_local,
    CASE
        WHEN overlay_uhrp_url IS NOT NULL THEN 'overlay'
        ELSE NULL
    END as has_overlay,
    CASE
        WHEN s3_key IS NOT NULL THEN 's3'
        ELSE NULL
    END as has_s3,
    CASE
        WHEN cdn_url IS NOT NULL THEN 'cdn'
        ELSE NULL
    END as has_cdn,
    array_length(verification_agents, 1) as verification_agent_count,
    array_length(overlay_advertisements, 1) as advertisement_count,
    last_verified_at,
    file_size,
    created_at
FROM overlay_storage_index;

-- Storage health view
CREATE OR REPLACE VIEW storage_health_summary AS
SELECT
    osi.content_hash,
    osi.version_id,
    osi.storage_tier,
    osi.file_size,
    COUNT(DISTINCT sv.storage_location) as verified_locations,
    AVG(CASE WHEN sv.verification_result THEN 1.0 ELSE 0.0 END) as verification_success_rate,
    MAX(sv.verified_at) as last_verification,
    COUNT(DISTINCT sr.target_location) as replication_targets,
    COUNT(CASE WHEN sr.status = 'completed' THEN 1 END) as completed_replications,
    COUNT(CASE WHEN sr.status = 'failed' THEN 1 END) as failed_replications,
    osi.created_at
FROM overlay_storage_index osi
LEFT JOIN storage_verifications sv ON osi.content_hash = sv.content_hash
LEFT JOIN storage_replications sr ON osi.content_hash = sr.content_hash
GROUP BY osi.content_hash, osi.version_id, osi.storage_tier, osi.file_size, osi.created_at;

-- Storage access analytics view
CREATE OR REPLACE VIEW storage_access_analytics AS
SELECT
    content_hash,
    access_method,
    COUNT(*) as access_count,
    SUM(bytes_transferred) as total_bytes_transferred,
    AVG(response_time_ms) as avg_response_time_ms,
    COUNT(CASE WHEN success THEN 1 END) as successful_accesses,
    COUNT(CASE WHEN NOT success THEN 1 END) as failed_accesses,
    DATE(accessed_at) as access_date
FROM storage_access_logs
GROUP BY content_hash, access_method, DATE(accessed_at);

-- Comments for documentation
COMMENT ON TABLE overlay_storage_index IS 'Primary index for BSV overlay network storage with BRC-26 UHRP integration';
COMMENT ON TABLE storage_verifications IS 'Storage integrity verification results from verification agents';
COMMENT ON TABLE storage_access_logs IS 'Access logs for storage retrieval analytics and optimization';
COMMENT ON TABLE storage_replications IS 'Replication job tracking for multi-location storage coordination';
COMMENT ON TABLE storage_quotas IS 'User storage quotas and tier limits';
COMMENT ON TABLE uhrp_advertisements IS 'BRC-26 UHRP storage capability advertisements';
COMMENT ON TABLE storage_performance_metrics IS 'Performance metrics for storage location optimization';
COMMENT ON TABLE storage_cache_stats IS 'Cache hit/miss statistics for storage optimization';

COMMENT ON COLUMN overlay_storage_index.content_hash IS 'SHA-256 hash of the stored content';
COMMENT ON COLUMN overlay_storage_index.storage_tier IS 'Storage tier: hot (frequently accessed), warm (occasionally accessed), cold (archived), overlay (distributed)';
COMMENT ON COLUMN overlay_storage_index.overlay_uhrp_url IS 'BRC-26 UHRP URL for distributed resolution';
COMMENT ON COLUMN overlay_storage_index.storage_locations IS 'JSON array of all storage locations for this content';
COMMENT ON COLUMN overlay_storage_index.replication_status IS 'JSON object tracking replication status across locations';
COMMENT ON COLUMN overlay_storage_index.overlay_advertisements IS 'Array of BRC-88 SHIP/SLAP advertisement IDs';
COMMENT ON COLUMN overlay_storage_index.verification_agents IS 'Array of agent IDs that have verified this content';
COMMENT ON COLUMN overlay_storage_index.access_statistics IS 'JSON object with access frequency and patterns';