-- PostgreSQL Schema for D022HR
-- Migration from SQLite to PostgreSQL with hybrid Redis cache

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Producers/Users
CREATE TABLE IF NOT EXISTS producers (
  producer_id  TEXT PRIMARY KEY,
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
  user_id      TEXT PRIMARY KEY,
  identity_key TEXT NOT NULL,
  display_name TEXT,
  role         TEXT CHECK (role IN ('admin','producer','consumer')) DEFAULT 'consumer',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_identity ON users(identity_key);

-- Agents (registry)
CREATE TABLE IF NOT EXISTS agents (
  agent_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  webhook_url       TEXT NOT NULL,
  capabilities      JSONB NOT NULL DEFAULT '[]',
  capabilities_json TEXT NOT NULL DEFAULT '[]',  -- Legacy compatibility column
  identity_key      TEXT,
  status            TEXT CHECK (status IN ('unknown','up','down')) DEFAULT 'unknown',
  last_ping_at      BIGINT,  -- Use BIGINT for compatibility with legacy code
  created_at        BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000,  -- Unix timestamp in milliseconds
  updated_at        BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000
);

-- Catalog (Datasets/Models)
CREATE TABLE IF NOT EXISTS assets (
  version_id   TEXT PRIMARY KEY,
  dataset_id   TEXT,
  producer_id  TEXT REFERENCES producers(producer_id),
  name         TEXT,
  description  TEXT,
  content_hash TEXT NOT NULL,
  mime_type    TEXT,
  size_bytes   BIGINT,
  policy_meta  JSONB,         -- license, classification, etc.
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_dataset ON assets(dataset_id);
CREATE INDEX IF NOT EXISTS idx_assets_producer ON assets(producer_id);
CREATE INDEX IF NOT EXISTS idx_assets_updated ON assets(updated_at DESC);

-- Policies (JSONB), Versionierung optional
CREATE TABLE IF NOT EXISTS policies (
  policy_id    TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  doc          JSONB NOT NULL,   -- D28 policy JSON
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Policy Runs (Audit)
CREATE TABLE IF NOT EXISTS policy_runs (
  run_id       TEXT PRIMARY KEY,
  policy_id    TEXT REFERENCES policies(policy_id),
  version_id   TEXT REFERENCES assets(version_id),
  decision     TEXT CHECK (decision IN ('allow','warn','block')),
  reasons      JSONB NOT NULL DEFAULT '[]',
  evidence     JSONB,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_policy_runs_policy ON policy_runs(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_runs_version ON policy_runs(version_id);

-- Payments (quote/receipt)
CREATE TABLE IF NOT EXISTS receipts (
  receipt_id     TEXT PRIMARY KEY,
  version_id     TEXT NOT NULL,  -- Remove foreign key constraint to assets
  quantity       INTEGER NOT NULL,
  content_hash   TEXT,
  amount_sat     INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'paid'|'consumed'|'expired'
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL,
  bytes_used     INTEGER NOT NULL DEFAULT 0,
  last_seen      INTEGER,
  -- Additional PostgreSQL-specific columns for future use
  payment_txid   TEXT,       -- hex (64)
  unit_price_sat BIGINT,
  fee_sat        BIGINT,
  outputs_json   JSONB,      -- required UTXO outputs
  quote_template_hash TEXT,  -- hex (64)
  quote_expires_at TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Drop foreign key constraint and add missing columns if they don't exist
DO $$
BEGIN
  -- Drop foreign key constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'receipts_version_id_fkey') THEN
    ALTER TABLE receipts DROP CONSTRAINT receipts_version_id_fkey;
  END IF;

  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'content_hash') THEN
    ALTER TABLE receipts ADD COLUMN content_hash TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'amount_sat') THEN
    ALTER TABLE receipts ADD COLUMN amount_sat INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'expires_at') THEN
    ALTER TABLE receipts ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'bytes_used') THEN
    ALTER TABLE receipts ADD COLUMN bytes_used INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'last_seen') THEN
    ALTER TABLE receipts ADD COLUMN last_seen INTEGER;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_receipts_version ON receipts(version_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);

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
CREATE INDEX IF NOT EXISTS idx_lineage_event_time ON lineage_event_audit(event_time DESC);

-- Legacy tables for migration compatibility
-- These will map to the PostgreSQL tables above

-- Declarations (legacy from SQLite)
CREATE TABLE IF NOT EXISTS declarations (
  version_id TEXT PRIMARY KEY,
  txid TEXT UNIQUE,
  type TEXT NOT NULL,                -- 'DLM1' | 'TRN1' | 'UNKNOWN'
  status TEXT DEFAULT 'pending',     -- 'pending' | 'confirmed'
  created_at BIGINT NOT NULL,        -- epoch seconds (keep as bigint for compatibility)
  block_hash TEXT,
  height INTEGER,
  opret_vout INTEGER,
  raw_tx TEXT,                       -- raw transaction hex (optional)
  proof_json TEXT                    -- spv-envelope JSON string (optional)
);
CREATE INDEX IF NOT EXISTS idx_declarations_txid ON declarations(txid);
CREATE INDEX IF NOT EXISTS idx_declarations_status ON declarations(status);

