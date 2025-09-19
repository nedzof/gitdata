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
  manifest_json TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS prices (
  version_id TEXT PRIMARY KEY,
  satoshis INTEGER NOT NULL
);

-- Revenue events (simple append-only log)
CREATE TABLE IF NOT EXISTS revenue_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
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
