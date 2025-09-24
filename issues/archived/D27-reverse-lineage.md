Fantastic idea. What you want is “reverse lineage”: a user supplies a model’s hash (the AI hash), and the platform returns the cryptographically verifiable chain of training inputs, constraints, and attestations. Below is a D24‑aligned blueprint you can adopt without friction, leveraging what you already have (DLM1 manifests, lineage, /submit, /bundle, /ready, SPV, policies).

Proposed deliverable: D29 — Model Provenance & Reverse Lineage

Labels: provenance, models, lineage, governance, spv
Assignee: TBA
Estimate: 3–5 PT

Zweck
- Nutzer verbinden ein KI‑Modell mit der Plattform, indem sie einen stabilen AI Hash (z. B. sha256 der Gewichte/Artefakte) hinterlegen.
- Von dort aus zeigt die Plattform die verifizierbare Herkunft: auf welchen DLM1‑Versionen (Train/Val/Test/Features) das Modell basiert, welche Policies erfüllt sind, und optionale Dritt‑Attestierungen.
- Alles bleibt SPV‑first und vendor‑neutral, mit BRC‑31 Identity‑Signaturen für attestierte Einträge.

Nicht‑Ziele
- Kein Upload proprietärer Modelle/Weights in die Plattform (nur Hashes/Manifeste/Attestierungen).
- Kein On‑Chain‑Speichern großer Artefakte. Nur Hash‑Anker und lineage.
- Keine automatische Modellvalidierung (Accuracy, Benchmarks etc.) – optional später.

