"use strict";
/**
 * D22 - BSV Overlay Network Storage Backend
 * Database Schema Definition using TypeScript SQL
 * Creates all necessary tables for overlay storage with BRC-26 UHRP integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.D22StorageSchema = void 0;
class D22StorageSchema {
    /**
     * Apply complete D22 schema to database
     */
    static async applySchema(pool) {
        console.log('🗄️  Applying D22 Overlay Storage schema...');
        const schemas = [
            // Main storage tables
            { name: 'overlay_storage_index', sql: this.OVERLAY_STORAGE_INDEX },
            { name: 'storage_verifications', sql: this.STORAGE_VERIFICATIONS },
            { name: 'storage_access_logs', sql: this.STORAGE_ACCESS_LOGS },
            { name: 'storage_replications', sql: this.STORAGE_REPLICATIONS },
            // UHRP and caching
            { name: 'uhrp_advertisements', sql: this.UHRP_ADVERTISEMENTS },
            { name: 'storage_cache_stats', sql: this.STORAGE_CACHE_STATS },
            // Routing and performance
            { name: 'storage_routing_logs', sql: this.STORAGE_ROUTING_LOGS },
            { name: 'storage_agent_registry', sql: this.STORAGE_AGENT_REGISTRY },
            { name: 'storage_performance_metrics', sql: this.STORAGE_PERFORMANCE_METRICS }
        ];
        // Create tables
        for (const schema of schemas) {
            try {
                await pool.query(schema.sql);
                console.log(`✅ Created table: ${schema.name}`);
            }
            catch (error) {
                console.error(`❌ Failed to create table ${schema.name}:`, error.message);
                throw error;
            }
        }
        // Create indexes
        const indexGroups = [
            this.OVERLAY_STORAGE_INDEX_INDEXES,
            this.STORAGE_VERIFICATIONS_INDEXES,
            this.STORAGE_ACCESS_LOGS_INDEXES,
            this.STORAGE_REPLICATIONS_INDEXES,
            this.UHRP_ADVERTISEMENTS_INDEXES,
            this.STORAGE_CACHE_STATS_INDEXES,
            this.STORAGE_ROUTING_LOGS_INDEXES,
            this.STORAGE_AGENT_REGISTRY_INDEXES,
            this.STORAGE_PERFORMANCE_METRICS_INDEXES
        ];
        let totalIndexes = 0;
        for (const indexes of indexGroups) {
            for (const indexSql of indexes) {
                try {
                    await pool.query(indexSql);
                    totalIndexes++;
                }
                catch (error) {
                    if (!error.message.includes('already exists')) {
                        console.error(`❌ Failed to create index:`, error.message);
                    }
                }
            }
        }
        console.log(`✅ Created ${totalIndexes} indexes for D22 storage system`);
        console.log('🎉 D22 Overlay Storage schema applied successfully!');
    }
    /**
     * Create optimized views for common queries
     */
    static async createViews(pool) {
        const views = [
            {
                name: 'storage_health_summary',
                sql: `
          CREATE OR REPLACE VIEW storage_health_summary AS
          SELECT
            osi.content_hash,
            osi.file_size,
            osi.storage_tier,
            osi.last_verified_at,
            COUNT(DISTINCT CASE WHEN osi.local_path IS NOT NULL THEN 'local' END) +
            COUNT(DISTINCT CASE WHEN osi.overlay_uhrp_url IS NOT NULL THEN 'overlay' END) +
            COUNT(DISTINCT CASE WHEN osi.s3_key IS NOT NULL THEN 's3' END) +
            COUNT(DISTINCT CASE WHEN osi.cdn_url IS NOT NULL THEN 'cdn' END) AS replication_count,
            COALESCE(sv.verification_success_rate, 0) AS verification_success_rate,
            COALESCE(sal.total_accesses, 0) AS total_accesses,
            COALESCE(sal.last_access, osi.created_at) AS last_access
          FROM overlay_storage_index osi
          LEFT JOIN (
            SELECT
              content_hash,
              AVG(CASE WHEN verification_result THEN 1.0 ELSE 0.0 END) AS verification_success_rate
            FROM storage_verifications
            WHERE verified_at > NOW() - INTERVAL '24 hours'
            GROUP BY content_hash
          ) sv ON osi.content_hash = sv.content_hash
          LEFT JOIN (
            SELECT
              content_hash,
              COUNT(*) AS total_accesses,
              MAX(accessed_at) AS last_access
            FROM storage_access_logs
            GROUP BY content_hash
          ) sal ON osi.content_hash = sal.content_hash
          GROUP BY osi.content_hash, osi.file_size, osi.storage_tier, osi.last_verified_at,
                   sv.verification_success_rate, sal.total_accesses, sal.last_access, osi.created_at
        `
            },
            {
                name: 'agent_performance_summary',
                sql: `
          CREATE OR REPLACE VIEW agent_performance_summary AS
          SELECT
            sar.agent_id,
            sar.agent_type,
            sar.reliability_score,
            sar.current_jobs,
            sar.max_concurrent_jobs,
            CASE
              WHEN sar.last_heartbeat_at > NOW() - INTERVAL '5 minutes' THEN 'healthy'
              WHEN sar.last_heartbeat_at > NOW() - INTERVAL '1 hour' THEN 'stale'
              ELSE 'offline'
            END AS health_status,
            (sar.performance_metrics->>'jobs_completed')::INTEGER AS jobs_completed,
            (sar.performance_metrics->>'jobs_failed')::INTEGER AS jobs_failed,
            CASE
              WHEN (sar.performance_metrics->>'jobs_completed')::INTEGER > 0 THEN
                ROUND(
                  ((sar.performance_metrics->>'jobs_completed')::INTEGER * 100.0) /
                  ((sar.performance_metrics->>'jobs_completed')::INTEGER + (sar.performance_metrics->>'jobs_failed')::INTEGER),
                  2
                )
              ELSE 0
            END AS success_rate_percentage
          FROM storage_agent_registry sar
          WHERE sar.active = true
        `
            }
        ];
        for (const view of views) {
            try {
                await pool.query(view.sql);
                console.log(`✅ Created view: ${view.name}`);
            }
            catch (error) {
                console.error(`❌ Failed to create view ${view.name}:`, error.message);
            }
        }
    }
    /**
     * Initialize with sample data for testing
     */
    static async seedTestData(pool) {
        console.log('🌱 Seeding D22 test data...');
        // Create a test manifest entry
        await pool.query(`
      INSERT INTO manifests (version_id, dataset_id, title, manifest_hash, created_at)
      VALUES ('test_version_d22', 'test_dataset_d22', 'D22 Test Dataset', 'test_manifest_hash_d22', NOW())
      ON CONFLICT (version_id) DO NOTHING
    `);
        // Seed sample storage entries
        const sampleContent = [
            {
                hash: 'sha256:d22test001',
                size: 1024000,
                tier: 'hot',
                mime: 'application/json'
            },
            {
                hash: 'sha256:d22test002',
                size: 5242880,
                tier: 'warm',
                mime: 'video/mp4'
            }
        ];
        for (const content of sampleContent) {
            await pool.query(`
        INSERT INTO overlay_storage_index (
          content_hash, version_id, storage_tier, file_size, mime_type,
          local_path, overlay_uhrp_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (content_hash) DO NOTHING
      `, [
                content.hash,
                'test_version_d22',
                content.tier,
                content.size,
                content.mime,
                `/tmp/overlay-storage/${content.hash.replace('sha256:', '')}.bin`,
                `uhrp://${content.hash}/content`
            ]);
        }
        console.log('✅ D22 test data seeded successfully');
    }
}
exports.D22StorageSchema = D22StorageSchema;
/**
 * Enhanced storage tracking with overlay integration
 */
