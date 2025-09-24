Alles klar: Kein Marquez – nur OpenLineage. Hier ist ein präzises, produktionsreifes Deliverable, das OpenLineage als Pflichtstandard festlegt und einen integrierten, leichten Lineage‑Store + Query‑API in eurem D24‑Overlay bereitstellt. Es ersetzt jede Marquez‑Abhängigkeit, bleibt SPV‑first (Wahrheit via /bundle, /ready) und ist vendor‑neutral. Es definiert Event‑Vertrag, Speicherlayout, Idempotenz/Reorg‑Resilienz, Query‑API für die UI und klare Sicherheits-/Performance‑Budgets.

D41 — OpenLineage‑only Lineage Store & Query (ohne Marquez)

Labels: openlineage, lineage, backend, interoperability, visualization  
Assignee: TBA  
Estimate: 4–6 PT

Zweck/Scope
- OpenLineage (OL) wird als verbindlicher Event‑Standard eingeführt.
- Ein interner, leichtgewichtiger Lineage‑Store (in eurem Overlay) persistiert OL‑Events und bietet eine OL‑kompatible Query‑API zur Visualisierung.
- SPV‑first: Kryptographische Verifikation bleibt separat (Verify‑Tab nutzt /bundle, /ready). OL dient der schnellen, interaktiven Visualisierung (Graph).

Nicht‑Ziele
- Kein Marquez, kein externer Lineage‑Dienst, keine zusätzliche DB (sofern SQLite/PG bereits Teil des Overlays ist).
- Kein proprietäres Lineage‑Format – nur OL‑konform.
- Keine PII‑Anreicherung in OL‑Facets (Whitelist).

Grundprinzipien (Pflicht)
- OL‑Emission ist verpflichtend für jeden Publish/Recall eines Assets (versionId).
- OL‑Namespaces/IDs deterministisch.
- OL‑Query‑Endpoint ist die einzige Quelle für Visualisierung; “Verify/Trust” nutzt weiterhin /bundle (SPV) + /ready (Policy).

1) Namenskonventionen (deterministisch)
- namespace: overlay:<env> (z. B. overlay:prod|staging|dev)
- dataset.name = <versionId> (exakt, unverändert)
- job.name = publish::<versionId> (alternativ publish::<txid>, dann konsistent)
- run.runId = <txid> (bevorzugt), sonst sha256(versionId|createdAt)
- producer (OL Pflichtfeld): https://<host>/adapter/openlineage/1.0

2) OL‑Event‑Lebenszyklus (Minimum)
- OPTIONAL: RUN_START (Startsignal)
- RUN_COMPLETE (verpflichtend) nach erfolgreichem Publish
- OPTIONAL: Recall/Withdraw → run.facets.lifecycleStateChange = { lifecycleState:"RETRACTED" }
- Reorg:
  - Konfigurierbarer minConfs‑Schwellenwert für Projektionsfreigabe (0 erlaubt sofortige Projection)
  - Detektierter Reorg → run.facets.reorgFacet = { unstable:true, reason:"reorg" }, spätere Stabilisierung entfernt/aktualisiert Flag

3) OL‑Event Schema (Pflicht + Facet‑Whitelist)
Pflichtfelder:
- eventType: COMPLETE (START optional)
- eventTime: ISO UTC
- producer: URL (s. o.)
- job: { namespace, name }
- run: { runId }
- inputs: Datasets der parents (namespace=overlay:<env>, name=<parentVersionId>)
- outputs: [ Dataset des neuen Assets (name=<versionId>) ]

Facet‑Whitelist (keine PII):
- dataset.facets.datasetVersion: { version:<versionId>, type:"dlm1", contentHash, createdAt }
- dataset.facets.dataSource: { name:"gitdata", uri:"https://<overlay>/listings/<versionId>" }
- run.facets.nominalTime: { nominalStartTime }
- run.facets.gitdataSpv: { confs, bundleUrl, bundleHash, readyDecision?, readyReasons? }
- dataset.facets.gitdataProvenance: { producerIdentityKey?, parentsCount?, lineageDepth? }
- run.facets.lifecycleStateChange (optional)
- run.facets.reorgFacet (optional)

4) Ingest (Emission) – verpflichtend
- Trigger: nach erfolgreichem Publish/Recall (oder periodisch für Backfill)
- Quelle: /bundle?versionId=… (parents/creation), optional /ready (Decision/Confs)
- Idempotenz: Upsert per (namespace, job.name, run.runId). Wiederholte COMPLETE‑Events dürfen keine Duplikate erzeugen.
- Fehler: Retries mit Exponential Backoff; DLQ (lokale Tabelle) für 5xx/Netzwerkfehler.

5) Persistenzmodell (interner Lineage‑Store)
Empfohlenes relationales Schema (SQLite/PG im Overlay):