Kernidee
- Behandle ein Modell als DLM1 Version “modelArtifact”, deren contentHash = modelHash (z. B. sha256(weights file).
- Erzeuge einen “training index manifest” (oder “training event manifest”), dessen lineage.parents referenziert die Trainings‑Inputs (VersionIds oder ein Rollup-Index via Hash), und dessen provenance beschreibt Datum, Identität (BRC‑31), Toolchain, Run‑Params.
- Der “modelArtifact” verweist via lineage.parent auf den “training index manifest”.
- Resultat: mit /bundle?versionId=<modelVersionId> siehst du die Kette rückwärts (reverse lineage) – vollständig SPV‑verifizierbar.

API‑Oberfläche (neu, leichtgewichtig)
- POST /models/connect (identity‑signed optional)
  - body: { modelHash, artifactUrl?, sizeBytes?, framework?, tags?, trainingIndex?: { parents: string[], rollupHash?: string, split?: {train?:string[],val?:string[],test?:string[]} }, modelCard?: {...} }
  - Effekt:
    - Erzeuge DLM1 manifest für training index (falls angegeben) mit lineage.parents = trainingIndex.parents (oder nur rollupHash + eine Liste in externem Storage).
    - Erzeuge DLM1 manifest für modelArtifact (contentHash = modelHash, parent = trainingIndex.versionId).
    - Ankere via /submit (builder + submit flow). Die großen Artefakte bleiben extern (artifactUrl optional).
    - Speichere eine flache “models” Registry (DB) zur schnellen Suche (modelHash → modelVersionId).
  - Antwort: { status:"ok", modelVersionId, trainingIndexVersionId? }
- GET /models/search?modelHash=&q=&limit=&offset=
  - Suche nach modelHash (präfix) oder Metadaten.
- GET /models/:modelVersionId
  - Liefert modelArtifact Manifest + quick summary (parents count, createdAt, tags).
- GET /models/:modelVersionId/lineage
  - Liefert /bundle Proxy (oder JSON mit key data), optional reduziert (nur VersionIds und Kanten).
- GET /models/:modelVersionId/ready?policyId=...
  - Anwendet D28 Policy auf die reverse lineage des Modells (z. B. requiredAncestor, licenseAllowList, piiFlagsBlockList, maxTotalCostForLineage).

Datenmodell (leichtgewichtige Registry, zusätzlich zu DLM1)
- Tabelle models (optional; nur für schnelle Discovery, das Primäre ist on‑chain im Manifest)
  - model_version_id (PK)
  - model_hash (TEXT, unique)
  - training_index_version_id (TEXT nullable)
  - framework, tags_json, size_bytes, created_at
- Keine Duplizierung der DLM1 Felder; Discovery nutzt diese Registry, Trust kommt aus DLM1 + SPV.

Manifeste (DLM1, beispielhafte Felder)
- trainingIndex Manifest (type: "trainingIndex")
  - content: { rollupHash?: "sha256-of-external-list", stats?: {trainCount,valCount,testCount} }
  - lineage: { parents: [versionId…] }  // direkte Eltern (oder leer, wenn rollupHash genutzt)
  - provenance: { producer.identityKey, createdAt, toolchain: { name, version, paramsHash } }
  - policy: { license, classification }
- modelArtifact Manifest (type: "modelArtifact")
  - content: { contentHash: modelHash, framework, sizeBytes }
  - lineage: { parents: [trainingIndexVersionId] }
  - provenance: { producer.identityKey, createdAt, trainingRunId?, commitHash?, envHash? }
  - policy: { license, classification }

AI Hash Leitlinien (stabil und nachvollziehbar)
- Hash = sha256 der exakt gespeicherten Gewichte (z. B. .safetensors, .bin) ohne zusätzliche Metadaten. Dokumentiere:
  - artifactUrl (optional, kein Upload; nur Info)
  - sizeBytes
  - framework (torch, tf, onnx…)
- Falls Modell aus mehreren Dateien besteht, nutze deterministische Rollup‑Hash (z. B. Merkle root der Teilhashes) als contentHash oder als separate “weightsRoot” im content.

Reverse‑Lineage Visualisierung (UI/D25 Integration)
- SvelteKit:
  - Neue Route: /models (+ Suche nach modelHash) und /models/[modelVersionId]
  - Zeige: “Training Index” (VersionId), Anzahl/Beispiele der Eltern, Link zu /bundle (voll), optional “Policy Decision” (/ready?policyId=)
  - Badge: allow/warn/block nach Policy Preview
- Listings Integration:
  - Für jedes Listing: “Used By Models” (Option) – nur wenn du einen Index (model → parents) pflegst; sonst weglassen.
- CTA: “Modell verbinden” → führt auf POST /models/connect (Form: modelHash, optionale Metadaten, optional trainingIndex parents oder rollupHash)

Policy & Governance (D28 Verknüpfung)
- /ready auf modelVersionId:
  - Prüft ancestor‑basierte Regeln (requiredAncestor, maxLineageDepth)
  - Compliance (licenseAllowList, piiFlagsBlockList, geoOriginAllowList)
  - Ökonomische Regeln (maxTotalCostForLineage, maxPricePerByte – via sizeBytes und pricebook)
  - Qualität/MLOps (requiredFeatureSetId, requiresValidSplit, profileHash etc., sofern in Elternmanifesten vorhanden)
- “Warn statt Block” für teure Checks, falls PREVIEW-Modus

Prozess für einen Nutzer (frictionless)
1) Er berechnet den modelHash lokal (sha256(weightsfile).
2) Öffnet “Modell verbinden” (UI) und gibt modelHash ein; optional:
   - trainingIndex parents (VersionIds), oder nur rollupHash, falls Trainingsliste extern liegt.
   - modelCard Meta (links, tags).
3) Plattform erstellt die beiden Manifeste (trainingIndex optional) und verankert via /submit (DLM1).
4) Plattform zeigt:
   - modelVersionId
   - Link “Lineage anzeigen” (/models/:id/lineage → /bundle)
   - “Readiness gegen Policy prüfen” (/ready?policyId=…)
5) Ab dann ist das Modell in der Discovery (Search/Search by modelHash) sichtbar; jeder kann die verifizierbare Herkunft sehen.