D22StorageSchema.OVERLAY_STORAGE_INDEX = `
    CREATE TABLE IF NOT EXISTS overlay_storage_index (
      content_hash TEXT PRIMARY KEY,
      version_id TEXT NOT NULL,
      storage_tier TEXT DEFAULT 'hot' CHECK (storage_tier IN ('hot', 'warm', 'cold', 'overlay')),
      local_path TEXT,
      overlay_uhrp_url TEXT,
      s3_key TEXT,
      cdn_url TEXT,
      file_size BIGINT NOT NULL,
      mime_type TEXT,
      storage_locations JSONB DEFAULT '[]'::jsonb,
      replication_status JSONB DEFAULT '{}'::jsonb,
      overlay_advertisements TEXT[] DEFAULT ARRAY[]::TEXT[],
      last_verified_at TIMESTAMP,
      verification_agents TEXT[] DEFAULT ARRAY[]::TEXT[],
      access_statistics JSONB DEFAULT '{
        "accessFrequency": 0,
        "updateFrequency": 0,
        "totalAccesses": 0,
        "uniqueClients": 0
      }'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (version_id) REFERENCES manifests(version_id) ON DELETE CASCADE
    )
  `;
D22StorageSchema.OVERLAY_STORAGE_INDEX_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_overlay_storage_tier ON overlay_storage_index(storage_tier)`,
    `CREATE INDEX IF NOT EXISTS idx_overlay_storage_verified ON overlay_storage_index(last_verified_at)`,
    `CREATE INDEX IF NOT EXISTS idx_overlay_storage_size ON overlay_storage_index(file_size)`,
    `CREATE INDEX IF NOT EXISTS idx_overlay_storage_created ON overlay_storage_index(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_overlay_storage_version ON overlay_storage_index(version_id)`
];
/**
 * Storage verification and integrity tracking
 */
D22StorageSchema.STORAGE_VERIFICATIONS = `
    CREATE TABLE IF NOT EXISTS storage_verifications (
      id SERIAL PRIMARY KEY,
      content_hash TEXT NOT NULL,
      verification_type TEXT NOT NULL CHECK (verification_type IN ('hash', 'availability', 'integrity', 'full')),
      storage_location TEXT NOT NULL CHECK (storage_location IN ('local', 'overlay', 'uhrp', 's3', 'cdn')),
      verification_agent TEXT,
      verification_result BOOLEAN NOT NULL,
      response_time_ms INTEGER,
      error_details JSONB,
      overlay_evidence JSONB,
      verified_at TIMESTAMP DEFAULT NOW()
    )
  `;
D22StorageSchema.STORAGE_VERIFICATIONS_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_storage_verification_hash ON storage_verifications(content_hash, verified_at)`,
    `CREATE INDEX IF NOT EXISTS idx_storage_verification_agent ON storage_verifications(verification_agent, verified_at)`,
    `CREATE INDEX IF NOT EXISTS idx_storage_verification_type ON storage_verifications(verification_type, verified_at)`,
    `CREATE INDEX IF NOT EXISTS idx_storage_verification_result ON storage_verifications(verification_result, verified_at)`
];
/**
 * Storage access and download tracking
 */