- ol_events (rohes OL‑Event)
  - event_id (PK, z. B. ol_<rand+ts>), event_time, namespace, job_name, run_id, event_type, payload_json, hash (unique), created_at
  - Unique(hash) → idempotente Speicherung roher Events
- ol_jobs
  - job_id (PK), namespace, name, latest_facets_json, created_at, updated_at
  - Unique(namespace, name)
- ol_runs
  - run_id (PK), namespace, job_name, state (START|COMPLETE|ABORT), start_time, end_time, facets_json, created_at, updated_at
- ol_datasets
  - dataset_id (PK), namespace, name, latest_facets_json, created_at, updated_at
  - Unique(namespace, name)
- ol_edges
  - edge_id (PK), namespace, parent_dataset_name, child_dataset_name, run_id, created_at
  - Unique(namespace, parent_dataset_name, child_dataset_name, run_id)
  - Kante repräsentiert parent→child aus einem Run

Ingest‑Pipeline:
- validate → normalize keys → persist ol_events (idempotent via hash)
- upsert ol_jobs, ol_runs (state/zeiten/facets)
- upsert ol_datasets (latest facets pro Knoten)
- upsert ol_edges (unique per run) → Graphmaterialisierung

6) Query‑API (OL‑kompatibel)
Pflichtendpunkt für Visualisierung:
- GET /openlineage/lineage?node=dataset:<namespace>:<name>&depth=3&direction=both
  - depth: 1..MAX (konfiguriert, z. B. 10)
  - direction: up|down|both (default both)
  - format: simple|cyto (optional; default simple)
Response (simple):
{
  "node": "dataset:overlay:prod:<versionId>",
  "depth": 3,
  "direction": "both",
  "nodes": [
    { "namespace": "overlay:prod", "name": "vr_root", "type": "dataset", "facets": { ...whitelisted } },
    { "namespace": "overlay:prod", "name": "vr_parentA", "type": "dataset" }
  ],
  "edges": [
    { "from": "dataset:overlay:prod:vr_parentA", "to": "dataset:overlay:prod:vr_root", "rel": "parent" }
  ],
  "stats": { "nodes": 3, "edges": 2, "truncated": false }
}

Weitere Hilfsendpunkte (optional, empfohlen):
- GET /openlineage/nodes/dataset/:namespace/:name → Dataset‑Details (facets, letzte Runs)
- GET /openlineage/runs/:runId → Run‑Details (job, state, facets)
- GET /openlineage/jobs/:namespace/:name → Job‑Details + letzte Runs
- GET /openlineage/search?q=vr_ | filters…

7) UI‑Anbindung (D37)
- Visualize Tab:
  - ruft /openlineage/lineage (nodes/edges) – schnelle Graphdarstellung
  - “Expand deeper” → depth erhöhen (progressives Laden)
  - Facet‑Badges (gitdataSpv.readyDecision etc.) als optische Hinweise
- Verify Tab:
  - nutzt /bundle + /ready (SPV/Policy), klar getrennt
- Kein direkter OL‑Ingest von der UI (nur interne Emission)

8) Caching & Performance
- In‑Memory Cache der Query‑Ergebnisse (Key: node|depth|direction|format), TTL 60–300 s
- ETag/Last‑Modified für Browser‑Cache
- Query p95 Ziel < 200 ms (depth ≤ 5), Build (ohne Cache) < 300 ms
- MaxDepth = 10 (ENV), truncated Flag setzen wenn gekürzt

9) Reorg‑Resilienz
- Projektionsfreigabe abhängig von BUNDLE_CONFS_THRESHOLD
- Periodische Revalidierung (jüngste N Runs):
  - Bei Reorg → run.facets.reorgFacet setzen, optional state=ABORT
  - Nach Stabilisierung Flag entfernen/state = COMPLETE
- Konsistenzjob (täglich): Stichproben‑Vergleich edges vs /bundle.parents (100% match)

10) Security & Privacy
- Schreibzugriff auf Ingest nur intern (Adapter/Hook) oder per Token/IP‑Allowlist
- Facet‑Whitelist strikt, keine PII
- Rate‑Limits für Query (z. B. 60 req/min/IP)
- Logs redaktieren (keine Secrets; bei Fehlern nur Hashes/IDs)

11) Observability
- Metrics:
  - ol_events_ingested_total, ol_events_retry_total, ol_dlq_size
  - ol_query_latency_ms_p95, ol_cache_hit_ratio, ol_graph_truncated_total
  - ol_reorg_flags_total
- Logs:
  - {ts, level, action:ingest|query, node, depth, cacheHit, nodes, edges, truncated, ms, error?}
- Health: GET /openlineage/health (Adapter + Store + Query‑OK)

