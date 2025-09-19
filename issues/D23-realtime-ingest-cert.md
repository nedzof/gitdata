D23 — Real-Time Event Ingestion & Certification

Labels: ingest, streaming, publishers, e2e
Assignee: TBA
Estimate: 4 PT

Zweck
- Echtzeit‑Datenströme (Systemevents, Sensor/IoT, Log/Telemetry, API‑Feeds) ingestieren, validieren und als verifizierbare DLM1‑Versionen zertifizieren. Publisher‑Portal + APIs, Live‑Feeds (/watch), Multi‑Source‑Konsolidierung und Auditierbarkeit.

Abhängigkeiten
- D01 (DLM1 Submit), D02 (SPV), D03/D04 (Bundle/Ready), D05–D07 (Price/Pay/Data), D08 (Producers), D11 (Caching), D12 (Limits), D19 (Identity)

Aufgaben
- Ingest‑Layer (Streams & Webhooks)
  - [ ] POST /ingest/events (webhook, identity‑signed optional) — batched JSON/NDJSON
  - [ ] /watch (SSE/WebSocket) — Live‑Events für Clients/Agents (mit Filter/Split)
  - [ ] Adapter: CSV/JSON/NDJSON, generic REST pull (poller), MQTT/AMQP/Kafka bridge (optional worker)
  - [ ] Dedup & Ordering: eventId/sourceId/timestamp, idempotente Upserts
- Normalisierung & Validierung
  - [ ] Mapping Policy (JSON): field mapping, required fields, coercion
  - [ ] Plausibilitäts‑Regeln & Constraints (e.g., monotonicity, bounds, schema)
  - [ ] Multi‑Source Konsens (Quorum/Priority); Konfliktprotokoll (audit trail)
- Zertifizierung (Publishing)
  - [ ] On‑the‑fly oder Batch‑Publish: DLM1‑Manifeste je Aggregat (z. B. “event packet”, “window”, “rollup”)
  - [ ] contentHash (payload hash), lineage.parents (Vorversion/Inputs), provenance.producer.identityKey (Publisher)
  - [ ] POST /submit/dlm1 (identity‑signed) → OP_RETURN; danach POST /submit (rawTx)
  - [ ] Preisregeln optional (D09), Version/Producer‑Mapping (D08)
- Live‑Feeds & Caching
  - [ ] /feed?sourceId&filter=… (JSON, low‑TTL) + /watch Stream (SSE/WS) mit Backpressure (D12)
  - [ ] Indexierte Suche (/search) & /resolve Integration für frische Versionen
- Publisher‑Portal APIs (generisch)
  - [ ] /publishers/feeds: registrieren/aktualisieren (identity), Secrets/Allowlist (Webhook)
  - [ ] /publishers/streams: listen, publish/unpublish, throttle/quota
  - [ ] /ingest/keys: Rotations‑Endpunkte (secrets, IP allowlist)
- Multi‑Source Fusion & Provenienz
  - [ ] sources Tabelle (Trust‑Gewichte, Reputation), event_source_relations
  - [ ] Fusion‑Policy pro Stream (quorum, priority, tie‑breakers)
- Audit & Observability
  - [ ] Event‑Trace: raw→normalized→certified mit IDs/Hashes
  - [ ] /metrics: ingest/sec, backlog, normalization latency p95, publish latency p95
  - [ ] /health: webhook secret check, queue lag, storage reachability

Definition of Done (DoD)
- [ ] Echtzeit‑Events werden in Sekunden zu zertifizierten DLM1‑Versionen (SPV‑verifiziert); /bundle & /ready grün.
- [ ] Live‑Feed aktualisiert < 2 s E2E; Konflikte werden deterministisch gelöst und protokolliert.
- [ ] Publisher können Feeds registrieren, Secrets rotieren und Streams (de)aktivieren.

Abnahmekriterien (Tests)
- [ ] Simulierter Strom (≥ 10k Events) → Zertifizierungs‑Latenz P95 < 5 s; Gesamtverlustfrei (Dedup+Idempotenz)
- [ ] Konfliktszenario (zwei abweichende Quellen) → ein kanonisches Resultat; Audit‑Trail enthält Begründung/Policy
- [ ] /watch sendet Updates bei Ingest; Backpressure/Rate‑Limits gemäß D12 greifen

