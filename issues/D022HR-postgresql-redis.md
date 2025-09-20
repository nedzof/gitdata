D22HR — Hybrid Storage: PostgreSQL (source of truth) + Redis (cache, realtime)

Labels: storage, postgres, redis, caching, ops, performance  
Assignee: TBA  
Estimate: 4–6 PT

Zweck
- Etabliere ein hybrides, produktionsreifes Speicherkonzept: PostgreSQL als dauerhafte, relationale Quelle der Wahrheit; Redis als schneller Cache/Realtime‑Layer.
- PostgreSQL speichert die Kernobjekte des Governance‑Portals (Assets, Policies, Accounts, Receipts, Runs/Audit); Redis beschleunigt Lese‑Hotpaths (Catalog, Lineage‑Graph, Sessions, Queues) und Realtime‑Signale.
- SPV‑first bleibt maßgeblich für Trust (Bundle/Ready). D22 (S3/CDN) bedient BLOBs; D41 (OpenLineage‑only) nutzt Redis als Graph‑Cache; PostgreSQL ergänzt Audit/Abfragen (optional).

Nicht‑Ziele
- Keine vollständige Migration auf Redis (kein Verlust relationaler Query‑Power/ACID).
- Kein Ersatz für D22 Storage/CDN oder D41 Lineage‑Design (dies ergänzt, ersetzt nicht).

Architektur‑Überblick
- PostgreSQL = Warehouse (Quelle der Wahrheit, ACID, komplexe Abfragen)
- Redis = Workbench (Cache‑Aside, kurzlebige Graph‑Caches, Sessions, Jobs, Pub/Sub)
- S3/CDN = BLOB‑Delivery (presigned URLs; D22)
- SPV Proofs via /bundle, /ready; OpenLineage Events → Redis (Graph), optional PG‑Audit

Datenverantwortung (wer speichert was?)
- PostgreSQL (truth)
  - users, producers, agents (registry)
  - assets (datasets/models) metadata (catalog)
  - policies (JSONB), policy_runs (audit)
  - receipts/payments (UTXO templates, txid, receipts)
  - advisories/logs (audit), optional lineage_event_audit (roh/verdichtet)
- Redis (cache/realtime)
  - cache:asset:<id> (catalog item; TTL)
  - cache:listings:<q|page> (search page; TTL)
  - ol:ns:* (D41) – graph adjacency, datasets, runs, events index, lineage cache
  - sessions:<sid> (user sessions; TTL)
  - jobs:* (queue state), pubsub channels (notifications)

1) PostgreSQL Schema (Kernobjekte, Vorschlag)