12) Tests & Abnahme
- E2E‑NoParents: COMPLETE (0 inputs, 1 output) → 1 Knoten, 0 Kanten; /bundle bestätigt
- E2E‑TwoParents: 2 inputs, 1 output → Kanten exakt wie bundle.parents
- Idempotenz: Doppelte COMPLETE‑Events → keine Duplikate (edges unique)
- Reorg‑Sim: reorgFacet gesetzt, später entfernt; Query zeigt Flag‑Status korrekt
- Performance: p95 Query < 200 ms (depth ≤ 5), Cache‑Hit > 70% bei wiederholter Nutzung
- Fehler: invalid node → 400, unbekannt → 404, Rate‑Limit → 429

13) Risiken & Mitigation
- Sehr große DAGs → Depth‑Limit, progressive Expansion
- Downstream (bundle/ready) langsam → TTL‑Cache & Circuit‑Breaker (503 Retry‑Hinweis)
- Schematreiberei → Facet‑Versionierung (gitdataSpv.v="1"), strikte JSON‑Validierung

14) ENV/Config
- OL_NAMESPACE=overlay:prod
- OL_IDEMPOTENCY=true
- OL_EXPORT_FACETS_JSON={"allow":["datasetVersion","dataSource","gitdataSpv","gitdataProvenance","lifecycleStateChange","reorgFacet","nominalTime"]}
- BUNDLE_CONFS_THRESHOLD=0|1|2
- OL_QUERY_MAX_DEPTH=10
- OL_QUERY_CACHE_TTL_SEC=120
- OL_QUERY_RATE_LIMIT_PER_MIN=60
- OVERLAY_BASE_URL=http://localhost:8788

15) Beispiel‑COMPLETE‑Event (2 Inputs, 1 Output)
{
  "eventType": "COMPLETE",
  "eventTime": "2025-01-01T12:00:00Z",
  "producer": "https://overlay.example/adapter/openlineage/1.0",
  "job": { "namespace": "overlay:prod", "name": "publish::vr_cafebabe" },
  "run": {
    "runId": "txid_a1b2c3...",
    "facets": {
      "nominalTime": { "nominalStartTime": "2025-01-01T11:59:58Z" },
      "gitdataSpv": {
        "confs": 2,
        "bundleUrl": "https://overlay.example/bundle?versionId=vr_cafebabe",
        "bundleHash": "3f8e...a0c1",
        "readyDecision": "allow",
        "readyReasons": []
      }
    }
  },
  "inputs": [
    { "namespace": "overlay:prod", "name": "vr_parentA" },
    { "namespace": "overlay:prod", "name": "vr_parentB" }
  ],
  "outputs": [
    {
      "namespace": "overlay:prod",
      "name": "vr_cafebabe",
      "facets": {
        "datasetVersion": { "version": "vr_cafebabe", "type": "dlm1", "contentHash": "deadbeef...", "createdAt": "2025-01-01T12:00:00Z" },
        "dataSource": { "name": "gitdata", "uri": "https://overlay.example/listings/vr_cafebabe" }
      }
    }
  ]
}

Nächste Schritte
- OL‑Adapter/Hook implementieren (Publish→OL COMPLETE, Recall→lifecycleStateChange)
- Store‑Tabellen anlegen, Ingest‑Pipeline (idempotent) + DLQ/Retry
- Query‑API (/openlineage/lineage) implementieren (depth/direction/format), inkl. Cache & Limits
- Docs: OL‑Naming, Facet‑Whitelist, Query‑Beispiele in “Docs” prominent verlinken

Damit ist OpenLineage Pflicht und vollständig integriert – ohne Marquez. Ihr bekommt eine standardisierte, schnelle Visualisierung und bleibt zugleich SPV‑konform und dezentral.




Beispiele:

Super—hier ist eine lauffähige, D24‑kompatible OpenLineage‑only Integration (ohne Marquez), bestehend aus:

- OL‑Adapter/Hook (Publish → COMPLETE, Recall → lifecycleStateChange)
- Store‑Tabellen (SQLite) + Idempotenter Ingest + DLQ/Retry‑Worker
- Query‑API GET /openlineage/lineage (depth/direction/format) mit In‑Memory‑Cache & Limits
- Docs (Naming, Facet‑Whitelist, Query‑Beispiele)

Hinweis
- Alles ist bewusst minimal gehalten, passt zu eurem Express + better‑sqlite3 Stil, nutzt /bundle als Wahrheitsquelle (SPV-first).
- Bitte Felder/Facets ggf. auf eure Manifest-/Bundle‑Formate abstimmen.