Definition of Done (DoD)
- /models/connect erzeugt (mind.) ein modelArtifact manifest, anchored (SPV‑fähig), und optional ein trainingIndex manifest.
- /models/:id/lineage liefert die verifizierbare Kette (Proxy auf /bundle).
- /models/:id/ready?policyId=… integriert D28‑Policies und liefert decision + reasons + evidence.
- SvelteKit UI (D25) hat einfache “Modell verbinden” Maske + Modell‑Detail + Verlinkung auf Lineage/Ready.
- Dokumentation: AI Hash Berechnung, minimaler “modelCard” Leitfaden, Grenzen (große Trainingslisten → rollupHash).

Abnahmekriterien (Tests)
- Happy Path: connect → modelVersionId → bundle zeigt Eltern/Inputs → ready(policy) liefert allow (bei passender Policy)
- Ohne trainingIndex parents: connect mit nur modelHash → manifest anchored → lineage zeigt nur 1 parent (oder none), OK
- Mit rollupHash: connect → bundle enthält trainingIndex + rollupHash; Hinweis, dass Trainingsliste extern validierbar sein muss (Hash‑gleich)
- Negative: Policy blockt (producer nicht erlaubt / missing ancestor / license nicht erlaubt) → decision block, reasons enthalten ReasonCodes
- Idempotenz: gleicher modelHash + identische Angaben → keine Duplikate (gleiche contentHash → erkennbar)
- SPV: /bundle und /ready arbeiten ohne Indexer

Risiken/Rollback
- Sehr große Trainingsmengen → verwalte via rollupHash und nur exemplarische Parents im trainingIndex
- Private Trainingsdaten → nur Hash/IDs veröffentlichen; keine sensiblen Inhalte
- Fehlende Eltern/Inkonsistenzen → kennzeichne im /ready evidence; block/warn je Policy

Kurz: So verbindest du “reverse lineage” sauber mit deinem bestehenden D24‑Stack. Du verankerst nur Hashes und Bezüge (DLM1 + lineage), nutzt /bundle für die Verifikation, /ready+Policy für Governance, BRC‑31 für Identität, und bleibst dank SPV vendor‑neutral.


Great idea. Here’s a single, D24-style scaffold you can drop in to add “reverse lineage” for models (AI hash → certified training provenance). It follows the same Express + better-sqlite3 patterns you’re already using and degrades cleanly if advanced endpoints (/submit/dlm1, /submit, /bundle, /ready) aren’t mounted.

Create file: src/models/scaffold.ts
This adds:
- DB migrations (models registry)
- POST /models/connect to anchor a modelArtifact (and optional trainingIndex) as DLM1 manifests, with two modes:
  - synthetic: no advanced endpoints needed (generates deterministic versionIds)
  - advanced: optionally call /submit/dlm1 + /submit to anchor on-chain (if your overlay exposes them)
- GET /models/search, GET /models/:id (basic registry info)
- GET /models/:id/lineage (proxy to /bundle), GET /models/:id/ready (proxy to /ready)

Note
- This is a scaffold. Align manifest fields with your production schema and verify with the community before enabling in production.

