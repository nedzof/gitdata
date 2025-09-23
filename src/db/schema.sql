-- Tables
CREATE TABLE IF NOT EXISTS declarations (
  version_id TEXT PRIMARY KEY,
  txid TEXT UNIQUE,
  type TEXT NOT NULL,                -- 'DLM1' | 'TRN1' | 'UNKNOWN'
  status TEXT DEFAULT 'pending',     -- 'pending' | 'confirmed'
  created_at INTEGER NOT NULL,       -- epoch seconds
  block_hash TEXT,
  height INTEGER,
  opret_vout INTEGER,
  raw_tx TEXT,                       -- raw transaction hex (optional)
  proof_json TEXT                    -- spv-envelope JSON string (optional)
);

CREATE INDEX IF NOT EXISTS idx_declarations_txid ON declarations(txid);
CREATE INDEX IF NOT EXISTS idx_declarations_status ON declarations(status);

CREATE TABLE IF NOT EXISTS manifests (
  version_id TEXT PRIMARY KEY,
  manifest_hash TEXT NOT NULL,
  content_hash TEXT,
  title TEXT,
  license TEXT,
  classification TEXT,
  created_at TEXT,                   -- ISO date-time from manifest.provenance.createdAt
  manifest_json TEXT NOT NULL,
  dataset_id TEXT,
  producer_id TEXT
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

-- Receipts: add counters bytes_used and last_seen for D07
CREATE TABLE IF NOT EXISTS receipts (
  receipt_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  content_hash TEXT,
  amount_sat INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'paid'|'consumed'|'expired'
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  bytes_used INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER
);

-- Revenue events (simple append-only log)
CREATE TABLE IF NOT EXISTS revenue_events (
  event_id SERIAL PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  amount_sat INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'pay' -- 'pay' | 'refund' | 'adjust'
);

-- Helpful indexes (optional)
CREATE INDEX IF NOT EXISTS idx_receipts_version ON receipts(version_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_revenue_version ON revenue_events(version_id);
CREATE INDEX IF NOT EXISTS idx_revenue_receipt ON revenue_events(receipt_id);

-- Producers registry
CREATE TABLE IF NOT EXISTS producers (
  producer_id TEXT PRIMARY KEY,
  name TEXT,
  display_name TEXT,
  website TEXT,
  identity_key TEXT UNIQUE, -- hex compressed pubkey (66 chars), optional-unique
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_producers_identity ON producers(identity_key);

-- Indexes for manifests dataset_id and producer_id columns
CREATE INDEX IF NOT EXISTS idx_manifests_dataset ON manifests(dataset_id);
CREATE INDEX IF NOT EXISTS idx_manifests_producer ON manifests(producer_id);

-- Price rules with optional version or producer scope and tiering
CREATE TABLE IF NOT EXISTS price_rules (
  rule_id SERIAL PRIMARY KEY,
  version_id TEXT,            -- 64-hex, nullable
  producer_id TEXT,           -- from producers.producer_id, nullable
  tier_from INTEGER NOT NULL DEFAULT 1,   -- quantity threshold (inclusive)
  satoshis INTEGER NOT NULL,             -- unit price at/above tier_from
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Uniqueness per scope+tier (SQLite allows multiple NULLs for nullable columns)
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_rules_version_tier ON price_rules(version_id, tier_from);
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_rules_producer_tier ON price_rules(producer_id, tier_from);
CREATE INDEX IF NOT EXISTS idx_price_rules_version ON price_rules(version_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_producer ON price_rules(producer_id);

-- Advisories & Targets
CREATE TABLE IF NOT EXISTS advisories (
  advisory_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                          -- 'BLOCK'|'WARN'
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,                           -- nullable
  payload_json TEXT                             -- optional, arbitrary JSON
);

CREATE TABLE IF NOT EXISTS advisory_targets (
  advisory_id TEXT NOT NULL,
  version_id TEXT,                              -- scope by version
  producer_id TEXT,                             -- scope by producer
  PRIMARY KEY (advisory_id, version_id, producer_id)
);

CREATE INDEX IF NOT EXISTS idx_adv_targets_version ON advisory_targets(version_id);
CREATE INDEX IF NOT EXISTS idx_adv_targets_producer ON advisory_targets(producer_id);

-- D24: Agent Marketplace & Automation
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
CREATE INDEX IF NOT EXISTS idx_agents_identity ON agents(identity_key);

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
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);

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
CREATE INDEX IF NOT EXISTS idx_jobs_state_next ON jobs(state, next_run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_rule ON jobs(rule_id);

-- Contract templates for automation workflows
CREATE TABLE IF NOT EXISTS contract_templates (
  template_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_content TEXT NOT NULL,    -- Template content with placeholders
  template_type TEXT DEFAULT 'pdf',  -- 'pdf', 'markdown', 'html', 'json'
  variables_json TEXT,               -- JSON schema for template variables
  owner_producer_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_templates_owner ON contract_templates(owner_producer_id);

-- Artifacts storage for generated contracts and documents
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,        -- 'contract/pdf', 'contract/markdown', 'document/json', etc.
  content_hash TEXT NOT NULL,
  file_path TEXT,                     -- Local file system path (optional)
  content_data BYTEA,                 -- Inline content for small artifacts
  version_id TEXT,                    -- DLM1 versionId if published on-chain
  metadata_json TEXT,                 -- Additional metadata
  created_at INTEGER NOT NULL,
  published_at INTEGER                -- When artifact was published to DLM1
);
CREATE INDEX IF NOT EXISTS idx_artifacts_job ON artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_version ON artifacts(version_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_hash ON artifacts(content_hash);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(artifact_type);