1) Create file: src/ol/schema.sql
```sql
-- Raw OpenLineage events (idempotent via hash)
CREATE TABLE IF NOT EXISTS ol_events (
  event_id TEXT PRIMARY KEY,
  event_time INTEGER NOT NULL,
  namespace TEXT NOT NULL,
  job_name TEXT NOT NULL,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ol_events_ns ON ol_events(namespace, job_name, run_id);

-- Jobs (latest facets snapshot)
CREATE TABLE IF NOT EXISTS ol_jobs (
  job_id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,
  latest_facets_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(namespace, name)
);

-- Runs (one per publish; idempotent on run_id)
CREATE TABLE IF NOT EXISTS ol_runs (
  run_id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  job_name TEXT NOT NULL,
  state TEXT NOT NULL, -- START|COMPLETE|ABORT
  start_time INTEGER,
  end_time INTEGER,
  facets_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Datasets (latest facets snapshot)
CREATE TABLE IF NOT EXISTS ol_datasets (
  dataset_id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,
  latest_facets_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(namespace, name)
);

-- Edges parent -> child (materialized lineage)
CREATE TABLE IF NOT EXISTS ol_edges (
  edge_id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  child_name TEXT NOT NULL,
  run_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(namespace, parent_name, child_name, run_id)
);
CREATE INDEX IF NOT EXISTS idx_ol_edges_child ON ol_edges(namespace, child_name);

-- DLQ for failed OL ingestion
CREATE TABLE IF NOT EXISTS ol_dlq (
  dlq_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_try_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ol_dlq_next ON ol_dlq(next_try_at);
```

2) Create file: src/ol/store.ts
```ts
 //import { createHash } from 'crypto';

export type OlEvent = {
  eventType: 'START'|'COMPLETE'|'ABORT';
  eventTime: string; // ISO
  producer: string;
  job: { namespace: string; name: string };
  run: { runId: string; facets?: any };
  inputs?: { namespace: string; name: string; facets?: any }[];
  outputs?: { namespace: string; name: string; facets?: any }[];
};

function nowSec() { return Math.floor(Date.now()/1000); }
function sha256hex(s: string) { return createHash('sha256').update(Buffer.from(s,'utf8')).digest('hex'); }

export function runOlMigrations(db: Database.Database) {
  const sql = require('fs').readFileSync(require('path').resolve(__dirname,'./schema.sql'),'utf8');
  db.exec(sql);
}

export function saveOlEvent(db: Database.Database, ev: OlEvent) {
  // Canonical JSON for idempotency hash
  const payload = JSON.stringify(ev);
  const hash = sha256hex(payload);
  const ts = Math.floor(new Date(ev.eventTime).getTime()/1000) || nowSec();

  const eventId = 'ole_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  try {
    db.prepare(`
      INSERT INTO ol_events(event_id, event_time, namespace, job_name, run_id, event_type, payload_json, hash, created_at)
      VALUES(@event_id, @event_time, @namespace, @job_name, @run_id, @event_type, @payload_json, @hash, @created_at)
    `).run({
      event_id: eventId,
      event_time: ts,
      namespace: ev.job.namespace,
      job_name: ev.job.name,
      run_id: ev.run.runId,
      event_type: ev.eventType,
      payload_json: payload,
      hash,
      created_at: nowSec()
    });
  } catch (e: any) {
    // Unique(hash) => idempotent NOOP
    if (!/UNIQUE/.test(String(e?.message || e))) throw e;
  }

  // Upsert job/run/datasets/edges snapshots (idempotent)
  const upsertJob = db.prepare(`
    INSERT INTO ol_jobs(job_id, namespace, name, latest_facets_json, created_at, updated_at)
    VALUES(@job_id, @ns, @name, @facets, @now, @now)
    ON CONFLICT(namespace,name) DO UPDATE SET latest_facets_json=excluded.latest_facets_json, updated_at=excluded.updated_at
  `);
  const upsertRun = db.prepare(`
    INSERT INTO ol_runs(run_id, namespace, job_name, state, start_time, end_time, facets_json, created_at, updated_at)
    VALUES(@run_id,@ns,@job,@state,@start,@end,@facets,@now,@now)
    ON CONFLICT(run_id) DO UPDATE SET state=excluded.state, end_time=excluded.end_time, facets_json=excluded.facets_json, updated_at=excluded.updated_at
  `);
  const upsertDs = db.prepare(`
    INSERT INTO ol_datasets(dataset_id, namespace, name, latest_facets_json, created_at, updated_at)
    VALUES(@id,@ns,@name,@facets,@now,@now)
    ON CONFLICT(namespace,name) DO UPDATE SET latest_facets_json=excluded.latest_facets_json, updated_at=excluded.updated_at
  `);
  const upsertEdge = db.prepare(`
    INSERT INTO ol_edges(edge_id, namespace, parent_name, child_name, run_id, created_at)
    VALUES(@edge_id,@ns,@parent,@child,@run,@now)
    ON CONFLICT(namespace,parent_name,child_name,run_id) DO NOTHING
  `);

  const ns = ev.job.namespace;
  const now = nowSec();
  const jobId = `${ns}::${ev.job.name}`;
  upsertJob.run({ job_id: jobId, ns, name: ev.job.name, facets: JSON.stringify(ev.run?.facets||{}), now });

  const start = ev.eventType === 'START' ? ts : null;
  const end = ev.eventType === 'COMPLETE' ? ts : null;
  const runState = ev.eventType;
  upsertRun.run({
    run_id: ev.run.runId, ns, job: ev.job.name, state: runState,
    start: start, end: end, facets: JSON.stringify(ev.run?.facets||{}), now
  });

  for (const d of ev.outputs || []) {
    const id = `${d.namespace}::${d.name}`;
    upsertDs.run({ id, ns: d.namespace, name: d.name, facets: JSON.stringify(d.facets||{}), now });
  }
  for (const d of ev.inputs || []) {
    const id = `${d.namespace}::${d.name}`;
    upsertDs.run({ id, ns: d.namespace, name: d.name, facets: JSON.stringify(d.facets||{}), now });
  }
  for (const parent of ev.inputs || []) {
    for (const child of ev.outputs || []) {
      const edgeId = `e_${ns}::${parent.name}->${child.name}::${ev.run.runId}`;
      upsertEdge.run({ edge_id: edgeId, ns, parent: parent.name, child: child.name, run: ev.run.runId, now });
    }
  }
}

export function enqueueDlq(db: Database.Database, payload: any, err: string, delaySec = 10) {
  const id = 'dlq_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  db.prepare(`
    INSERT INTO ol_dlq(dlq_id, payload_json, attempts, last_error, next_try_at, created_at, updated_at)
    VALUES(@id, @payload, 0, @err, @next, @now, @now)
  `).run({ id, payload: JSON.stringify(payload||{}), err, next: nowSec()+delaySec, now: nowSec() });
}

export function claimDlq(db: Database.Database) {
  const tx = db.transaction(()=>{
    const row = db.prepare(`SELECT * FROM ol_dlq WHERE next_try_at <= ? ORDER BY next_try_at ASC LIMIT 1`).get(nowSec()) as any;
    if (!row) return null;
    return row;
  });
  return tx() as any;
}

export function bumpDlq(db: Database.Database, dlqId: string, err: string, backoffSec=30) {
  db.prepare(`UPDATE ol_dlq SET attempts=attempts+1, last_error=?, next_try_at=?, updated_at=? WHERE dlq_id=?`)
    .run(err, nowSec()+backoffSec, nowSec(), dlqId);
}

export function deleteDlq(db: Database.Database, dlqId: string) {
  db.prepare(`DELETE FROM ol_dlq WHERE dlq_id=?`).run(dlqId);
}
```