```ts
/*
  D29 — Model Provenance & Reverse Lineage (D24-compatible scaffold)

  What this adds:
  - DB migrations:
      models (model_version_id PK, model_hash unique, training_index_version_id, tags_json, framework, size_bytes, created_at)
  - Routes:
      POST /models/connect          (register & anchor a modelArtifact; optional trainingIndex)
      GET  /models/search?q=...     (search by modelHash prefix or tag)
      GET  /models/:id              (registry info)
      GET  /models/:id/lineage      (proxy to /bundle?versionId=)
      GET  /models/:id/ready        (proxy to /ready?versionId=&policyId=)
  - Modes:
      MODEL_ANCHOR_MODE=synthetic|advanced
        synthetic: no /submit endpoints required (deterministic versionIds from hash)
        advanced: attempts /submit/dlm1 + /submit to anchor manifests (like your DLM1 flow)

  ENV (suggested):
    MODEL_ANCHOR_MODE=synthetic   # or advanced
    OVERLAY_SELF_URL=http://localhost:8788  # required in advanced mode to call /submit endpoints
    MODEL_PRODUCER_IDENTITY_KEY=02...       # optional provenance.identityKey hint
*/

import type { Router, Request, Response } from 'express';
import { Router as makeRouter } from 'express';
 //import { createHash } from 'crypto';

// ---------------- Env / Config ----------------

const MODEL_ANCHOR_MODE = (process.env.MODEL_ANCHOR_MODE || 'synthetic').toLowerCase(); // synthetic|advanced
const SELF = (process.env.OVERLAY_SELF_URL || 'http://localhost:8788').replace(/\/+$/, '');
const PRODUCER_ID_KEY = (process.env.MODEL_PRODUCER_IDENTITY_KEY || '').trim();

// ---------------- Utils ----------------

function nowSec() { return Math.floor(Date.now() / 1000); }
function sha256hex(buf: Buffer | string) {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return createHash('sha256').update(b).digest('hex');
}
function json(res: Response, code: number, body: any) { return res.status(code).json(body); }
function safeId(prefix: string) { return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`; }

