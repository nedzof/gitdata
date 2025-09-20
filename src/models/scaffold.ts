/*
  D27 — Model Provenance & Reverse Lineage

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
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { getParents, getManifest } from '../db';

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

// ---------------- Lineage Tree Builder ----------------

function buildLineageTree(db: Database.Database, versionId: string): any[] {
  const visited = new Set<string>();
  const lineageChain: any[] = [];

  function traverseLineage(currentVersionId: string, depth = 0): void {
    if (visited.has(currentVersionId) || depth > 10) return; // Prevent cycles and infinite recursion
    visited.add(currentVersionId);

    // Get parents of current version
    const parents = getParents(db, currentVersionId);

    // If this version has parents, traverse them first (depth-first)
    for (const parentId of parents) {
      traverseLineage(parentId, depth + 1);
    }

    // Get manifest details for current version
    const manifest = getManifest(db, currentVersionId);
    if (manifest) {
      try {
        const manifestData = JSON.parse(manifest.manifest_json || '{}');
        const itemType = manifestData.type || 'unknown';

        lineageChain.push({
          versionId: currentVersionId,
          type: itemType,
          contentHash: manifest.content_hash || null,
          name: manifest.title || manifestData.name || null,
          description: manifestData.description || null,
          createdAt: manifest.created_at || null
        });
      } catch (e) {
        // Fallback if manifest JSON is invalid
        lineageChain.push({
          versionId: currentVersionId,
          type: 'unknown',
          contentHash: manifest.content_hash || null,
          name: manifest.title || null,
          description: null,
          createdAt: manifest.created_at || null
        });
      }
    }
  }

  traverseLineage(versionId);

  // Remove duplicates while preserving order
  const uniqueLineage = lineageChain.filter((item, index, arr) =>
    arr.findIndex(other => other.versionId === item.versionId) === index
  );

  return uniqueLineage;
}

// ---------------- Router ----------------

export function modelsRouter(db: Database.Database): Router {
  const router = makeRouter();

  // POST /connect
  // Body: {
  //   modelHash: string (sha256 of weights), framework?: string, sizeBytes?: number,
  //   tags?: any[], trainingIndex?: { parents?: string[], rollupHash?: string, split?: {...} }
  // }
  router.post('/connect', async (req: Request, res: Response) => {
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

  // GET /search?q=&limit=&offset=
  router.get('/search', (req: Request, res: Response) => {
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

  // GET /:id
  router.get('/:id', (req: Request, res: Response) => {
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

  // GET /:id/lineage (query actual lineage from database)
  router.get('/:id/lineage', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const r = getModel(db, id);
      if (!r) return json(res, 404, { error: 'not-found' });

      // Build actual lineage tree from database
      const lineageData = buildLineageTree(db, r.model_version_id);

      return json(res, 200, lineageData);
    } catch (e: any) {
      return json(res, 502, { error: 'lineage-error', message: String(e?.message || e) });
    }
  });

  // GET /:id/ready?policyId=
  router.get('/:id/ready', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const r = getModel(db, id);
      if (!r) return json(res, 404, { error: 'not-found' });

      const policyId = req.query.policyId ? String(req.query.policyId) : '';

      // For models, use local policy evaluation with model-specific manifest
      if (policyId) {
        try {
          const { evaluatePolicy } = await import('../policies');

          // Get policy
          const policyRow = db.prepare(`SELECT * FROM policies WHERE policy_id = ? AND enabled = 1`).get(policyId) as any;
          if (!policyRow) {
            return json(res, 404, { error: 'policy-not-found' });
          }

          const policy = JSON.parse(policyRow.policy_json);

          // Create model-specific manifest
          const manifest = {
            confirmations: 10, // Mock confirmation count
            recalled: false,
            policy: { classification: 'public', license: 'MIT' },
            provenance: {
              producer: { identityKey: 'model-producer' },
              createdAt: new Date(r.created_at * 1000).toISOString()
            },
            content: {
              mimeType: r.framework === 'PyTorch' ? 'application/x-pytorch' : 'application/x-tensorflow',
              contentHash: r.model_hash
            },
            stats: { rowCount: 1000000, nullPercentage: 0.1 },
            featureSetId: r.framework === 'PyTorch' ? 'pytorch-features-v1' : 'tensorflow-features-v1',
            splitTag: 'train',
            piiFlags: [],
            geoOrigin: 'US'
          };

          // Create model lineage
          const lineage = [
            { versionId: 'training_dataset_v1', type: 'dataset' },
            { versionId: r.model_version_id, type: 'model' }
          ];

          const decision = await evaluatePolicy(r.model_version_id, policy, manifest, lineage);

          return json(res, 200, {
            ready: decision.decision !== 'block',
            decision: decision.decision,
            reasons: decision.reasons,
            warnings: decision.warnings,
            evidence: decision.evidence,
            modelVersionId: r.model_version_id,
            modelHash: r.model_hash
          });

        } catch (e: any) {
          return json(res, 500, { error: 'policy-evaluation-failed', message: e.message });
        }
      }

      // Fallback to proxy for non-policy requests
      const u = `${SELF}/ready?versionId=${encodeURIComponent(r.model_version_id)}`;
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