3) Create file: src/ol/ingest.ts
```ts
 //import { saveOlEvent, enqueueDlq, claimDlq, bumpDlq, deleteDlq } from './store';

const OL_NAMESPACE = process.env.OL_NAMESPACE || 'overlay:dev';
const PRODUCER_URL = process.env.OL_PRODUCER_URL || 'https://overlay.example/adapter/openlineage/1.0';
const OVERLAY_BASE = (process.env.OVERLAY_BASE_URL || 'http://localhost:8788').replace(/\/+$/,'');
const BUNDLE_CONFS_THRESHOLD = Number(process.env.BUNDLE_CONFS_THRESHOLD || 0);

async function httpJson(method: 'GET'|'POST', url: string, body?: any, timeoutMs=10000) {
  const ctl = new AbortController(); const tm = setTimeout(()=>ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method, signal: ctl.signal as any,
      headers: { accept:'application/json', ...(body?{'content-type':'application/json'}:{}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const t = await r.text(); let j:any; try { j = JSON.parse(t); } catch { j={ raw:t }; }
    if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j)}`);
    return j;
  } finally { clearTimeout(tm); }
}

// Build OL COMPLETE from /bundle
export async function emitOlCompleteFromBundle(db: Database.Database, versionId: string) {
  const bundle = await httpJson('GET', `${OVERLAY_BASE}/bundle?versionId=${encodeURIComponent(versionId)}`);
  // Extract parents/version/time/hashes as per your bundle schema
  const parents: string[] = Array.isArray(bundle?.lineage?.parents) ? bundle.lineage.parents : (bundle?.parents || []);
  const createdAtIso: string = bundle?.provenance?.createdAt || new Date().toISOString();
  const contentHash: string = bundle?.content?.contentHash || bundle?.contentHash || null;
  const txid: string | null = bundle?.txid || null;
  const confs: number = Number(bundle?.spv?.confs || bundle?.confs || 0);

  // Gate by confirmations (optional)
  if (confs < BUNDLE_CONFS_THRESHOLD) {
    // enqueue into DLQ to retry later
    enqueueDlq(db, { type:'ol_complete_wait', versionId }, `insufficient-confs:${confs}`, 30);
    return;
  }

  const outputs = [{ namespace: OL_NAMESPACE, name: versionId,
    facets: {
      datasetVersion: { version: versionId, type:'dlm1', contentHash, createdAt: createdAtIso },
      dataSource: { name:'gitdata', uri:`${OVERLAY_BASE}/listings/${encodeURIComponent(versionId)}` }
    }
  }];

  const inputs = (parents||[]).map((p:string)=>({ namespace: OL_NAMESPACE, name: p }));

  const olEvent = {
    eventType: 'COMPLETE' as const,
    eventTime: new Date().toISOString(),
    producer: PRODUCER_URL,
    job: { namespace: OL_NAMESPACE, name: `publish::${versionId}` },
    run: { runId: txid || versionId, facets: {
      nominalTime: { nominalStartTime: createdAtIso },
      gitdataSpv: {
        confs,
        bundleUrl: `${OVERLAY_BASE}/bundle?versionId=${encodeURIComponent(versionId)}`
      }
    }},
    inputs, outputs
  };
  saveOlEvent(db, olEvent);
}

