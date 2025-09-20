-- D38: OpenLineage Schema Extension
-- This adds OpenLineage-compatible storage and query capabilities

-- OpenLineage raw events storage (idempotent via hash)
CREATE TABLE IF NOT EXISTS ol_events (
  event_id TEXT PRIMARY KEY,           -- ol_<rand+ts>
  event_time TEXT NOT NULL,            -- ISO UTC timestamp
  namespace TEXT NOT NULL,             -- overlay:prod|staging|dev
  job_name TEXT NOT NULL,              -- publish::<versionId>
  run_id TEXT NOT NULL,                -- txid or sha256(versionId|createdAt)
  event_type TEXT NOT NULL,            -- START|COMPLETE|ABORT
  payload_json TEXT NOT NULL,          -- full OL event JSON
  hash TEXT UNIQUE NOT NULL,           -- sha256(payload_json) for idempotency
  created_at INTEGER NOT NULL          -- unix timestamp when stored
);

-- OpenLineage jobs (aggregated view)
CREATE TABLE IF NOT EXISTS ol_jobs (
  job_id TEXT PRIMARY KEY,             -- namespace:job_name
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,                  -- job.name from events
  latest_facets_json TEXT,             -- latest job facets
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(namespace, name)
);

-- OpenLineage runs (aggregated view)
CREATE TABLE IF NOT EXISTS ol_runs (
  run_key TEXT PRIMARY KEY,            -- namespace:job_name:run_id
  namespace TEXT NOT NULL,
  job_name TEXT NOT NULL,
  run_id TEXT NOT NULL,
  state TEXT NOT NULL,                 -- START|COMPLETE|ABORT
  start_time TEXT,                     -- ISO timestamp
  end_time TEXT,                       -- ISO timestamp
  facets_json TEXT,                    -- run facets
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(namespace, job_name, run_id)
);

-- OpenLineage datasets (aggregated view)
CREATE TABLE IF NOT EXISTS ol_datasets (
  dataset_key TEXT PRIMARY KEY,        -- namespace:name
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,                  -- dataset.name (versionId)
  latest_facets_json TEXT,             -- latest dataset facets
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(namespace, name)
);

-- OpenLineage edges (lineage graph)
CREATE TABLE IF NOT EXISTS ol_edges (
  edge_id TEXT PRIMARY KEY,            -- generated
  namespace TEXT NOT NULL,
  parent_dataset_name TEXT NOT NULL,   -- parent versionId
  child_dataset_name TEXT NOT NULL,    -- child versionId
  run_id TEXT NOT NULL,                -- which run created this edge
  created_at INTEGER NOT NULL,
  UNIQUE(namespace, parent_dataset_name, child_dataset_name, run_id)
);

-- Indexes for OpenLineage tables
CREATE INDEX IF NOT EXISTS idx_ol_events_namespace_job ON ol_events(namespace, job_name);
CREATE INDEX IF NOT EXISTS idx_ol_events_run ON ol_events(namespace, job_name, run_id);
CREATE INDEX IF NOT EXISTS idx_ol_events_time ON ol_events(event_time);
CREATE INDEX IF NOT EXISTS idx_ol_events_hash ON ol_events(hash);

CREATE INDEX IF NOT EXISTS idx_ol_runs_job ON ol_runs(namespace, job_name);
CREATE INDEX IF NOT EXISTS idx_ol_runs_state ON ol_runs(state);
CREATE INDEX IF NOT EXISTS idx_ol_runs_end_time ON ol_runs(end_time);

CREATE INDEX IF NOT EXISTS idx_ol_datasets_namespace ON ol_datasets(namespace);
CREATE INDEX IF NOT EXISTS idx_ol_datasets_name ON ol_datasets(name);

CREATE INDEX IF NOT EXISTS idx_ol_edges_parent ON ol_edges(namespace, parent_dataset_name);
CREATE INDEX IF NOT EXISTS idx_ol_edges_child ON ol_edges(namespace, child_dataset_name);
CREATE INDEX IF NOT EXISTS idx_ol_edges_run ON ol_edges(run_id);

-- OpenLineage Dead Letter Queue for invalid events
CREATE TABLE IF NOT EXISTS ol_dlq (
  dlq_id TEXT PRIMARY KEY,           -- unique ID for DLQ entry
  payload_json TEXT NOT NULL,        -- original event payload
  validation_errors TEXT,            -- JSON array of validation errors
  attempts INTEGER NOT NULL DEFAULT 0, -- retry attempts
  last_error TEXT,                   -- last error message
  next_try_at INTEGER,               -- unix timestamp for next retry
  created_at INTEGER NOT NULL,       -- when first added to DLQ
  updated_at INTEGER NOT NULL        -- last update timestamp
);

CREATE INDEX IF NOT EXISTS idx_ol_dlq_next_try ON ol_dlq(next_try_at);
CREATE INDEX IF NOT EXISTS idx_ol_dlq_created ON ol_dlq(created_at);