Artefakte
- [ ] Event‑Schemas (Beispiele), Mapping‑Policies, Normalisierungs‑Rules
- [ ] Beispiel‑Manifeste, Bundles, Ready‑Belege (JSON); End‑to‑End Log eines zertifizierten Events

Risiken/Rollback
- Out‑of‑order/Clock‑Skew → Buffer & Watermarks; Fallback Batch‑Publish
- Bösartige Quellen → Identity (BRC‑31), IP‑Allowlists, Rate‑Limits (D12), Quarantäne/Advisory (D10)
- Speicher/Queue Backlog → Sichtbarkeit in /metrics + Degradation (Drop to batch)

ENV (Vorschlag)
- INGEST_SOURCES_JSON='[{"id":"feed1","secret":"...","type":"webhook"}]'
- INGEST_ALLOWLIST_CIDRS='["1.2.3.0/24"]'
- WATCH_MAX_CLIENTS=500
- EVENT_BUFFER_MS=750
- NORMALIZE_POLICY_JSON='{"required":["id","ts"],"coerce":{"ts":"iso8601->epoch"}}'
- FUSION_POLICY_JSON='{"strategy":"quorum","min":2,"priority":["sourceA","sourceB"]}'
- PUBLISH_MODE=live|batch
- FEED_CACHE_TTL_MS=1000

Hinweise zur Implementierung (Scoping)
- Start mit Webhook + SSE (Simpel, ohne Broker); Kafka/MQTT optional als Worker
- Normalisierung als isolierter Service/Worker (Job‑Queue), Publish asynchron
- Deterministisches contentHash & lineage (Versionierung) → reproduzierbare Zertifikate
- Reuse bestehende D01/D03/D04 Pfade; keine Indexer‑Abhängigkeit (SPV‑first)

Wenn du möchtest, erstelle ich dir dazu sofort Cursor‑Tasks (Scaffolding) für:
- /ingest/events (Webhook) + /watch (SSE),
- Normalizer‑Worker (in‑process Queue),
- Publisher‑Bridge (build DLM1 → submit builder/receiver),
- Feed Cache & basic /metrics wiring.


Here’s a single, D23-style scaffold you can drop in to add Real‑Time Event Ingestion & Certification. It follows the same coding patterns as your existing overlay (Express + better‑sqlite3, JSON columns, evidence logs, BRC‑31 webhook calls) and stays vendor‑neutral. It introduces:

- DB migrations for ingest_sources, ingest_events, and a dedicated ingest_jobs queue (to avoid colliding with your existing jobs table)
- POST /ingest/events (JSON batch)
- GET /ingest/feed (latest events, filterable)
- GET /watch (SSE stream) for real‑time updates
- Normalization via per‑source mapping_json policy
- Certification worker that optionally calls an external Publisher Agent via BRC‑31 (callAgentWebhook); otherwise it computes a deterministic contentHash and a synthetic versionId
- Evidence aggregation and robust retries with exponential backoff