// Emit lifecycle change (recall/withdraw)
export async function emitOlRecall(db: Database.Database, versionId: string) {
  const olEvent = {
    eventType: 'COMPLETE' as const,
    eventTime: new Date().toISOString(),
    producer: PRODUCER_URL,
    job: { namespace: OL_NAMESPACE, name: `publish::${versionId}` },
    run: { runId: versionId, facets: { lifecycleStateChange: { lifecycleState: 'RETRACTED' } } },
    outputs: [{ namespace: OL_NAMESPACE, name: versionId }]
  };
  saveOlEvent(db, olEvent);
}

// DLQ worker
export function startOlDlqWorker(db: Database.Database) {
  async function step() {
    const row = claimDlq(db);
    if (!row) return;
    const payload = JSON.parse(row.payload_json || '{}');
    try {
      if (payload?.type === 'ol_complete_wait' && payload?.versionId) {
        await emitOlCompleteFromBundle(db, payload.versionId);
        deleteDlq(db, row.dlq_id);
      } else {
        // Unknown DLQ type -> drop with note
        deleteDlq(db, row.dlq_id);
      }
    } catch (e:any) {
      bumpDlq(db, row.dlq_id, String(e?.message||e), Math.min(300, 10 * (row.attempts + 1)));
    }
  }
  setInterval(()=>{ step().catch(()=>{}); }, 1000);
}
```

4) Create file: src/ol/query.ts
```ts
 //
type Direction = 'up'|'down'|'both';
const MAX_DEPTH = Number(process.env.OL_QUERY_MAX_DEPTH || 10);
const CACHE_TTL_MS = Number(process.env.OL_QUERY_CACHE_TTL_SEC || 120)*1000;

const cache = new Map<string, { exp: number; data: any }>();

function cacheKey(node: string, depth: number, dir: Direction, format: string) {
  return `${node}|${depth}|${dir}|${format}`;
}

function ttlGet(key: string) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { cache.delete(key); return null; }
  return e.data;
}
function ttlSet(key: string, data: any) {
  cache.set(key, { exp: Date.now() + CACHE_TTL_MS, data });
}

function parseNode(node: string) {
  // dataset:<namespace>:<name>
  const m = /^dataset:([^:]+):(.+)$/.exec(node);
  if (!m) throw new Error('bad-node');
  return { namespace: m[1], name: m[2] };
}