-- Producers/Users
CREATE TABLE producers (
  producer_id  TEXT PRIMARY KEY,
  identity_key TEXT NOT NULL,            -- pubkey (hex)
  display_name TEXT,
  website      TEXT,
  payout_script_hex TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_producers_identity ON producers(identity_key);

CREATE TABLE users (
  user_id      TEXT PRIMARY KEY,
  identity_key TEXT NOT NULL,
  display_name TEXT,
  role         TEXT CHECK (role IN ('admin','producer','consumer')) DEFAULT 'consumer',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_users_identity ON users(identity_key);

-- Agents (registry)
CREATE TABLE agents (
  agent_id     TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  webhook_url  TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]',
  identity_key TEXT,
  status       TEXT CHECK (status IN ('unknown','up','down')) DEFAULT 'unknown',
  last_ping_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalog (Datasets/Models)
CREATE TABLE assets (
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
CREATE INDEX idx_assets_dataset ON assets(dataset_id);
CREATE INDEX idx_assets_producer ON assets(producer_id);
CREATE INDEX idx_assets_updated ON assets(updated_at DESC);

-- Policies (JSONB), Versionierung optional
CREATE TABLE policies (
  policy_id    TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  doc          JSONB NOT NULL,   -- D28 policy JSON
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Policy Runs (Audit)
CREATE TABLE policy_runs (
  run_id       TEXT PRIMARY KEY,
  policy_id    TEXT REFERENCES policies(policy_id),
  version_id   TEXT REFERENCES assets(version_id),
  decision     TEXT CHECK (decision IN ('allow','warn','block')),
  reasons      JSONB NOT NULL DEFAULT '[]',
  evidence     JSONB,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_policy_runs_policy ON policy_runs(policy_id);
CREATE INDEX idx_policy_runs_version ON policy_runs(version_id);

-- Payments (quote/receipt)
CREATE TABLE receipts (
  receipt_id     TEXT PRIMARY KEY,
  version_id     TEXT REFERENCES assets(version_id),
  status         TEXT CHECK (status IN ('pending','paid','confirmed')) NOT NULL DEFAULT 'pending',
  payment_txid   TEXT,       -- hex (64)
  unit_price_sat BIGINT,
  quantity       BIGINT,
  fee_sat        BIGINT,
  outputs_json   JSONB,      -- required UTXO outputs
  quote_template_hash TEXT,  -- hex (64)
  quote_expires_at TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_receipts_version ON receipts(version_id);
CREATE INDEX idx_receipts_status ON receipts(status);

-- Optional lineage event audit (raw OL events for forensic)
CREATE TABLE lineage_event_audit (
  event_hash    TEXT PRIMARY KEY,
  event_time    TIMESTAMPTZ NOT NULL,
  namespace     TEXT NOT NULL,
  job_name      TEXT NOT NULL,
  run_id        TEXT NOT NULL,
  payload_json  JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lineage_event_time ON lineage_event_audit(event_time DESC);

Hinweise
- JSONB für policies/policy_runs.evidence und assets.policy_meta ermöglicht flexible Filter (GIN Index bei Bedarf).
- FK‑Constraints sichern Beziehungen (producers→assets→receipts etc.).
- Optional: Partitionierung (policy_runs, lineage_event_audit) nach Zeit für langfristige Performance.

2) Redis Keyspace (D41 konform) – Kurzfassung
- Lineage (OpenLineage‑only)
  - ol:ns:<ns>:event:<hash> (String JSON) + ZSET by_time
  - ol:ns:<ns>:job:<name> (Hash), ol:ns:<ns>:jobs:by_updated
  - ol:ns:<ns>:run:<runId> (Hash), ol:ns:<ns>:runs:by_updated
  - ol:ns:<ns>:ds:<name> (Hash facets), ol:ns:<ns>:ds:all
  - ol:ns:<ns>:up:<child> / down:<parent> (SET adjacency)
  - ol:cache:lineage:<node>|<depth>|<dir>|<fmt> (TTL graph JSON)
- Catalog Cache
  - cache:asset:<versionId> (TTL JSON)
  - cache:listings:<q>|<page> (TTL JSON)
- Sessions / Jobs / PubSub
  - sess:<sid> (TTL)
  - jobs:* (queue) oder Streams
  - pubsub channels (notifications)

3) Zugriffspatterns (Hybrid)
- Cache‑Aside (Standard)
  - GET asset → Redis cache:asset:<id>?
    - hit → return
    - miss → SELECT FROM assets → SETEX cache (z. B. 300s) → return
- Write‑through / Invalidation
  - UPDATE assets → SQL commit → DEL cache:asset:<id> + DEL/INVALIDATE betroffene cache:listings*
  - Policy update → DEL policy‑bezogene Caches (oder Versionierungsstrategie: include ETag/version in Key)
- Lineage
  - OL ingest → Redis (D41), optional PG audit write (lineage_event_audit)
  - GET /openlineage/lineage → Redis BFS + TTL‑Cache (p95 < 200 ms)
  - Verify‑Tab: /bundle + /ready (SPV/Policy) – unabhängig von Redis
- /v1/data (D22)
  - HEAD/GET/PRESIGN aus S3/CDN; Assets in PG verlinken (content_hash, mime_type, size_bytes)
  - Hash‑Check im Client/SDK protokollieren; optional “first verified” in PG speichern

4) Caching‑Strategie (Richtwerte)
- TTL: 120–600 s für catalog/listings; 60–180 s für lineage; 24 h für rarely‑changing (e.g. producers)
- Key Design: stabil + Parameter in Key (q|page|filters); max key size beachten
- ETag/Bust: Falls UI ETags verwendet, Variation im Key (…|etag:v2)
- Warmup: Bei Frequent Routes (Homepage) Preload/Warm danach TTL

5) Konsistenz & Invalidierung
- Starke Konsistenz: Nach kritischen Writes (publish, price set, policy change) → gezielte DEL der betroffenen Keys
- Event‑Driven: PG NOTIFY channel “invalidate_cache” → Background Worker in Overlay hört LISTEN und entfernt Keys (reduziert Coupling)
- Batch Invalidation: auf Producer‑Aktionen (z. B. massenhaft publish) – Prefex‑Scan (vorsichtig) oder Key‑Registry (PG Tabelle cache_keys per asset)

6) Security
- PG: TLS, least privilege Rollen, separate RW/RO‑User
- Redis: AUTH (ACL), TLS, IP‑Allowlist, keine Öffnung ins Internet; Untrusted Input nie direkt in Redis eval’uieren
- Secrets: Inject via Orchestrator (Kubernetes/KMS/Secrets Manager)
- Keine PII im Redis‑Cache; nur IDs/öffentliche Metadaten

7) Monitoring & Health
- PG: pg_stat_statements, slow query log, connection pool (pgBouncer)
- Redis: INFO latency/memory, keyspace hits/misses, eviction policy (maxmemory), AOF everysec
- Metriken:
  - cache_hit_ratio (assets/listings/lineage)
  - lineage_query_latency_ms_p95
  - presign_latency_ms_p95 (D22), storageLatencyMs
  - DLQ backlog (D41), ingest retries
- Healthchecks:
  - /openlineage/health (Redis reachable)
  - /health/db (PG reachable: simple SELECT 1)
  - S3 headObject probe (D22)

8) ENV (Vorschlag)
- PG
  - PG_URL=postgres://user:pass@pg-host:5432/db
  - PG_POOL_MIN=2, PG_POOL_MAX=20