Create file: src/ingest/scaffold.ts
```ts
/*
  D23 — Real-Time Event Ingestion & Certification (D24-compatible scaffold)

  What this adds:
  - DB migrations:
      ingest_sources (per-source mapping/validation policy)
      ingest_events (raw + normalized + certified records)
      ingest_jobs (dedicated queue to avoid interfering with your /jobs worker)
  - Routes:
      POST /ingest/events       (batched JSON events)
      GET  /ingest/feed         (latest normalized/certified events; filters)
      GET  /ingest/events/:id   (inspect one event)
      GET  /watch               (SSE stream for live updates)
  - Worker:
      startIngestWorker(db)     (normalizes, certifies, aggregates evidence)
      Certification path:
        - If CERTIFIER_WEBHOOK_URL is set: BRC-31-signed call to external agent { type:'certify', payload:{...} }
        - Else: compute contentHash = sha256(normalized), versionId = vr_<hash-prefix> (synthetic)
  - Evidence:
      ingest_events.evidence_json captures normalization/certification artifacts and errors
      ingest_jobs has its own evidence_json and retries w/ backoff

  Dependencies:
    - better-sqlite3
    - express (router)
    - src/agents/webhook.ts (callAgentWebhook) — used for BRC-31-signed outbound certification calls

  ENV (suggested):
    INGEST_SSE_HEARTBEAT_MS=15000
    INGEST_RETRY_MAX=5
    INGEST_BACKOFF_BASE_MS=500
    INGEST_BACKOFF_FACTOR=2
    CERTIFIER_WEBHOOK_URL=http://localhost:9099/webhook   # optional; if set, worker calls external agent to publish
    CERTIFIER_TIMEOUT_MS=8000

  Wiring (server.ts):
    import { ingestRouter, runIngestMigrations, startIngestWorker } from './src/ingest/scaffold';
    // after DB init:
    runIngestMigrations(db);
    app.use(ingestRouter(db));
    startIngestWorker(db);
*/

import type { Router, Request, Response } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { callAgentWebhook } from '../agents/webhook';

// ---------------- Config / ENV ----------------

const INGEST_SSE_HEARTBEAT_MS = Number(process.env.INGEST_SSE_HEARTBEAT_MS || 15000);
const INGEST_RETRY_MAX = Number(process.env.INGEST_RETRY_MAX || 5);
const INGEST_BACKOFF_BASE_MS = Number(process.env.INGEST_BACKOFF_BASE_MS || 500);
const INGEST_BACKOFF_FACTOR = Number(process.env.INGEST_BACKOFF_FACTOR || 2);
const CERTIFIER_WEBHOOK_URL = process.env.CERTIFIER_WEBHOOK_URL || ''; // optional
const CERTIFIER_TIMEOUT_MS = Number(process.env.CERTIFIER_TIMEOUT_MS || 8000);

// ---------------- Utils ----------------

function nowSec() { return Math.floor(Date.now() / 1000); }
function sha256hex(s: string) { return createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex'); }
function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

function safeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function toCanonical(obj: any) {
  // Deterministic JSON string for hashing
  return JSON.stringify(obj ?? {});
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ---------------- Migrations ----------------

export function runIngestMigrations(db: Database.Database) {
  // Ingest sources
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ingest_sources (
      source_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mapping_json TEXT,         -- mapping & validation policy
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  // Ingest events
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ingest_events (
      event_id TEXT PRIMARY KEY,
      source_id TEXT,
      raw_json TEXT NOT NULL,
      normalized_json TEXT,
      status TEXT NOT NULL,     -- 'received'|'normalized'|'certified'|'failed'
      last_error TEXT,
      content_hash TEXT,
      version_id TEXT,
      evidence_json TEXT,       -- artifacts & logs for this event
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_ingest_events_source ON ingest_events(source_id)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_ingest_events_status ON ingest_events(status)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_ingest_events_created ON ingest_events(created_at)`).run();

  // Dedicated ingest jobs (to avoid coupling with your existing /jobs)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ingest_jobs (
      job_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      state TEXT NOT NULL,      -- 'queued'|'running'|'done'|'failed'|'dead'
      attempts INTEGER NOT NULL DEFAULT 0,
      next_run_at INTEGER NOT NULL,
      last_error TEXT,
      evidence_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_ingest_jobs_state_next ON ingest_jobs(state, next_run_at)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_ingest_jobs_event ON ingest_jobs(event_id)`).run();
}

// ---------------- DB helpers ----------------

type IngestSource = {
  source_id: string;
  name: string;
  mapping_json?: string | null;
  enabled: 0|1;
  created_at: number;
  updated_at: number;
};

type IngestEvent = {
  event_id: string;
  source_id?: string | null;
  raw_json: string;
  normalized_json?: string | null;
  status: 'received' | 'normalized' | 'certified' | 'failed';
  last_error?: string | null;
  content_hash?: string | null;
  version_id?: string | null;
  evidence_json?: string | null;
  created_at: number;
  updated_at: number;
};

type IngestJob = {
  job_id: string;
  event_id: string;
  state: 'queued'|'running'|'done'|'failed'|'dead';
  attempts: number;
  next_run_at: number;
  last_error?: string | null;
  evidence_json?: string | null;
  created_at: number;
  updated_at: number;
};

function getSource(db: Database.Database, sourceId: string): IngestSource | undefined {
  try { return db.prepare(`SELECT * FROM ingest_sources WHERE source_id = ?`).get(sourceId) as any; } catch { return undefined; }
}

function upsertSource(db: Database.Database, s: Partial<IngestSource>): string {
  const id = s.source_id || safeId('src');
  const now = nowSec();
  db.prepare(`
    INSERT INTO ingest_sources(source_id, name, mapping_json, enabled, created_at, updated_at)
    VALUES(@source_id, @name, @mapping_json, COALESCE(@enabled,1), @created_at, @updated_at)
    ON CONFLICT(source_id) DO UPDATE SET
      name=excluded.name,
      mapping_json=excluded.mapping_json,
      enabled=COALESCE(excluded.enabled, ingest_sources.enabled),
      updated_at=excluded.updated_at
  `).run({
    source_id: id,
    name: s.name || id,
    mapping_json: s.mapping_json || null,
    enabled: typeof s.enabled === 'number' ? s.enabled : 1,
    created_at: s.created_at || now,
    updated_at: now
  });
  return id;
}

function insertEvent(db: Database.Database, sourceId: string | null, raw: any): string {
  const id = safeId('ev');
  const now = nowSec();
  db.prepare(`
    INSERT INTO ingest_events(event_id, source_id, raw_json, normalized_json, status, last_error, content_hash, version_id, evidence_json, created_at, updated_at)
    VALUES(@event_id, @source_id, @raw_json, NULL, 'received', NULL, NULL, NULL, '[]', @created_at, @updated_at)
  `).run({
    event_id: id,
    source_id: sourceId || null,
    raw_json: JSON.stringify(raw ?? {}),
    created_at: now,
    updated_at: now
  });
  return id;
}

function getEvent(db: Database.Database, eventId: string): IngestEvent | undefined {
  try { return db.prepare(`SELECT * FROM ingest_events WHERE event_id=?`).get(eventId) as any; } catch { return undefined; }
}

function setEvent(db: Database.Database, eventId: string, patch: Partial<IngestEvent>) {
  const now = nowSec();
  db.prepare(`
    UPDATE ingest_events SET
      source_id=COALESCE(@source_id, source_id),
      raw_json=COALESCE(@raw_json, raw_json),
      normalized_json=COALESCE(@normalized_json, normalized_json),
      status=COALESCE(@status, status),
      last_error=COALESCE(@last_error, last_error),
      content_hash=COALESCE(@content_hash, content_hash),
      version_id=COALESCE(@version_id, version_id),
      evidence_json=COALESCE(@evidence_json, evidence_json),
      updated_at=@updated_at
    WHERE event_id=@event_id
  `).run({
    event_id: eventId,
    source_id: patch.source_id ?? null,
    raw_json: patch.raw_json ?? null,
    normalized_json: patch.normalized_json ?? null,
    status: patch.status ?? null,
    last_error: patch.last_error ?? null,
    content_hash: patch.content_hash ?? null,
    version_id: patch.version_id ?? null,
    evidence_json: patch.evidence_json ?? null,
    updated_at: now
  });
}

function listEvents(db: Database.Database, opts: { sourceId?: string; status?: string; limit?: number; offset?: number }) {
  const where: string[] = [];
  const params: any[] = [];
  if (opts.sourceId) { where.push('source_id = ?'); params.push(opts.sourceId); }
  if (opts.status) { where.push('status = ?'); params.push(opts.status); }
  const sql = `
    SELECT * FROM ingest_events
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`;
  params.push(opts.limit ?? 50, opts.offset ?? 0);
  return db.prepare(sql).all(...params) as any[];
}

// ingest_jobs helpers
function enqueueIngestJob(db: Database.Database, eventId: string, delaySec = 0): string {
  const id = safeId('ij');
  const now = nowSec();
  db.prepare(`
    INSERT INTO ingest_jobs(job_id, event_id, state, attempts, next_run_at, last_error, evidence_json, created_at, updated_at)
    VALUES(@job_id, @event_id, 'queued', 0, @next_run_at, NULL, '[]', @created_at, @updated_at)
  `).run({
    job_id: id,
    event_id: eventId,
    next_run_at: now + delaySec,
    created_at: now,
    updated_at: now
  });
  return id;
}

function claimNextIngestJob(db: Database.Database, ts = nowSec()): IngestJob | undefined {
  const tx = db.transaction(() => {
    const row = db.prepare(`SELECT * FROM ingest_jobs WHERE state='queued' AND next_run_at <= ? ORDER BY next_run_at ASC LIMIT 1`).get(ts) as any;
    if (!row) return undefined;
    db.prepare(`UPDATE ingest_jobs SET state='running', updated_at=? WHERE job_id=?`).run(ts, row.job_id);
    return row as IngestJob;
  });
  return tx() as any;
}

function setIngestJobResult(db: Database.Database, jobId: string, state: IngestJob['state'], evidence?: any, err?: string) {
  const now = nowSec();
  db.prepare(`UPDATE ingest_jobs SET state=?, updated_at=?, evidence_json=COALESCE(?, evidence_json), last_error=? WHERE job_id=?`)
    .run(state, now, evidence ? JSON.stringify(evidence) : null, err || null, jobId);
}

function bumpIngestRetry(db: Database.Database, jobId: string, attempts: number, err: string) {
  const now = nowSec();
  const delayMs = Math.min(30000, Math.floor(INGEST_BACKOFF_BASE_MS * Math.pow(INGEST_BACKOFF_FACTOR, attempts)));
  const delaySec = Math.floor(delayMs / 1000);
  db.prepare(`UPDATE ingest_jobs SET attempts=attempts+1, state='queued', next_run_at=?, updated_at=?, last_error=? WHERE job_id=?`)
    .run(now + delaySec, now, err, jobId);
}

// ---------------- Normalization ----------------

type MappingPolicy = {
  map?: Record<string, string>;   // normalizedField -> rawPath (dot.notation)
  required?: string[];            // fields required after mapping
  coercion?: Record<string, 'string'|'number'|'boolean'|'iso8601'>;
  constraints?: {
    monotonicFields?: string[];
    bounds?: Record<string, { min?: number; max?: number }>;
  };
};

function getPath(obj: any, path: string) {
  const parts = (path || '').split('.');
  let v = obj;
  for (const p of parts) v = v?.[p];
  return v;
}

function coerce(val: any, t: string) {
  if (t === 'string') return String(val);
  if (t === 'number') return Number(val);
  if (t === 'boolean') return Boolean(val);
  if (t === 'iso8601') return new Date(val).toISOString();
  return val;
}

function normalizeWithPolicy(raw: any, pol?: MappingPolicy): { normalized: any; issues: string[] } {
  const issues: string[] = [];
  if (!pol || typeof pol !== 'object') return { normalized: raw, issues };

  const out: any = {};
  const map = pol.map || {};
  for (const [normKey, rawPath] of Object.entries(map)) {
    out[normKey] = getPath(raw, rawPath);
  }

  // required check
  for (const req of pol.required || []) {
    if (typeof out[req] === 'undefined' || out[req] === null) issues.push(`required-missing:${req}`);
  }

  // coercion
  for (const [k, t] of Object.entries(pol.coercion || {})) {
    if (typeof out[k] !== 'undefined') {
      const before = out[k];
      out[k] = coerce(out[k], t);
      if (Number.isNaN(out[k])) issues.push(`coercion-NaN:${k}:${String(before)}`);
    }
  }

  // simple bounds
  for (const [k, lim] of Object.entries(pol.constraints?.bounds || {})) {
    const v = Number(out[k]);
    if (typeof lim.min === 'number' && v < lim.min) issues.push(`bounds-min:${k}:${v}<${lim.min}`);
    if (typeof lim.max === 'number' && v > lim.max) issues.push(`bounds-max:${k}:${v}>${lim.max}`);
  }

  // NOTE: monotonicity checks would need per-source state tracking; left as future work
  return { normalized: Object.keys(map).length ? out : raw, issues };
}

// ---------------- SSE Broadcaster ----------------

const sseBus = new EventEmitter();

function sseWrite(res: Response, msg: any) {
  res.write(`data: ${JSON.stringify(msg)}\n\n`);
}

// ---------------- Router ----------------

export function ingestRouter(db: Database.Database): Router {
  const router = makeRouter();

  // POST /ingest/events
  // Body: { sourceId?: string, events: any[] }  (batched JSON)
  router.post('/ingest/events', (req: Request, res: Response) => {
    try {
      const sourceId = req.body?.sourceId ? String(req.body.sourceId) : null;
      const events = Array.isArray(req.body?.events) ? req.body.events : null;
      if (!events) return json(res, 400, { error: 'bad-request', hint: 'events[] required' });

      // Source policy
      let policy: MappingPolicy | undefined = undefined;
      if (sourceId) {
        const src = getSource(db, sourceId);
        if (!src || !src.enabled) return json(res, 404, { error: 'source-not-found-or-disabled' });
        try { policy = src.mapping_json ? JSON.parse(src.mapping_json) : undefined; } catch {}
      }

      const inserted: string[] = [];
      for (const e of events) {
        const eventId = insertEvent(db, sourceId, e);
        inserted.push(eventId);
        enqueueIngestJob(db, eventId, 0);
      }

      // Notify SSE about new received events
      sseBus.emit('ingest', { type: 'received', sourceId, count: inserted.length, eventIds: inserted });

      return json(res, 200, { status: 'ok', inserted, count: inserted.length });
    } catch (e: any) {
      return json(res, 500, { error: 'ingest-failed', message: String(e?.message || e) });
    }
  });

  // GET /ingest/feed?sourceId=&status=&limit=50&offset=0
  router.get('/ingest/feed', (req: Request, res: Response) => {
    const sourceId = req.query.sourceId ? String(req.query.sourceId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const items = listEvents(db, { sourceId, status, limit, offset }).map((r: IngestEvent) => ({
      eventId: r.event_id,
      sourceId: r.source_id || null,
      status: r.status,
      contentHash: r.content_hash || null,
      versionId: r.version_id || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
    return json(res, 200, { items });
  });

  // GET /ingest/events/:id (inspect one event)
  router.get('/ingest/events/:id', (req: Request, res: Response) => {
    const ev = getEvent(db, String(req.params.id));
    if (!ev) return json(res, 404, { error: 'not-found' });
    return json(res, 200, {
      eventId: ev.event_id,
      sourceId: ev.source_id || null,
      status: ev.status,
      raw: safeParse(ev.raw_json || '{}', {}),
      normalized: safeParse(ev.normalized_json || '{}', null),
      contentHash: ev.content_hash || null,
      versionId: ev.version_id || null,
      evidence: safeParse(ev.evidence_json || '[]', []),
      lastError: ev.last_error || null,
      createdAt: ev.created_at,
      updatedAt: ev.updated_at
    });
  });

  // GET /watch (SSE)
  // Server-Sent Events stream for real-time updates
  router.get('/watch', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const heartbeat = setInterval(() => sseWrite(res, { type: 'heartbeat', ts: Date.now() }), INGEST_SSE_HEARTBEAT_MS);
    const onMsg = (msg: any) => sseWrite(res, msg);
    sseBus.on('ingest', onMsg);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseBus.off('ingest', onMsg);
    });

    sseWrite(res, { type: 'hello', ts: Date.now() });
  });

  return router;
}

// ---------------- Worker ----------------

export function startIngestWorker(db: Database.Database) {
  async function processOne() {
    const job = claimNextIngestJob(db);
    if (!job) return;

    try {
      const ev = getEvent(db, job.event_id);
      if (!ev) throw new Error('event-not-found');

      const raw = safeParse(ev.raw_json || '{}', {});
      const src = ev.source_id ? getSource(db, ev.source_id) : undefined;
      let policy: MappingPolicy | undefined = undefined;
      try { policy = src?.mapping_json ? JSON.parse(src.mapping_json) : undefined; } catch {}

      // Normalize
      const normRes = normalizeWithPolicy(raw, policy);
      const normalized = normRes.normalized;
      const issues = normRes.issues;

      const evEvidence: any[] = safeParse(ev.evidence_json || '[]', []);
      evEvidence.push({ step: 'normalize', issues, normalizedPreview: Object.keys(normalized).slice(0, 5) });

      setEvent(db, ev.event_id, {
        normalized_json: JSON.stringify(normalized),
        status: 'normalized',
        evidence_json: JSON.stringify(evEvidence)
      });

      // Certification
      let cert: { versionId?: string; contentHash?: string; provider?: string | null; body?: any } = {};
      const canonical = toCanonical(normalized);
      const contentHash = sha256hex(canonical);

      if (CERTIFIER_WEBHOOK_URL) {
        const body = { type: 'certify', payload: { eventId: ev.event_id, sourceId: ev.source_id, normalized, contentHash } };
        const r = await callAgentWebhook(CERTIFIER_WEBHOOK_URL, body, fetch, CERTIFIER_TIMEOUT_MS);
        const vId = r?.body?.versionId || null;
        cert = { versionId: vId || null, contentHash, provider: CERTIFIER_WEBHOOK_URL, body: r.body };
        if (!vId && r.status >= 300) throw new Error(`certifier-failed:${r.status}`);
      } else {
        // Synthetic certification (no external call); deterministic versionId from hash
        cert = { versionId: `vr_${contentHash.slice(0, 24)}`, contentHash, provider: null, body: { ok: true, synthetic: true } };
      }

      evEvidence.push({ step: 'certify', provider: cert.provider, response: cert.body, contentHash: cert.contentHash, versionId: cert.versionId });

      setEvent(db, ev.event_id, {
        status: 'certified',
        content_hash: cert.contentHash || null,
        version_id: cert.versionId || null,
        evidence_json: JSON.stringify(evEvidence)
      });

      // Notify SSE
      sseBus.emit('ingest', { type: 'certified', eventId: ev.event_id, versionId: cert.versionId, sourceId: ev.source_id });

      // Finalize job
      setIngestJobResult(db, job.job_id, 'done', { normalized: true, certified: true }, undefined);
    } catch (e: any) {
      const err = String(e?.message || e);
      const attempts = job.attempts || 0;
      if (attempts + 1 >= INGEST_RETRY_MAX) {
        setIngestJobResult(db, job.job_id, 'dead', undefined, err);
        // Mark event failed (best-effort)
        try { setEvent(db, job.event_id, { status: 'failed', last_error: err }); } catch {}
      } else {
        bumpIngestRetry(db, job.job_id, attempts, err);
      }
    }
  }

  setInterval(() => { processOne().catch(()=>{}); }, 400);
}

// ---------------- Local helpers ----------------

function safeParse<T=any>(s: string, fallback: T): T {
  try { return JSON.parse(s); } catch { return fallback; }
}
```