-- Manifests (legacy from SQLite, will map to assets)
CREATE TABLE IF NOT EXISTS manifests (
  version_id TEXT PRIMARY KEY,
  manifest_hash TEXT NOT NULL,
  content_hash TEXT,
  title TEXT,
  name TEXT,                        -- Added for compatibility
  license TEXT,
  classification TEXT,
  created_at TEXT,                   -- ISO date-time from manifest.provenance.createdAt
  manifest_json TEXT NOT NULL,
  dataset_id TEXT,
  producer_id TEXT REFERENCES producers(producer_id)
);
CREATE INDEX IF NOT EXISTS idx_manifests_dataset ON manifests(dataset_id);
CREATE INDEX IF NOT EXISTS idx_manifests_producer ON manifests(producer_id);

-- Edges for lineage
CREATE TABLE IF NOT EXISTS edges (
  child_version_id TEXT NOT NULL,
  parent_version_id TEXT NOT NULL,
  PRIMARY KEY (child_version_id, parent_version_id)
);

-- Prices
CREATE TABLE IF NOT EXISTS prices (
  version_id TEXT PRIMARY KEY,
  satoshis INTEGER NOT NULL
);

-- Revenue events
CREATE TABLE IF NOT EXISTS revenue_events (
  event_id SERIAL PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  amount_sat INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  created_at BIGINT NOT NULL,
  type TEXT NOT NULL DEFAULT 'pay' -- 'pay' | 'refund' | 'adjust'
);
CREATE INDEX IF NOT EXISTS idx_revenue_version ON revenue_events(version_id);
CREATE INDEX IF NOT EXISTS idx_revenue_receipt ON revenue_events(receipt_id);

-- Price rules with optional version or producer scope and tiering
CREATE TABLE IF NOT EXISTS price_rules (
  rule_id SERIAL PRIMARY KEY,
  version_id TEXT,            -- 64-hex, nullable
  producer_id TEXT REFERENCES producers(producer_id),           -- from producers.producer_id, nullable
  tier_from INTEGER NOT NULL DEFAULT 1,   -- quantity threshold (inclusive)
  satoshis INTEGER NOT NULL,             -- unit price at/above tier_from
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_rules_version_tier ON price_rules(version_id, tier_from) WHERE version_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_rules_producer_tier ON price_rules(producer_id, tier_from) WHERE producer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_rules_version ON price_rules(version_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_producer ON price_rules(producer_id);

-- Advisories & Targets
CREATE TABLE IF NOT EXISTS advisories (
  advisory_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                          -- 'BLOCK'|'WARN'
  reason TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT,                           -- nullable
  payload_json TEXT                             -- optional, arbitrary JSON
);

CREATE TABLE IF NOT EXISTS advisory_targets (
  advisory_id TEXT NOT NULL,
  version_id TEXT,                              -- scope by version
  producer_id TEXT REFERENCES producers(producer_id),                             -- scope by producer
  UNIQUE (advisory_id, version_id, producer_id)
);
CREATE INDEX IF NOT EXISTS idx_adv_targets_version ON advisory_targets(version_id);
CREATE INDEX IF NOT EXISTS idx_adv_targets_producer ON advisory_targets(producer_id);

-- Rules
CREATE TABLE IF NOT EXISTS rules (
  rule_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  when_json TEXT NOT NULL,
  find_json TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  owner_producer_id TEXT REFERENCES producers(producer_id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES rules(rule_id),
  target_id TEXT,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_run_at BIGINT NOT NULL,
  last_error TEXT,
  evidence_json TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
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
  owner_producer_id TEXT REFERENCES producers(producer_id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_templates_owner ON contract_templates(owner_producer_id);

-- Artifacts storage for generated contracts and documents
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(job_id),
  artifact_type TEXT NOT NULL,        -- 'contract/pdf', 'contract/markdown', 'document/json', etc.
  content_hash TEXT NOT NULL,
  file_path TEXT,                     -- Local file system path (optional)
  content_data BYTEA,                 -- Inline content for small artifacts (BYTEA for PostgreSQL)
  version_id TEXT,                    -- DLM1 versionId if published on-chain
  metadata_json TEXT,                 -- Additional metadata
  created_at BIGINT NOT NULL,
  published_at BIGINT                -- When artifact was published to DLM1
);
CREATE INDEX IF NOT EXISTS idx_artifacts_job ON artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_version ON artifacts(version_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_hash ON artifacts(content_hash);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(artifact_type);

-- OpenLineage tables for D38/D41 support
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
CREATE INDEX IF NOT EXISTS idx_ol_events_time ON ol_events(event_time);
CREATE INDEX IF NOT EXISTS idx_ol_events_namespace ON ol_events(namespace);
CREATE INDEX IF NOT EXISTS idx_ol_events_job ON ol_events(namespace, job_name);

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
CREATE INDEX IF NOT EXISTS idx_ol_edges_namespace ON ol_edges(namespace);
CREATE INDEX IF NOT EXISTS idx_ol_edges_parent ON ol_edges(namespace, parent_dataset_name);
CREATE INDEX IF NOT EXISTS idx_ol_edges_child ON ol_edges(namespace, child_dataset_name);

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
CREATE INDEX IF NOT EXISTS idx_ol_dlq_next_try ON ol_dlq(next_try_at) WHERE next_try_at IS NOT NULL;