D22StorageSchema.STORAGE_ACCESS_LOGS = `
    CREATE TABLE IF NOT EXISTS storage_access_logs (
      id SERIAL PRIMARY KEY,
      content_hash TEXT NOT NULL,
      access_method TEXT NOT NULL CHECK (access_method IN ('local', 'uhrp', 'overlay', 'presigned', 'cdn', 's3')),
      client_id TEXT,
      bytes_transferred BIGINT DEFAULT 0,
      range_start BIGINT,
      range_end BIGINT,
      response_time_ms INTEGER,
      success BOOLEAN NOT NULL,
      overlay_route JSONB,
      geographic_location TEXT,
      network_type TEXT CHECK (network_type IN ('mobile', 'wifi', 'ethernet')),
      user_agent TEXT,
      accessed_at TIMESTAMP DEFAULT NOW()
    )
  `;
D22StorageSchema.STORAGE_ACCESS_LOGS_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_storage_access_hash ON storage_access_logs(content_hash, accessed_at)`,
    `CREATE INDEX IF NOT EXISTS idx_storage_access_method ON storage_access_logs(access_method, accessed_at)`,
    `CREATE INDEX IF NOT EXISTS idx_storage_access_client ON storage_access_logs(client_id, accessed_at)`,
    `CREATE INDEX IF NOT EXISTS idx_storage_access_success ON storage_access_logs(success, accessed_at)`
];
/**
 * Storage replication coordination
 */
D22StorageSchema.STORAGE_REPLICATIONS = `
    CREATE TABLE IF NOT EXISTS storage_replications (
      id SERIAL PRIMARY KEY,
      content_hash TEXT NOT NULL,
      source_location TEXT NOT NULL CHECK (source_location IN ('local', 'overlay', 'uhrp', 's3', 'cdn')),
      target_location TEXT NOT NULL CHECK (target_location IN ('local', 'overlay', 'uhrp', 's3', 'cdn')),
      replication_agent TEXT,
      replication_job_id TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
      progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
      bytes_replicated BIGINT DEFAULT 0,
      error_message TEXT,
      overlay_job_evidence JSONB,
      priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      started_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP,
      CONSTRAINT chk_replication_different_locations CHECK (source_location != target_location)
    )
  `;
D22StorageSchema.STORAGE_REPLICATIONS_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_storage_replication_status ON storage_replications(status, started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_storage_replication_agent ON storage_replications(replication_agent, started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_storage_replication_hash ON storage_replications(content_hash, started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_storage_replication_priority ON storage_replications(priority DESC, started_at)`
];
/**
 * UHRP advertisements for BRC-88 SHIP/SLAP integration
 */