How to wire it (server.ts)
- After your DB open/initSchema:
- Mount the router and start the worker.

Example:
import { ingestRouter, runIngestMigrations, startIngestWorker } from './src/ingest/scaffold';

// ... existing setup ...
const db = openDb();
initSchema(db);
runIngestMigrations(db);

app.use(ingestRouter(db));
startIngestWorker(db);

// ... existing mounts ...

Quick try
- Start overlay
- Optionally start a certifier agent (reuse examples/agent-example.ts and handle { type:'certify' } by returning { versionId })
- Ingest a batch:
  curl -sS -X POST http://localhost:8788/ingest/events -H 'content-type: application/json' -d '{
    "sourceId": "src_demo",
    "events": [
      { "ts": 1, "val": 42, "sensor": "a" },
      { "ts": 2, "val": 43, "sensor": "a" }
    ]
  }'
- Feed:
  curl -sS 'http://localhost:8788/ingest/feed?limit=5'
- Watch (SSE): open http://localhost:8788/watch in a browser/tab to see live messages

Notes
- This scaffold keeps submit/bundle/ready out of the server to remain D24‑generic. If you want real DLM1 publication, route certification to a Publisher Agent (CERTIFIER_WEBHOOK_URL) that calls your advanced endpoints (submit/dlm1 + submit) and returns a versionId. The webhook is BRC‑31‑signed using your existing callAgentWebhook implementation.
- Mapping/validation here is minimal. Extend mapping_json per source to enforce schema, bounds, and multi‑source fusion policies as needed.
- Limits, rate limiting, and identity signing are not added here to keep the scaffold concise. Use your existing middleware (e.g., requireIdentity) if you want authenticated ingest.