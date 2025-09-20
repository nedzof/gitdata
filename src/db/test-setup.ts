// Test database setup for integration tests
// Uses SQLite for tests to avoid dependency on external services
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testDb: Database.Database | null = null;

export function getTestDatabase(): Database.Database {
  if (testDb && testDb.open) {
    return testDb;
  }

  // Use in-memory SQLite for tests
  testDb = new Database(':memory:');

  // Initialize test schema with minimal required tables
  const initSQL = `
    CREATE TABLE IF NOT EXISTS manifests (
      version_id TEXT PRIMARY KEY,
      manifest_hash TEXT NOT NULL,
      content_hash TEXT,
      title TEXT,
      license TEXT,
      classification TEXT,
      created_at TEXT,
      manifest_json TEXT NOT NULL,
      dataset_id TEXT,
      producer_id TEXT
    );

    CREATE TABLE IF NOT EXISTS declarations (
      version_id TEXT PRIMARY KEY,
      txid TEXT UNIQUE,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      block_hash TEXT,
      height INTEGER,
      opret_vout INTEGER,
      raw_tx TEXT,
      proof_json TEXT
    );

    CREATE TABLE IF NOT EXISTS producers (
      producer_id TEXT PRIMARY KEY,
      name TEXT,
      website TEXT,
      identity_key TEXT,
      payout_script_hex TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      receipt_id TEXT PRIMARY KEY,
      version_id TEXT,
      quantity INTEGER NOT NULL,
      content_hash TEXT,
      amount_sat INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      bytes_used INTEGER DEFAULT 0,
      last_seen INTEGER,
      payment_txid TEXT,
      paid_at INTEGER,
      payment_outputs_json TEXT,
      fee_sat INTEGER,
      quote_template_hash TEXT,
      quote_expires_at INTEGER,
      unit_price_sat INTEGER
    );

    CREATE TABLE IF NOT EXISTS revenue_events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      amount_sat INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'pay'
    );

    CREATE TABLE IF NOT EXISTS edges (
      child_version_id TEXT NOT NULL,
      parent_version_id TEXT NOT NULL,
      PRIMARY KEY (child_version_id, parent_version_id)
    );

    CREATE TABLE IF NOT EXISTS prices (
      version_id TEXT PRIMARY KEY,
      satoshis INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_rules (
      rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id TEXT,
      producer_id TEXT,
      tier_from INTEGER NOT NULL DEFAULT 1,
      satoshis INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS advisories (
      advisory_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      payload_json TEXT
    );

    CREATE TABLE IF NOT EXISTS agents (
      agent_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      identity_key TEXT,
      status TEXT DEFAULT 'unknown',
      last_ping_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rules (
      rule_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      when_json TEXT NOT NULL,
      find_json TEXT NOT NULL,
      actions_json TEXT NOT NULL,
      owner_producer_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      target_id TEXT,
      state TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_run_at INTEGER NOT NULL,
      last_error TEXT,
      evidence_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contract_templates (
      template_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      template_content TEXT NOT NULL,
      template_type TEXT DEFAULT 'pdf',
      variables_json TEXT,
      owner_producer_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      artifact_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      file_path TEXT,
      content_data BLOB,
      version_id TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      published_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS payment_events (
      event_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      receipt_id TEXT,
      txid TEXT,
      details_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS storage_events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      content_hash TEXT,
      from_tier TEXT,
      to_tier TEXT,
      reason TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      estimated_savings REAL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingest_sources (
      source_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source_type TEXT NOT NULL DEFAULT 'webhook',
      mapping_json TEXT,
      validation_json TEXT,
      fusion_policy_json TEXT,
      trust_weight REAL NOT NULL DEFAULT 1.0,
      rate_limit_per_min INTEGER DEFAULT 1000,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_heartbeat INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingest_events (
      event_id TEXT PRIMARY KEY,
      source_id TEXT,
      external_id TEXT,
      raw_json TEXT NOT NULL,
      normalized_json TEXT,
      status TEXT NOT NULL,
      last_error TEXT,
      content_hash TEXT,
      version_id TEXT,
      parent_hashes TEXT,
      lineage_json TEXT,
      evidence_json TEXT,
      conflict_resolution TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      certified_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS ingest_jobs (
      job_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      job_type TEXT NOT NULL DEFAULT 'process',
      priority INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      next_run_at INTEGER NOT NULL,
      last_error TEXT,
      evidence_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `;

  testDb.exec(initSQL);
  console.log('Test database initialized with SQLite');

  return testDb;
}

export function closeTestDatabase(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

// Test environment detection
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' ||
         process.env.VITEST === 'true' ||
         process.argv.includes('vitest');
}