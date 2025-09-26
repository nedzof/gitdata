/**
 * D22 - BSV Overlay Network Storage Backend
 * Database Schema Definition using TypeScript SQL
 * Creates all necessary tables for overlay storage with BRC-26 UHRP integration
 */
import type { Pool } from 'pg';
export declare class D22StorageSchema {
    /**
     * Enhanced storage tracking with overlay integration
     */
    static readonly OVERLAY_STORAGE_INDEX = "\n    CREATE TABLE IF NOT EXISTS overlay_storage_index (\n      content_hash TEXT PRIMARY KEY,\n      version_id TEXT NOT NULL,\n      storage_tier TEXT DEFAULT 'hot' CHECK (storage_tier IN ('hot', 'warm', 'cold', 'overlay')),\n      local_path TEXT,\n      overlay_uhrp_url TEXT,\n      s3_key TEXT,\n      cdn_url TEXT,\n      file_size BIGINT NOT NULL,\n      mime_type TEXT,\n      storage_locations JSONB DEFAULT '[]'::jsonb,\n      replication_status JSONB DEFAULT '{}'::jsonb,\n      overlay_advertisements TEXT[] DEFAULT ARRAY[]::TEXT[],\n      last_verified_at TIMESTAMP,\n      verification_agents TEXT[] DEFAULT ARRAY[]::TEXT[],\n      access_statistics JSONB DEFAULT '{\n        \"accessFrequency\": 0,\n        \"updateFrequency\": 0,\n        \"totalAccesses\": 0,\n        \"uniqueClients\": 0\n      }'::jsonb,\n      created_at TIMESTAMP DEFAULT NOW(),\n      updated_at TIMESTAMP DEFAULT NOW(),\n      FOREIGN KEY (version_id) REFERENCES manifests(version_id) ON DELETE CASCADE\n    )\n  ";
    static readonly OVERLAY_STORAGE_INDEX_INDEXES: string[];
    /**
     * Storage verification and integrity tracking
     */
    static readonly STORAGE_VERIFICATIONS = "\n    CREATE TABLE IF NOT EXISTS storage_verifications (\n      id SERIAL PRIMARY KEY,\n      content_hash TEXT NOT NULL,\n      verification_type TEXT NOT NULL CHECK (verification_type IN ('hash', 'availability', 'integrity', 'full')),\n      storage_location TEXT NOT NULL CHECK (storage_location IN ('local', 'overlay', 'uhrp', 's3', 'cdn')),\n      verification_agent TEXT,\n      verification_result BOOLEAN NOT NULL,\n      response_time_ms INTEGER,\n      error_details JSONB,\n      overlay_evidence JSONB,\n      verified_at TIMESTAMP DEFAULT NOW()\n    )\n  ";
    static readonly STORAGE_VERIFICATIONS_INDEXES: string[];
    /**
     * Storage access and download tracking
     */
    static readonly STORAGE_ACCESS_LOGS = "\n    CREATE TABLE IF NOT EXISTS storage_access_logs (\n      id SERIAL PRIMARY KEY,\n      content_hash TEXT NOT NULL,\n      access_method TEXT NOT NULL CHECK (access_method IN ('local', 'uhrp', 'overlay', 'presigned', 'cdn', 's3')),\n      client_id TEXT,\n      bytes_transferred BIGINT DEFAULT 0,\n      range_start BIGINT,\n      range_end BIGINT,\n      response_time_ms INTEGER,\n      success BOOLEAN NOT NULL,\n      overlay_route JSONB,\n      geographic_location TEXT,\n      network_type TEXT CHECK (network_type IN ('mobile', 'wifi', 'ethernet')),\n      user_agent TEXT,\n      accessed_at TIMESTAMP DEFAULT NOW()\n    )\n  ";
    static readonly STORAGE_ACCESS_LOGS_INDEXES: string[];
    /**
     * Storage replication coordination
     */
    static readonly STORAGE_REPLICATIONS = "\n    CREATE TABLE IF NOT EXISTS storage_replications (\n      id SERIAL PRIMARY KEY,\n      content_hash TEXT NOT NULL,\n      source_location TEXT NOT NULL CHECK (source_location IN ('local', 'overlay', 'uhrp', 's3', 'cdn')),\n      target_location TEXT NOT NULL CHECK (target_location IN ('local', 'overlay', 'uhrp', 's3', 'cdn')),\n      replication_agent TEXT,\n      replication_job_id TEXT,\n      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),\n      progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),\n      bytes_replicated BIGINT DEFAULT 0,\n      error_message TEXT,\n      overlay_job_evidence JSONB,\n      priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),\n      retry_count INTEGER DEFAULT 0,\n      max_retries INTEGER DEFAULT 3,\n      started_at TIMESTAMP DEFAULT NOW(),\n      completed_at TIMESTAMP,\n      CONSTRAINT chk_replication_different_locations CHECK (source_location != target_location)\n    )\n  ";
    static readonly STORAGE_REPLICATIONS_INDEXES: string[];
    /**
     * UHRP advertisements for BRC-88 SHIP/SLAP integration
     */
    static readonly UHRP_ADVERTISEMENTS = "\n    CREATE TABLE IF NOT EXISTS uhrp_advertisements (\n      id SERIAL PRIMARY KEY,\n      content_hash TEXT NOT NULL,\n      advertisement_id TEXT UNIQUE NOT NULL,\n      storage_provider TEXT NOT NULL,\n      storage_capability JSONB NOT NULL,\n      advertisement_data JSONB NOT NULL,\n      resolution_endpoints TEXT[] NOT NULL,\n      geographic_regions TEXT[] DEFAULT ARRAY['US']::TEXT[],\n      bandwidth_mbps NUMERIC(10,2) DEFAULT 100.00,\n      cost_per_gb_satoshis INTEGER DEFAULT 1000,\n      ttl_hours INTEGER DEFAULT 24,\n      signature TEXT,\n      published_at TIMESTAMP DEFAULT NOW(),\n      expires_at TIMESTAMP GENERATED ALWAYS AS (published_at + INTERVAL '1 hour' * ttl_hours) STORED,\n      last_renewed_at TIMESTAMP,\n      active BOOLEAN DEFAULT true\n    )\n  ";
    static readonly UHRP_ADVERTISEMENTS_INDEXES: string[];
    /**
     * Storage cache management and statistics
     */
    static readonly STORAGE_CACHE_STATS = "\n    CREATE TABLE IF NOT EXISTS storage_cache_stats (\n      id SERIAL PRIMARY KEY,\n      content_hash TEXT NOT NULL,\n      cache_level TEXT NOT NULL CHECK (cache_level IN ('memory', 'ssd', 'hdd', 'network')),\n      cache_size_bytes BIGINT NOT NULL,\n      hit_count INTEGER DEFAULT 0,\n      miss_count INTEGER DEFAULT 0,\n      eviction_count INTEGER DEFAULT 0,\n      last_access_at TIMESTAMP DEFAULT NOW(),\n      cached_at TIMESTAMP DEFAULT NOW(),\n      expires_at TIMESTAMP,\n      ttl_seconds INTEGER,\n      cache_priority INTEGER DEFAULT 1 CHECK (cache_priority >= 1 AND cache_priority <= 10),\n      access_pattern JSONB DEFAULT '{\n        \"frequency\": 0,\n        \"recency\": 0,\n        \"size_factor\": 1.0,\n        \"geographic_locality\": []\n      }'::jsonb\n    )\n  ";
    static readonly STORAGE_CACHE_STATS_INDEXES: string[];
    /**
     * Storage routing decisions and optimization
     */
    static readonly STORAGE_ROUTING_LOGS = "\n    CREATE TABLE IF NOT EXISTS storage_routing_logs (\n      id SERIAL PRIMARY KEY,\n      content_hash TEXT NOT NULL,\n      client_context JSONB NOT NULL,\n      available_locations JSONB NOT NULL,\n      selected_location JSONB NOT NULL,\n      routing_score NUMERIC(10,4) NOT NULL,\n      routing_reason TEXT NOT NULL,\n      estimated_latency INTEGER,\n      actual_latency INTEGER,\n      cache_recommendation JSONB,\n      decision_time_ms INTEGER DEFAULT 0,\n      routed_at TIMESTAMP DEFAULT NOW()\n    )\n  ";
    static readonly STORAGE_ROUTING_LOGS_INDEXES: string[];
    /**
     * Agent capability and performance tracking
     */
    static readonly STORAGE_AGENT_REGISTRY = "\n    CREATE TABLE IF NOT EXISTS storage_agent_registry (\n      id SERIAL PRIMARY KEY,\n      agent_id TEXT UNIQUE NOT NULL,\n      agent_type TEXT NOT NULL CHECK (agent_type IN ('replication', 'verification', 'monitoring', 'optimization')),\n      capabilities TEXT[] NOT NULL,\n      max_concurrent_jobs INTEGER DEFAULT 5,\n      current_jobs INTEGER DEFAULT 0,\n      reliability_score NUMERIC(3,2) DEFAULT 0.95 CHECK (reliability_score >= 0.0 AND reliability_score <= 1.0),\n      average_job_time_minutes INTEGER DEFAULT 10,\n      geographic_regions TEXT[] DEFAULT ARRAY['US']::TEXT[],\n      cost_per_job_satoshis INTEGER DEFAULT 1000,\n      last_heartbeat_at TIMESTAMP DEFAULT NOW(),\n      registered_at TIMESTAMP DEFAULT NOW(),\n      active BOOLEAN DEFAULT true,\n      performance_metrics JSONB DEFAULT '{\n        \"jobs_completed\": 0,\n        \"jobs_failed\": 0,\n        \"total_bytes_processed\": 0,\n        \"average_throughput_mbps\": 0.0\n      }'::jsonb\n    )\n  ";
    static readonly STORAGE_AGENT_REGISTRY_INDEXES: string[];
    /**
     * Storage performance metrics aggregation
     */
    static readonly STORAGE_PERFORMANCE_METRICS = "\n    CREATE TABLE IF NOT EXISTS storage_performance_metrics (\n      id SERIAL PRIMARY KEY,\n      metric_type TEXT NOT NULL CHECK (metric_type IN ('throughput', 'latency', 'availability', 'cost', 'cache_hit_rate')),\n      storage_location TEXT NOT NULL CHECK (storage_location IN ('local', 'overlay', 'uhrp', 's3', 'cdn')),\n      geographic_region TEXT DEFAULT 'US',\n      metric_value NUMERIC(15,4) NOT NULL,\n      metric_unit TEXT NOT NULL,\n      sample_count INTEGER DEFAULT 1,\n      measurement_window INTERVAL DEFAULT INTERVAL '1 hour',\n      measured_at TIMESTAMP DEFAULT NOW(),\n      metadata JSONB DEFAULT '{}'::jsonb\n    )\n  ";
    static readonly STORAGE_PERFORMANCE_METRICS_INDEXES: string[];
    /**
     * Apply complete D22 schema to database
     */
    static applySchema(pool: Pool): Promise<void>;
    /**
     * Create optimized views for common queries
     */
    static createViews(pool: Pool): Promise<void>;
    /**
     * Initialize with sample data for testing
     */
    static seedTestData(pool: Pool): Promise<void>;
}
export default D22StorageSchema;