- Redis
  - REDIS_URL=redis://redis:6379/0
  - OL_QUERY_MAX_DEPTH=10
  - OL_QUERY_CACHE_TTL_SEC=120
- Storage/CDN (D22)
  - STORAGE_BACKEND=fs|s3
  - S3_ENDPOINT=..., S3_BUCKET_HOT=..., PRESIGN_TTL_SEC=900
  - CDN_MODE=off|direct|signed, CDN_BASE_URL=...
- Feature Flags
  - FEATURE_FLAGS_JSON={"payments":true,"ingest":true,"bundle":true,"ready":true,"models":true}

9) DoD (Definition of Done)
- PostgreSQL in Betrieb, Kernschemas erstellt; Migrations (SQL) dokumentiert
- Redis in Betrieb (AOF), Namespace‑Keyspace konfiguriert, ACL gesetzt
- Catalog/API Flows:
  - GET asset: Cache‑Aside funktionsfähig; p95 < 50 ms (hit), < 200 ms (miss)
  - GET listings: Page‑Cache funktionsfähig; Invalidation bei Updates
- Lineage (D41):
  - Ingest idempotent, DLQ/Retry; BFS + TTL‑Cache liefern p95 < 200 ms
  - Optional: OL Audit in PG (lineage_event_audit) aktiv
- Policies:
  - CREATE/UPDATE policy → persist in PG; Ready‑Tab liest PG; Caches invalidiert
- D22 (BLOB):
  - /v1/data presigned JSON/302 Standard; Hash‑Check via SDK; Doku ergänzt
- Monitoring:
  - Healthchecks grün; Cache‑Hit Ratio > 60% auf Hotpaths

10) Abnahmekriterien (Tests)
- Cache Hit/Miss:
  - asset GET miss → PG → Redis SETEX → nächste GET hit
  - listings GET miss → PG/Index → SETEX → hit
- Invalidation:
  - Update asset → DEL cache:asset:<id> & relevante listings → nächste GET miss→rebuild
- Lineage:
  - OL ingest (2 parents) → /openlineage/lineage edges = /bundle.parents
  - Idempotenz (doppelte Events) → keine Dup‑Edges; status idempotent
- Performance:
  - lineage p95 < 200 ms (depth ≤ 5), cache hit > 70% bei wiederholten Views
- Security:
  - Redis/PG protected; secrets nicht im Image; TLS/ACL
- SPV‑first:
  - Verify‑Tab nutzt /bundle + /ready unabhängig vom Cache; lineage viz ist optionaler Cache

11) Migration (SQLite → Hybrid)
- Schritt 1: PG Tabellen anlegen; Daten aus SQLite in PG migrieren (COPY/INSERT Scripts)
- Schritt 2: Redis für lineage befüllen (Backfill D41 aus /listings + /bundle)
- Schritt 3: Overlay Routen umstellen:
  - Catalog/Policies/Receipts → PG (Cache‑Aside in Redis)
  - OpenLineage ingest/query → Redis (optional PG audit)
- Schritt 4: Sanity Checks:
  - Stichproben Assets/Policies/Receipts in PG
  - Stichproben Eltern‑Kanten in Redis vs /bundle
- Schritt 5: SQLite auf read‑only, später dekommissionieren

12) Betriebsprofile
- Dev: Single PG/Redis via docker‑compose; minimal TTLs
- Staging: PG + Redis (TLS, AUTH), S3 Sandbox, CDN disabled oder direct
- Prod: PG (HA, Backups), Redis (AOF, Replica), S3/CDN aktiv, Metriken/Alerts

Warum Hybrid?
- Postgres = belastbarer, relationaler Kern (Audit, Abfragen, Integrität).
- Redis = Geschwindigkeit & Realtime (Cache, Graph, Sessions, Pub/Sub).
- Zusammen = beste Praktiken moderner Webarchitektur (Warehouse vs Workbench), ohne Protokoll‑/Standards‑Bruch.