D22StorageSchema.UHRP_ADVERTISEMENTS = `
    CREATE TABLE IF NOT EXISTS uhrp_advertisements (
      id SERIAL PRIMARY KEY,
      content_hash TEXT NOT NULL,
      advertisement_id TEXT UNIQUE NOT NULL,
      storage_provider TEXT NOT NULL,
      storage_capability JSONB NOT NULL,
      advertisement_data JSONB NOT NULL,
      resolution_endpoints TEXT[] NOT NULL,
      geographic_regions TEXT[] DEFAULT ARRAY['US']::TEXT[],
      bandwidth_mbps NUMERIC(10,2) DEFAULT 100.00,
      cost_per_gb_satoshis INTEGER DEFAULT 1000,
      ttl_hours INTEGER DEFAULT 24,
      signature TEXT,
      published_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP GENERATED ALWAYS AS (published_at + INTERVAL '1 hour' * ttl_hours) STORED,
      last_renewed_at TIMESTAMP,
      active BOOLEAN DEFAULT true
    )
  `;
D22StorageSchema.UHRP_ADVERTISEMENTS_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_uhrp_advertisements_hash ON uhrp_advertisements(content_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_uhrp_advertisements_provider ON uhrp_advertisements(storage_provider)`,
    `CREATE INDEX IF NOT EXISTS idx_uhrp_advertisements_expires ON uhrp_advertisements(expires_at) WHERE active = true`,
    `CREATE INDEX IF NOT EXISTS idx_uhrp_advertisements_regions ON uhrp_advertisements USING GIN(geographic_regions)`,
    `CREATE INDEX IF NOT EXISTS idx_uhrp_advertisements_cost ON uhrp_advertisements(cost_per_gb_satoshis)`
];
/**
 * Storage cache management and statistics
 */
D22StorageSchema.STORAGE_CACHE_STATS = `
    CREATE TABLE IF NOT EXISTS storage_cache_stats (
      id SERIAL PRIMARY KEY,
      content_hash TEXT NOT NULL,
      cache_level TEXT NOT NULL CHECK (cache_level IN ('memory', 'ssd', 'hdd', 'network')),
      cache_size_bytes BIGINT NOT NULL,
      hit_count INTEGER DEFAULT 0,
      miss_count INTEGER DEFAULT 0,
      eviction_count INTEGER DEFAULT 0,
      last_access_at TIMESTAMP DEFAULT NOW(),
      cached_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP,
      ttl_seconds INTEGER,
      cache_priority INTEGER DEFAULT 1 CHECK (cache_priority >= 1 AND cache_priority <= 10),
      access_pattern JSONB DEFAULT '{
        "frequency": 0,
        "recency": 0,
        "size_factor": 1.0,
        "geographic_locality": []
      }'::jsonb
    )
  `;
D22StorageSchema.STORAGE_CACHE_STATS_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_cache_stats_hash ON storage_cache_stats(content_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_cache_stats_level ON storage_cache_stats(cache_level, last_access_at)`,
    `CREATE INDEX IF NOT EXISTS idx_cache_stats_expires ON storage_cache_stats(expires_at) WHERE expires_at IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_cache_stats_priority ON storage_cache_stats(cache_priority DESC, last_access_at DESC)`
];
/**
 * Storage routing decisions and optimization
 */
