/**
 * Setup all missing schemas for integration tests
 */

import { getHybridDatabase } from '../src/db/hybrid.js';
import fs from 'fs';
import path from 'path';

async function setupMissingSchemas() {
  const db = getHybridDatabase();

  try {
    console.log('🔄 Setting up missing database schemas...');

    // Create minimal overlay_receipts table if it doesn't exist
    await db.pg.query(`
      CREATE TABLE IF NOT EXISTS overlay_receipts (
        receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version_id TEXT NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        payer_address VARCHAR(50) NOT NULL,
        unit_price_satoshis BIGINT NOT NULL,
        total_satoshis BIGINT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        quota_tier VARCHAR(20) DEFAULT 'standard',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Add missing columns to existing table
      ALTER TABLE overlay_receipts ADD COLUMN IF NOT EXISTS quota_tier VARCHAR(20) DEFAULT 'standard';
    `);
    console.log('✅ overlay_receipts table created');

    // Create D07 streaming tables
    await db.pg.query(`
      CREATE TABLE IF NOT EXISTS streaming_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_id UUID REFERENCES overlay_receipts(receipt_id),
        content_hash VARCHAR(64) NOT NULL,
        session_id UUID NOT NULL,
        bytes_streamed BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quota_usage_windows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_id UUID REFERENCES overlay_receipts(receipt_id),
        window_type VARCHAR(10) NOT NULL,
        window_start TIMESTAMP NOT NULL,
        window_end TIMESTAMP NOT NULL,
        bytes_used BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS agent_streaming_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id VARCHAR(255),
        receipt_id UUID REFERENCES overlay_receipts(receipt_id),
        session_status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ D07 streaming tables created');

    // Create missing D24 overlay tables
    await db.pg.query(`
      -- First, drop existing tables if they have incompatible schemas
      DROP TABLE IF EXISTS overlay_jobs CASCADE;
      DROP TABLE IF EXISTS overlay_rules CASCADE;
      DROP TABLE IF EXISTS overlay_agents CASCADE;

      -- Overlay agents table for D24 tests
      CREATE TABLE overlay_agents (
        agent_id TEXT PRIMARY KEY,
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

      -- Overlay jobs table for D24 tests
      CREATE TABLE overlay_jobs (
        job_id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        agent_id TEXT,
        target_id TEXT,
        status TEXT DEFAULT 'queued',
        priority INTEGER DEFAULT 50,
        scheduled_at BIGINT,
        payload JSONB DEFAULT '{}',
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        last_error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Overlay rules table for D24 tests
      CREATE TABLE overlay_rules (
        rule_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        trigger_config JSONB NOT NULL,
        action_config JSONB NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX idx_overlay_agents_region ON overlay_agents(geographic_region);
      CREATE INDEX idx_overlay_agents_status ON overlay_agents(status);
      CREATE INDEX idx_overlay_jobs_rule_id ON overlay_jobs(rule_id);
      CREATE INDEX idx_overlay_jobs_status ON overlay_jobs(status);
      CREATE INDEX idx_overlay_jobs_agent_id ON overlay_jobs(agent_id);
      CREATE INDEX idx_overlay_rules_enabled ON overlay_rules(enabled);
    `);
    console.log('✅ D24 overlay tables created');

    console.log('✅ All missing schemas set up successfully!');

  } catch (error) {
    console.error('❌ Error setting up schemas:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setupMissingSchemas()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { setupMissingSchemas };