async function httpJson(method: 'GET'|'POST', url: string, body?: any, timeoutMs = 10000): Promise<any> {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method,
      signal: ctl.signal as any,
      headers: { accept: 'application/json', ...(body ? { 'content-type':'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const txt = await r.text();
    let js: any; try { js = JSON.parse(txt); } catch { js = { raw: txt }; }
    if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(js)}`);
    return js;
  } finally {
    clearTimeout(tm);
  }
}

// ---------------- Migrations ----------------

export function runModelsMigrations(db: Database.Database) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS models (
      model_version_id TEXT PRIMARY KEY,
      model_hash TEXT NOT NULL UNIQUE,
      training_index_version_id TEXT,
      framework TEXT,
      tags_json TEXT,
      size_bytes INTEGER,
      created_at INTEGER NOT NULL
    )
  `).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_models_hash ON models(model_hash)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_models_created ON models(created_at)`).run();
}

// ---------------- DB helpers ----------------

type ModelRow = {
  model_version_id: string;
  model_hash: string;
  training_index_version_id?: string | null;
  framework?: string | null;
  tags_json?: string | null;
  size_bytes?: number | null;
  created_at: number;
};

function upsertModel(db: Database.Database, r: Partial<ModelRow>) {
  const id = r.model_version_id || safeId('md');
  const now = nowSec();
  db.prepare(`
    INSERT INTO models(model_version_id, model_hash, training_index_version_id, framework, tags_json, size_bytes, created_at)
    VALUES(@model_version_id, @model_hash, @training_index_version_id, @framework, @tags_json, @size_bytes, @created_at)
    ON CONFLICT(model_hash) DO UPDATE SET
      training_index_version_id=COALESCE(excluded.training_index_version_id, models.training_index_version_id),
      framework=COALESCE(excluded.framework, models.framework),
      tags_json=COALESCE(excluded.tags_json, models.tags_json),
      size_bytes=COALESCE(excluded.size_bytes, models.size_bytes)
  `).run({
    model_version_id: id,
    model_hash: r.model_hash!,
    training_index_version_id: r.training_index_version_id || null,
    framework: r.framework || null,
    tags_json: r.tags_json || null,
    size_bytes: r.size_bytes || null,
    created_at: r.created_at || now
  });
  return id;
}

function getModel(db: Database.Database, id: string): ModelRow | undefined {
  // Accept either model_version_id exact or model_hash exact
  const row = db.prepare(`SELECT * FROM models WHERE model_version_id = ?`).get(id) as any;
  if (row) return row;
  const byHash = db.prepare(`SELECT * FROM models WHERE model_hash = ?`).get(id) as any;
  return byHash || undefined;
}

function searchModels(db: Database.Database, q?: string, limit=20, offset=0): ModelRow[] {
  const where: string[] = [];
  const params: any[] = [];
  if (q) {
    // naive prefix search on hash or tags_json LIKE
    where.push(`(model_hash LIKE ? OR tags_json LIKE ?)`);
    params.push(`${q}%`, `%${q}%`);
  }
  const sql = `
    SELECT * FROM models
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  return db.prepare(sql).all(...params) as any[];
}

// ---------------- Manifest builders (synthetic) ----------------

type TrainingIndexParams = {
  parents?: string[];            // array of versionIds
  rollupHash?: string;           // optional merkle root of external list
  split?: { train?: string[]; val?: string[]; test?: string[] }; // informational
};

function buildTrainingIndexManifest(p: TrainingIndexParams) {
  return {
    type: 'trainingIndex',
    description: 'Model training index (reverse lineage entry)',
    content: {
      rollupHash: p.rollupHash || null,
      stats: {
        trainCount: p.split?.train?.length || null,
        valCount: p.split?.val?.length || null,
        testCount: p.split?.test?.length || null
      }
    },
    lineage: { parents: Array.isArray(p.parents) ? p.parents : [] },
    provenance: {
      createdAt: new Date().toISOString(),
      producer: PRODUCER_ID_KEY ? { identityKey: PRODUCER_ID_KEY } : undefined
    },
    policy: { classification: 'public' }
  };
}

function buildModelArtifactManifest(modelHash: string, framework?: string, sizeBytes?: number, trainingIndexVersionId?: string) {
  return {
    type: 'modelArtifact',
    description: 'Anchored model artifact',
    content: { contentHash: modelHash, framework: framework || null, sizeBytes: sizeBytes || null },
    lineage: { parents: trainingIndexVersionId ? [trainingIndexVersionId] : [] },
    provenance: {
      createdAt: new Date().toISOString(),
      producer: PRODUCER_ID_KEY ? { identityKey: PRODUCER_ID_KEY } : undefined
    },
    policy: { classification: 'public' }
  };
}

// ---------------- Anchor flows ----------------

async function anchorSynthetic(modelHash: string, tr?: TrainingIndexParams, opts?: { framework?: string; sizeBytes?: number }) {
  const tid = tr && (tr.parents?.length || tr.rollupHash) ? `ti_${modelHash.slice(0, 16)}` : null;
  const mid = `md_${modelHash.slice(0, 24)}`;
  const trainingManifest = tid ? buildTrainingIndexManifest(tr!) : null;
  const modelManifest = buildModelArtifactManifest(modelHash, opts?.framework, opts?.sizeBytes, tid || undefined);
  // No network calls; return synthetic ids + manifests for evidence/logs
  return { trainingIndexVersionId: tid, modelVersionId: mid, manifests: { training: trainingManifest, model: modelManifest } };
}

async function anchorAdvanced(modelHash: string, tr?: TrainingIndexParams, opts?: { framework?: string; sizeBytes?: number }) {
  // Calls /submit/dlm1 then /submit (OP_RETURN builder + rawTx receiver) — shape based on your advanced flow
  // 1) Optional: trainingIndex
  let trainingIndexVersionId: string | null = null;

  if (tr && (tr.parents?.length || tr.rollupHash)) {
    const tiManifest = buildTrainingIndexManifest(tr);
    const build = await httpJson('POST', `${SELF}/submit/dlm1`, { manifest: tiManifest });
    const scriptHex = build.opReturnScriptHex || build.outputs?.[0]?.scriptHex;
    if (!scriptHex || !build.versionId) throw new Error('builder-missing (trainingIndex)');
    // Dev-only: synthetic tx with OP_RETURN-only
    const rawTx = buildRawTxWithOpReturn(scriptHex);
    const submit = await httpJson('POST', `${SELF}/submit`, { rawTx, manifest: tiManifest });
    trainingIndexVersionId = build.versionId || submit.versionId || null;
  }

  // 2) modelArtifact
  const modelManifest = buildModelArtifactManifest(modelHash, opts?.framework, opts?.sizeBytes, trainingIndexVersionId || undefined);
  const mBuild = await httpJson('POST', `${SELF}/submit/dlm1`, { manifest: modelManifest });
  const mScriptHex = mBuild.opReturnScriptHex || mBuild.outputs?.[0]?.scriptHex;
  if (!mScriptHex || !mBuild.versionId) throw new Error('builder-missing (modelArtifact)');
  const mRawTx = buildRawTxWithOpReturn(mScriptHex);
  const mSubmit = await httpJson('POST', `${SELF}/submit`, { rawTx: mRawTx, manifest: modelManifest });
  const modelVersionId = mBuild.versionId || mSubmit.versionId;

  return { trainingIndexVersionId, modelVersionId, manifests: { training: tr ? buildTrainingIndexManifest(tr) : null, model: modelManifest } };
}

// Minimal OP_RETURN rawTx constructor (dev only)
function varInt(n: number): Uint8Array {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, (n >> 8) & 0xff);
  return Uint8Array.of(0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
}
function fromHex(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) throw new Error('invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i=0; i<out.length; i++) out[i] = parseInt(hex.slice(i*2, i*2+2), 16);
  return out;
}
function toHex(b: Uint8Array): string { return Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join(''); }
function concatBytes(arr: Uint8Array[]): Uint8Array {
  const len = arr.reduce((n,a)=>n+a.length,0);
  const out = new Uint8Array(len);
  let o=0; for (const a of arr) { out.set(a,o); o+=a.length; }
  return out;
}
function buildRawTxWithOpReturn(scriptHex: string): string {
  const version = Uint8Array.of(1,0,0,0);
  const vinCount = varInt(1);
  const prevTxid = new Uint8Array(32);
  const prevVout = Uint8Array.of(0xff,0xff,0xff,0xff);
  const scriptSigLen = varInt(0);
  const sequence = Uint8Array.of(0xff,0xff,0xff,0xff);
  const voutCount = varInt(1);
  const value0 = new Uint8Array(8); // zero
  const script = fromHex(scriptHex);
  const scriptLen = varInt(script.length);
  const locktime = new Uint8Array(4);
  const tx = concatBytes([version, vinCount, prevTxid, prevVout, scriptSigLen, sequence, voutCount, value0, scriptLen, script, locktime]);
  return toHex(tx);
}

// ---------------- Router ----------------

export function modelsRouter(db: Database.Database): Router {
  const router = makeRouter();

  // POST /models/connect
  // Body: {
  //   modelHash: string (sha256 of weights), framework?: string, sizeBytes?: number,
  //   tags?: any[], trainingIndex?: { parents?: string[], rollupHash?: string, split?: {...} }
  // }
  router.post('/models/connect', async (req: Request, res: Response) => {
    try {
      const { modelHash, framework, sizeBytes, tags, trainingIndex } = req.body || {};
      if (!modelHash || typeof modelHash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(modelHash)) {
        return json(res, 400, { error: 'bad-request', hint: 'modelHash (sha256 hex) required' });
      }

      let result: { trainingIndexVersionId: string | null; modelVersionId: string; manifests: any };
      if (MODEL_ANCHOR_MODE === 'advanced') {
        result = await anchorAdvanced(modelHash, trainingIndex || undefined, { framework, sizeBytes });
      } else {
        result = await anchorSynthetic(modelHash, trainingIndex || undefined, { framework, sizeBytes });
      }

      const modelVersionId = upsertModel(db, {
        model_version_id: result.modelVersionId,
        model_hash: modelHash.toLowerCase(),
        training_index_version_id: result.trainingIndexVersionId || null,
        framework: framework || null,
        tags_json: tags ? JSON.stringify(tags) : null,
        size_bytes: typeof sizeBytes === 'number' ? sizeBytes : null
      });

      return json(res, 200, {
        status: 'ok',
        modelVersionId,
        trainingIndexVersionId: result.trainingIndexVersionId || null,
        mode: MODEL_ANCHOR_MODE,
        evidence: { manifests: result.manifests }
      });
    } catch (e: any) {
      return json(res, 500, { error: 'connect-failed', message: String(e?.message || e) });
    }
  });

  // GET /models/search?q=&limit=&offset=
  router.get('/models/search', (req: Request, res: Response) => {
    const q = req.query.q ? String(req.query.q) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const rows = searchModels(db, q, limit, offset);
    const items = rows.map(r => ({
      modelVersionId: r.model_version_id,
      modelHash: r.model_hash,
      trainingIndexVersionId: r.training_index_version_id || null,
      framework: r.framework || null,
      sizeBytes: r.size_bytes || null,
      tags: r.tags_json ? safeParse(r.tags_json, []) : [],
      createdAt: r.created_at
    }));
    return json(res, 200, { items });
  });

  // GET /models/:id
  router.get('/models/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const r = getModel(db, id);
    if (!r) return json(res, 404, { error: 'not-found' });
    return json(res, 200, {
      modelVersionId: r.model_version_id,
      modelHash: r.model_hash,
      trainingIndexVersionId: r.training_index_version_id || null,
      framework: r.framework || null,
      sizeBytes: r.size_bytes || null,
      tags: r.tags_json ? safeParse(r.tags_json, []) : [],
      createdAt: r.created_at
    });
  });

  // GET /models/:id/lineage (proxy to /bundle)
  router.get('/models/:id/lineage', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const r = getModel(db, id);
      if (!r) return json(res, 404, { error: 'not-found' });
      const js = await httpJson('GET', `${SELF}/bundle?versionId=${encodeURIComponent(r.model_version_id)}`);
      return json(res, 200, js);
    } catch (e: any) {
      return json(res, 502, { error: 'bundle-proxy-failed', message: String(e?.message || e) });
    }
  });

  // GET /models/:id/ready?policyId=
  router.get('/models/:id/ready', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const r = getModel(db, id);
      if (!r) return json(res, 404, { error: 'not-found' });
      const policyId = req.query.policyId ? String(req.query.policyId) : '';
      const u = `${SELF}/ready?versionId=${encodeURIComponent(r.model_version_id)}${policyId ? `&policyId=${encodeURIComponent(policyId)}` : ''}`;
      const js = await httpJson('GET', u);
      return json(res, 200, js);
    } catch (e: any) {
      return json(res, 502, { error: 'ready-proxy-failed', message: String(e?.message || e) });
    }
  });

  return router;
}