export function queryLineage(db: Database.Database, node: string, depth: number, dir: Direction, format='simple') {
  if (!/^dataset:/.test(node)) throw new Error('unsupported-node-type');
  if (depth < 0 || depth > MAX_DEPTH) throw new Error('bad-depth');
  if (!['up','down','both'].includes(dir)) throw new Error('bad-direction');
  if (!['simple','cyto'].includes(format)) throw new Error('bad-format');

  const key = cacheKey(node, depth, dir, format);
  const hit = ttlGet(key);
  if (hit) return { cache: true, graph: hit };

  const { namespace, name } = parseNode(node);

  // BFS up/down by ol_edges
  const nodes = new Map<string, any>();
  const edges: any[] = [];
  const seen = new Set<string>();
  const frontier: { name: string; depth: number }[] = [{ name, depth: 0 }];
  nodes.set(`${namespace}:${name}`, buildNode(db, namespace, name));

  while (frontier.length) {
    const cur = frontier.shift()!;
    if (cur.depth >= depth) continue;

    if (dir === 'up' || dir === 'both') {
      const parents = db.prepare(`SELECT DISTINCT parent_name FROM ol_edges WHERE namespace=? AND child_name=?`).all(namespace, cur.name) as any[];
      for (const p of parents) {
        const keyNode = `${namespace}:${p.parent_name}`;
        if (!nodes.has(keyNode)) nodes.set(keyNode, buildNode(db, namespace, p.parent_name));
        edges.push({ from: `dataset:${namespace}:${p.parent_name}`, to: `dataset:${namespace}:${cur.name}`, rel: 'parent' });
        const fkey = `${p.parent_name}|${cur.depth+1}|up`;
        if (!seen.has(fkey)) { seen.add(fkey); frontier.push({ name: p.parent_name, depth: cur.depth+1 }); }
      }
    }
    if (dir === 'down' || dir === 'both') {
      const childs = db.prepare(`SELECT DISTINCT child_name FROM ol_edges WHERE namespace=? AND parent_name=?`).all(namespace, cur.name) as any[];
      for (const c of childs) {
        const keyNode = `${namespace}:${c.child_name}`;
        if (!nodes.has(keyNode)) nodes.set(keyNode, buildNode(db, namespace, c.child_name));
        edges.push({ from: `dataset:${namespace}:${cur.name}`, to: `dataset:${namespace}:${c.child_name}`, rel: 'parent' });
        const fkey = `${c.child_name}|${cur.depth+1}|down`;
        if (!seen.has(fkey)) { seen.add(fkey); frontier.push({ name: c.child_name, depth: cur.depth+1 }); }
      }
    }
  }

  const outSimple = {
    node: `dataset:${namespace}:${name}`,
    depth, direction: dir,
    nodes: Array.from(nodes.values()),
    edges,
    stats: { nodes: nodes.size, edges: edges.length, truncated: depth >= MAX_DEPTH }
  };

  const graph = format === 'simple' ? outSimple : toCyto(outSimple);
  ttlSet(key, graph);
  return { cache: false, graph };
}

function buildNode(db: Database.Database, namespace: string, name: string) {
  const row = db.prepare(`SELECT latest_facets_json FROM ol_datasets WHERE namespace=? AND name=?`).get(namespace, name) as any;
  let facets: any = {}; try { facets = row?.latest_facets_json ? JSON.parse(row.latest_facets_json) : {}; } catch {}
  return { namespace, name, type: 'dataset', facets };
}

function toCyto(simple: any) {
  const nodes = simple.nodes.map((n:any)=>({ data: { id: `dataset:${n.namespace}:${n.name}`, ...n } }));
  const edges = simple.edges.map((e:any)=>({ data: { id: `${e.from}->${e.to}`, source: e.from, target: e.to, rel: e.rel } }));
  return { root: simple.node, depth: simple.depth, direction: simple.direction, elements: { nodes, edges }, stats: simple.stats };
}
```

5) Create file: src/routes/openlineage.ts
```ts
import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
 //import { queryLineage } from '../ol/query';
import { emitOlCompleteFromBundle, emitOlRecall } from '../ol/ingest';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function openLineageRouter(db: Database.Database): Router {
  const router = makeRouter();

  // Hook endpoints (optional): you can call these internally on publish/recall or expose behind auth
  router.post('/openlineage/hook/publish', async (req: Request, res: Response) => {
    const versionId = String(req.body?.versionId || '');
    if (!versionId) return json(res, 400, { error: 'bad-request', hint: 'versionId required' });
    try {
      await emitOlCompleteFromBundle(db, versionId);
      return json(res, 200, { status: 'ok' });
    } catch (e:any) {
      return json(res, 502, { error: 'hook-failed', message: String(e?.message||e) });
    }
  });

  router.post('/openlineage/hook/recall', async (req: Request, res: Response) => {
    const versionId = String(req.body?.versionId || '');
    if (!versionId) return json(res, 400, { error: 'bad-request', hint: 'versionId required' });
    try {
      await emitOlRecall(db, versionId);
      return json(res, 200, { status: 'ok' });
    } catch (e:any) {
      return json(res, 502, { error: 'hook-failed', message: String(e?.message||e) });
    }
  });

  // Query API: GET /openlineage/lineage?node=dataset:<ns>:<name>&depth=3&direction=both&format=simple
  router.get('/openlineage/lineage', (req: Request, res: Response) => {
    try {
      const node = String(req.query.node || '');
      const depth = Math.min(Number(req.query.depth || 3), 1000);
      const direction = (String(req.query.direction || 'both') as any);
      const format = String(req.query.format || 'simple');
      if (!node) return json(res, 400, { error: 'bad-request', hint: 'node required (dataset:<ns>:<name>)' });
      const { graph } = queryLineage(db, node, depth, direction, format);
      return json(res, 200, graph);
    } catch (e:any) {
      const msg = String(e?.message || e);
      if (/bad-node|bad-depth|bad-direction|bad-format|unsupported/.test(msg)) return json(res, 400, { error: 'bad-request', message: msg });
      return json(res, 500, { error: 'lineage-failed', message: msg });
    }
  });

  router.get('/openlineage/health', (_req, res)=> json(res, 200, { ok: true }));

  return router;
}
```

6) Update server.ts (Mount + Migrations + Worker)
```ts
// ...
import { runOlMigrations } from './src/ol/store';
import { openLineageRouter } from './src/routes/openlineage';
import { startOlDlqWorker } from './src/ol/ingest';

