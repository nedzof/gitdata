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

CREATE TABLE IF NOT EXISTS receipts (
  receipt_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