function safeParse<T=any>(s: string, fallback: T): T {
  try { return JSON.parse(s); } catch { return fallback; }
}
```

How to wire it (server.ts)
- After your DB init:
- Mount the router.

import { runModelsMigrations, modelsRouter } from './src/models/scaffold';

// ...
runModelsMigrations(db);
app.use(modelsRouter(db));
// ...

Quick try
- Synthetic (no advanced endpoints needed):
  - export MODEL_ANCHOR_MODE=synthetic
  - POST /models/connect with { "modelHash":"<64-hex>", "framework":"torch", "sizeBytes":123456, "trainingIndex": { "parents":["<versionId>"] } }
  - GET /models/search?q=<prefix>
  - GET /models/:id/lineage and /models/:id/ready will proxy to your /bundle and /ready (must be mounted)
- Advanced (anchors via /submit/dlm1 + /submit):
  - export MODEL_ANCHOR_MODE=advanced
  - export OVERLAY_SELF_URL=http://localhost:8788
  - Ensure your overlay exposes /submit/dlm1 and /submit like in your advanced flows

Notes
- This scaffold keeps everything vendor-neutral and SPV-first. In synthetic mode, you still get deterministic ids, evidence manifests, and reverse lineage relationships without needing on-chain submission. Switch to advanced mode to actually anchor DLM1 manifests using your existing submit routes.
- Adapt manifest fields (description, policy, provenance) to your org’s model card/attestation needs.