// after db initSchema(db);
runOlMigrations(db);

// mount routes
app.use(openLineageRouter(db));

// start DLQ worker
startOlDlqWorker(db);

// Hook wiring example: call emit on publish success (wherever your /submit handler completes)
// await emitOlCompleteFromBundle(db, versionId);
```

7) Docs: docs/openlineage.md
```md
# OpenLineage (OL) — Pflichtstandard im Overlay (ohne Marquez)

Wahrheit: /bundle (SPV) + /ready (Policy).  
Visualisierung: OL-Events → interner Store → Query: /openlineage/lineage

## Naming (deterministisch)
- namespace: overlay:<env>
- dataset.name: <versionId>
- job.name: publish::<versionId>
- run.runId: <txid> (oder sha256(versionId|createdAt))
- producer: https://<host>/adapter/openlineage/1.0

## Facet-Whitelist (keine PII)
- dataset.facets.datasetVersion: {version, type:"dlm1", contentHash, createdAt}
- dataset.facets.dataSource: {name:"gitdata", uri:"<overlay>/listings/<versionId>"}
- run.facets.nominalTime: {nominalStartTime}
- run.facets.gitdataSpv: {confs, bundleUrl, bundleHash?, readyDecision?, readyReasons?}
- dataset.facets.gitdataProvenance: {producerIdentityKey?, parentsCount?, lineageDepth?}
- run.facets.lifecycleStateChange (optional)
- run.facets.reorgFacet (optional)

## Hooks
- POST /openlineage/hook/publish {versionId}
- POST /openlineage/hook/recall {versionId}
Oder intern: emitOlCompleteFromBundle(db, versionId) / emitOlRecall(db, versionId)

## Query
- GET /openlineage/lineage?node=dataset:<namespace>:<name>&depth=3&direction=both&format=simple
- Response (simple)
{
  "node": "dataset:overlay:prod:<versionId>",
  "depth": 3,
  "direction": "both",
  "nodes": [{ "namespace": "...", "name": "...", "type": "dataset", "facets": {...} }],
  "edges": [{ "from": "dataset:<ns>:<parent>", "to": "dataset:<ns>:<child>", "rel": "parent" }],
  "stats": { "nodes": 3, "edges": 2, "truncated": false }
}

## Beispiele
- NoParents: 0 inputs, 1 output → ein isolierter Knoten
- TwoParents: 2 inputs, 1 output → zwei Kanten parent->child

## SLO/Perf
- p95 Query < 200ms (depth ≤ 5), Cache-Hit > 70%
- p95 Ingest < 300ms (ohne Backoff)
```

8) ENV (add to README/ENV)
- OL_NAMESPACE=overlay:prod
- OL_PRODUCER_URL=https://overlay.example/adapter/openlineage/1.0
- OVERLAY_BASE_URL=http://localhost:8788
- BUNDLE_CONFS_THRESHOLD=0
- OL_QUERY_MAX_DEPTH=10
- OL_QUERY_CACHE_TTL_SEC=120

How to try quickly
- Start Overlay
- Create/Publish a version (so /bundle returns data)
- Call: curl -sX POST http://localhost:8788/openlineage/hook/publish -H 'content-type: application/json' -d '{"versionId":"<yourVersionId>"}'
- Query: curl -s 'http://localhost:8788/openlineage/lineage?node=dataset:overlay:dev:<yourVersionId>&depth=3'
- You should see nodes/edges; Verify-tab should still use /bundle for SPV.

Notes
- Idempotenz: ol_events.hash, ol_runs.run_id, ol_edges UNIQUE sichern Doppelte ab.
- Reorgs: BUNDLE_CONFS_THRESHOLD > 0 verzögert Projektion; DLQ Worker versucht später erneut.
- Keine PII in Facets; whitelist in Code/Dok beibehalten.
- UI (D37): Visualize-Tab nutzt /openlineage/lineage; Verify-Tab nutzt /bundle + /ready.

Wenn du möchtest, liefere ich zusätzlich eine kleine Postman‑Sammlung für Hooks + Query (Good/Bad) und ein Minimaldiagramm für die Docs.