D22StorageSchema.STORAGE_ROUTING_LOGS = `
    CREATE TABLE IF NOT EXISTS storage_routing_logs (
      id SERIAL PRIMARY KEY,
      content_hash TEXT NOT NULL,
      client_context JSONB NOT NULL,
      available_locations JSONB NOT NULL,
      selected_location JSONB NOT NULL,
      routing_score NUMERIC(10,4) NOT NULL,
      routing_reason TEXT NOT NULL,
      estimated_latency INTEGER,
      actual_latency INTEGER,
      cache_recommendation JSONB,
      decision_time_ms INTEGER DEFAULT 0,
      routed_at TIMESTAMP DEFAULT NOW()
    )
  `;
D22StorageSchema.STORAGE_ROUTING_LOGS_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_routing_logs_hash ON storage_routing_logs(content_hash, routed_at)`,
    `CREATE INDEX IF NOT EXISTS idx_routing_logs_score ON storage_routing_logs(routing_score DESC, routed_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_routing_logs_latency ON storage_routing_logs(estimated_latency, actual_latency)`
];
/**
 * Agent capability and performance tracking
 */
D22StorageSchema.STORAGE_AGENT_REGISTRY = `
    CREATE TABLE IF NOT EXISTS storage_agent_registry (
      id SERIAL PRIMARY KEY,
      agent_id TEXT UNIQUE NOT NULL,
      agent_type TEXT NOT NULL CHECK (agent_type IN ('replication', 'verification', 'monitoring', 'optimization')),
      capabilities TEXT[] NOT NULL,
      max_concurrent_jobs INTEGER DEFAULT 5,
      current_jobs INTEGER DEFAULT 0,
      reliability_score NUMERIC(3,2) DEFAULT 0.95 CHECK (reliability_score >= 0.0 AND reliability_score <= 1.0),
      average_job_time_minutes INTEGER DEFAULT 10,
      geographic_regions TEXT[] DEFAULT ARRAY['US']::TEXT[],
      cost_per_job_satoshis INTEGER DEFAULT 1000,
      last_heartbeat_at TIMESTAMP DEFAULT NOW(),
      registered_at TIMESTAMP DEFAULT NOW(),
      active BOOLEAN DEFAULT true,
      performance_metrics JSONB DEFAULT '{
        "jobs_completed": 0,
        "jobs_failed": 0,
        "total_bytes_processed": 0,
        "average_throughput_mbps": 0.0
      }'::jsonb
    )
  `;
D22StorageSchema.STORAGE_AGENT_REGISTRY_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_agent_registry_type ON storage_agent_registry(agent_type, active)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_registry_regions ON storage_agent_registry USING GIN(geographic_regions)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_registry_reliability ON storage_agent_registry(reliability_score DESC) WHERE active = true`,
    `CREATE INDEX IF NOT EXISTS idx_agent_registry_heartbeat ON storage_agent_registry(last_heartbeat_at) WHERE active = true`
];
/**
 * Storage performance metrics aggregation
 */
D22StorageSchema.STORAGE_PERFORMANCE_METRICS = `
    CREATE TABLE IF NOT EXISTS storage_performance_metrics (
      id SERIAL PRIMARY KEY,
      metric_type TEXT NOT NULL CHECK (metric_type IN ('throughput', 'latency', 'availability', 'cost', 'cache_hit_rate')),
      storage_location TEXT NOT NULL CHECK (storage_location IN ('local', 'overlay', 'uhrp', 's3', 'cdn')),
      geographic_region TEXT DEFAULT 'US',
      metric_value NUMERIC(15,4) NOT NULL,
      metric_unit TEXT NOT NULL,
      sample_count INTEGER DEFAULT 1,
      measurement_window INTERVAL DEFAULT INTERVAL '1 hour',
      measured_at TIMESTAMP DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb
    )
  `;
D22StorageSchema.STORAGE_PERFORMANCE_METRICS_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_perf_metrics_type ON storage_performance_metrics(metric_type, measured_at)`,
    `CREATE INDEX IF NOT EXISTS idx_perf_metrics_location ON storage_performance_metrics(storage_location, measured_at)`,
    `CREATE INDEX IF NOT EXISTS idx_perf_metrics_region ON storage_performance_metrics(geographic_region, measured_at)`
];
exports.default = D22StorageSchema;
//# sourceMappingURL=schema-d22-overlay-storage.js.map