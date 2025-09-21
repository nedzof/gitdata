# D24 — Agent Marketplace & Automation

Labels: agents, automation, marketplace
Assignee: TBA
Estimate: 4–5 PT

Zweck
- Generisches Agenten‑Ökosystem aufbauen: Registrierung, Capability‑Discovery, deklarative Regeln/Workflows und sichere Ausführung.
- Beispielnutzen: “Finde Ressourcen/Events/Daten, die Kriterium X erfüllen → erstelle Angebot/Vertrag → führe Folgeaktionen aus (Preis setzen, zahlen, benachrichtigen, publizieren)”.
- Netzwerkeffekt: Mehr Agenten → mehr Automatisierung → mehr Plattformwert.

Abhängigkeiten
- D01 (DLM1 Submit), D02 (SPV), D03/D04 (/bundle, /ready), D05/D09 (Price/Pricebook), D06/D07 (Pay/Data), D08 (Producers), D11 (Caching), D12 (Limits), D19 (Identity), D21 (BSV Payments, optional), D23 (Realtime Ingest, optional)

Technische Architektur (Kurz)
- Rule DSL (deklarativ): “find where <predicate> then <actions>”
- Agent Registry & Discovery: Fähigkeiten, Inputs/Outputs, Webhook/Task‑Interface
- Job Orchestrator: Queue, Retry/Backoff, Idempotenz, Dead Letter
- Templates: Angebote/Verträge/Dokumente (optional DLM1 verankern)
- Identity & Policy: BRC‑31 Headers, Allowlist, Rollen
- Zahlungen: Preis/Payout (D21/D09), Quittungen (D06), optional on‑chain Anker
- Audit & Evidence: Artefakte/Logs, SPV‑verifizierbare Outputs (DLM1) falls publiziert

Aufgaben
- Agent Registry & Discovery
  - [ ] POST /agents/register (identity‑signed): { name, capabilities:[{name, inputs, outputs}], webhookUrl, publicKey? }
  - [ ] GET /agents/search?q&capability=… (Filter/Tags), GET /agents/:id (Profil)
  - [ ] Health/Ping: POST /agents/:id/ping (Signaturprüfung), Status in /metrics
- Rule DSL & Workflows
  - [ ] /rules: create/list/update/enable; DSL JSON wie:
        {
          "name":"my-rule",
          "when": { "type":"ready", "predicate":"(price < 1000) && (tags includes 'premium')" },
          "find": { "source":"search|resolve|feed", "query":{ ... } },
          "then": [
            { "action":"notify", "agentId":"...", "payload":{ ... } },
            { "action":"contract.generate", "templateId":"...", "vars":{ ... } },
            { "action":"price.set", "versionId":"...", "satoshis":1234 },
            { "action":"pay", "versionId":"...", "quantity":1 }
          ]
        }
  - [ ] Policy Guards: Max concurrency, time windows, allowlists
- Job Orchestrierung
  - [ ] /jobs: enqueue/list/status → Zustandsautomat (queued, running, done, failed, dead)
  - [ ] Retry/Backoff (exponential), Dead‑letter mit Ursache
  - [ ] Idempotenz: jobKey (ruleId + targetId), dedup
- Agent Execution/Callbacks
  - [ ] Webhook‑Aufrufe mit BRC‑31 Headers (body+nonce signieren)
  - [ ] Agent antwortet: { ok, artifacts:[{type,url|bytes,hash}] }
  - [ ] Artefakte optional als DLM1 publizieren (publish action) → /submit‑builder/receiver
- Integration mit Preis/Zahlung
  - [ ] price.set (D05/D09), price.rules (D09), pay (D06/D21)
  - [ ] Ergebnis/Ausgangszahlungen (overlay/producer splits, D21)
- Sicherheit & Identity
  - [ ] BRC‑31‑Signatur erzwingen auf /agents/*, /rules/*, /templates/* (ENV‑Flag)
  - [ ] Rate‑Limits (D12), Rollen/Scopes (admin/publisher/agent)
- Audit, Evidence & Observability
  - [ ] Evidence Pack pro Job: inputs, agent calls, outputs, (optional) DLM1 versionIds
  - [ ] /metrics: jobs/sec, successRate, p95 Dauer, DLQ Count, agent RTT
  - [ ] /health: Queue‑Lag, Agent‑Reachability

Definition of Done (DoD)
- [ ] Agenten registrierbar & auffindbar; Health/Ping sichtbar.
- [ ] Regeln triggern automatisch passende Jobs (search/resolve/feed) und führen Aktionen deterministisch aus.
- [ ] Jobs idempotent, retry‑fähig, mit Dead‑letter; Artefakte/Dokumente generierbar; optional DLM1/publish.
- [ ] Identity‑Signatur geprüft; Policies (Rate, Concurrency) greifen; Audit/Evidence per Job vorhanden.

Abnahmekriterien (Tests)
- [ ] Happy Path: rule(find) → notify(agent) → generate(contract) → price.set → pay → (optional publish) → evidence ok
- [ ] Negativ: Agent down → Retry → DLQ nach N Versuchen; Replay (duplizierter Trigger) → idempotent
- [ ] Performance: p95 job end‑to‑end < X s (konfigurierbar); Backpressure greift bei Last

Artefakte
- [ ] Rule DSL Beispiele, Agent Beispiel (Webhook), Contract‑Vorlagen, Evidence JSON (Job Trace)
- [ ] Postman/Newman Flows: register → rule → trigger → job → outputs
- [ ] Beispiel‑Konfigurationen (ENV) & Policies

Risiken/Rollback
- Endlosschleifen: rule guards, idempotent keys, TTL
- Sicherheitsoberfläche: Strikte BRC‑31, Allowlist für Callback‑Domains, Rate‑Limits
- Complex Coordination: Rückfall auf menschliche Freigaben (action: “review”) für kritische Pfade

ENV (Vorschlag)
- AGENT_IDENTITY_REQUIRED=true|false
- RULES_MAX_CONCURRENCY=10
- JOB_RETRY_MAX=5
- JOB_BACKOFF_JSON={"baseMs":500,"factor":2,"maxMs":30000}
- CALLBACK_TIMEOUT_MS=8000
- EVIDENCE_STORE=fs|s3
- CONTRACT_TEMPLATES_DIR=./data/templates
- ACTIONS_ALLOWLIST_JSON=["notify","contract.generate","price.set","pay","publish","custom:*"]

Hinweise zur Implementierung (Scoping)
- Start mit einfachen Quellen (search/resolve) und notify/contract.generate/price.set Actions; pay/publish als optionale Schritte.
- Agent‑Webhooks zuerst synchron (HTTP) mit Timeout/Retry; später Async‑Queue erweiterbar.
- Artefakt‑Publikation als DLM1 optional (nur wenn SPV/On‑Chain Nachweis gewünscht).
- Einheitliche Evidence‑Logs (JSON) pro Job für schnelle Audits und Reproduzierbarkeit.

Wenn du möchtest, generiere ich dazu direkt Cursor‑Tasks (Scaffolding) für:
- /agents/register/search, /rules CRUD, /jobs queue,
- webhook‑Aufrufer mit BRC‑31 Signatur,
- ein Beispiel‑Agent (Node/TS) und Rule‑DSL Parser + Evaluator.


Awesome—here are the exact Cursor “Create/Update file … with content …” tasks to scaffold D24 Agent Marketplace & Automation:

You’ll get:
- /agents/register (identity-signed), /agents/search, /agents/:id/ping
- /rules CRUD (create/list/get/update/delete) and run/trigger
- In-memory + SQLite-backed jobs queue (/jobs list/status)
- Webhook caller with BRC-31 signature
- Minimal Rule DSL (JSON) parser + evaluator
- Example Agent (Node/TS) that handles notify and contract.generate

1) Update file: src/db/schema.sql
Append these tables (keep existing tables as-is):
```sql
-- Agents registry
CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  identity_key TEXT,  -- compressed pubkey hex (66), optional
  status TEXT DEFAULT 'unknown', -- 'unknown'|'up'|'down'
  last_ping_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agents_identity ON agents(identity_key);

-- Rules (DSL JSON fields)
CREATE TABLE IF NOT EXISTS rules (
  rule_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  when_json TEXT NOT NULL,  -- e.g., { "type":"ready", "predicate": { "and":[...] } }
  find_json TEXT NOT NULL,  -- e.g., { "source":"search", "query":{ q, datasetId, tag }, "limit":100 }
  actions_json TEXT NOT NULL, -- [{ action, agentId?, payload?, templateId?, ... }]
  owner_producer_id TEXT,      -- optional
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);

-- Jobs (queue)
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  target_id TEXT,            -- e.g., a versionId or datasetId
  state TEXT NOT NULL,       -- 'queued'|'running'|'done'|'failed'|'dead'
  attempts INTEGER NOT NULL DEFAULT 0,
  next_run_at INTEGER NOT NULL,
  last_error TEXT,
  evidence_json TEXT,        -- aggregate artifacts + logs
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_state_next ON jobs(state, next_run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_rule ON jobs(rule_id);
```

2) Update file: src/db/index.ts
Add agent/rule/job helpers:
```ts
 //
// Types
export type AgentRow = {
  agent_id: string;
  name: string;
  capabilities_json: string;
  webhook_url: string;
  identity_key?: string | null;
  status: 'unknown' | 'up' | 'down';
  last_ping_at?: number | null;
  created_at: number;
};

export type RuleRow = {
  rule_id: string;
  name: string;
  enabled: 0 | 1;
  when_json: string;
  find_json: string;
  actions_json: string;
  owner_producer_id?: string | null;
  created_at: number;
  updated_at: number;
};

export type JobRow = {
  job_id: string;
  rule_id: string;
  target_id?: string | null;
  state: 'queued'|'running'|'done'|'failed'|'dead';
  attempts: number;
  next_run_at: number;
  last_error?: string | null;
  evidence_json?: string | null;
  created_at: number;
  updated_at: number;
};

// Agents
export function upsertAgent(db: Database.Database, a: Partial<AgentRow>): string {
  const id = a.agent_id || ('ag_' + Math.random().toString(16).slice(2) + Date.now().toString(16));
  const now = Math.floor(Date.now()/1000);
  db.prepare(`
    INSERT INTO agents(agent_id, name, capabilities_json, webhook_url, identity_key, status, last_ping_at, created_at)
    VALUES (@agent_id, @name, @capabilities_json, @webhook_url, @identity_key, COALESCE(@status,'unknown'), @last_ping_at, @created_at)
    ON CONFLICT(agent_id) DO UPDATE SET
      name=excluded.name,
      capabilities_json=excluded.capabilities_json,
      webhook_url=excluded.webhook_url,
      identity_key=COALESCE(excluded.identity_key, agents.identity_key),
      status=COALESCE(excluded.status, agents.status),
      last_ping_at=COALESCE(excluded.last_ping_at, agents.last_ping_at)
  `).run({
    agent_id: id,
    name: a.name!,
    capabilities_json: a.capabilities_json || '[]',
    webhook_url: a.webhook_url!,
    identity_key: a.identity_key || null,
    status: a.status || 'unknown',
    last_ping_at: a.last_ping_at || null,
    created_at: a.created_at || now,
  });
  return id;
}

export function getAgent(db: Database.Database, agentId: string): AgentRow | undefined {
  return db.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId) as any;
}
export function searchAgents(db: Database.Database, q?: string, capability?: string, limit=50, offset=0): AgentRow[] {
  const where: string[] = [];
  const params: any[] = [];
  if (q) { where.push('(name LIKE ? OR webhook_url LIKE ? OR capabilities_json LIKE ?)'); params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (capability) { where.push('(capabilities_json LIKE ?)'); params.push(`%${capability}%`); }
  const sql = `
    SELECT * FROM agents
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  return db.prepare(sql).all(...params) as any[];
}
export function setAgentPing(db: Database.Database, agentId: string, up: boolean) {
  return db.prepare(`UPDATE agents SET status = ?, last_ping_at = ? WHERE agent_id = ?`)
    .run(up ? 'up':'down', Math.floor(Date.now()/1000), agentId);
}

// Rules
export function createRule(db: Database.Database, r: Partial<RuleRow>): string {
  const id = r.rule_id || ('rl_' + Math.random().toString(16).slice(2) + Date.now().toString(16));
  const now = Math.floor(Date.now()/1000);
  db.prepare(`
    INSERT INTO rules(rule_id, name, enabled, when_json, find_json, actions_json, owner_producer_id, created_at, updated_at)
    VALUES (@rule_id, @name, @enabled, @when_json, @find_json, @actions_json, @owner_producer_id, @created_at, @updated_at)
  `).run({
    rule_id: id, name: r.name!, enabled: r.enabled ?? 1,
    when_json: r.when_json!, find_json: r.find_json!, actions_json: r.actions_json!,
    owner_producer_id: r.owner_producer_id || null, created_at: now, updated_at: now,
  });
  return id;
}
export function updateRule(db: Database.Database, id: string, patch: Partial<RuleRow>) {
  const now = Math.floor(Date.now()/1000);
  db.prepare(`
    UPDATE rules SET
      name=COALESCE(@name,name),
      enabled=COALESCE(@enabled,enabled),
      when_json=COALESCE(@when_json,when_json),
      find_json=COALESCE(@find_json,find_json),
      actions_json=COALESCE(@actions_json,actions_json),
      owner_producer_id=COALESCE(@owner_producer_id,owner_producer_id),
      updated_at=@updated_at
    WHERE rule_id=@rule_id
  `).run({
    rule_id: id,
    name: patch.name, enabled: patch.enabled,
    when_json: patch.when_json, find_json: patch.find_json, actions_json: patch.actions_json,
    owner_producer_id: patch.owner_producer_id || null,
    updated_at: now
  });
}
export function getRule(db: Database.Database, id: string): RuleRow | undefined {
  return db.prepare('SELECT * FROM rules WHERE rule_id = ?').get(id) as any;
}
export function listRules(db: Database.Database, onlyEnabled?: boolean, limit=100, offset=0): RuleRow[] {
  const sql = `SELECT * FROM rules ${onlyEnabled ? 'WHERE enabled=1' : ''} ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(limit, offset) as any[];
}
export function deleteRule(db: Database.Database, id: string) {
  db.prepare('DELETE FROM rules WHERE rule_id = ?').run(id);
}

// Jobs
export function enqueueJob(db: Database.Database, j: Partial<JobRow>): string {
  const id = j.job_id || ('jb_' + Math.random().toString(16).slice(2) + Date.now().toString(16));
  const now = Math.floor(Date.now()/1000);
  db.prepare(`
    INSERT INTO jobs(job_id, rule_id, target_id, state, attempts, next_run_at, last_error, evidence_json, created_at, updated_at)
    VALUES (@job_id, @rule_id, @target_id, 'queued', 0, @next_run_at, NULL, COALESCE(@evidence_json, '[]'), @created_at, @updated_at)
  `).run({
    job_id: id, rule_id: j.rule_id!, target_id: j.target_id || null,
    next_run_at: j.next_run_at || now, evidence_json: j.evidence_json || '[]',
    created_at: now, updated_at: now
  });
  return id;
}
export function claimNextJob(db: Database.Database, nowSec = Math.floor(Date.now()/1000)): JobRow | undefined {
  const tx = db.transaction(() => {
    const row = db.prepare(`SELECT * FROM jobs WHERE state='queued' AND next_run_at <= ? ORDER BY next_run_at ASC LIMIT 1`).get(nowSec) as any;
    if (!row) return undefined;
    db.prepare(`UPDATE jobs SET state='running', updated_at=? WHERE job_id=?`).run(nowSec, row.job_id);
    return row as JobRow;
  });
  return tx() as any;
}
export function setJobResult(db: Database.Database, jobId: string, state: JobRow['state'], evidence?: any, err?: string) {
  const now = Math.floor(Date.now()/1000);
  db.prepare(`UPDATE jobs SET state=?, updated_at=?, evidence_json=COALESCE(?, evidence_json), last_error=? WHERE job_id=?`)
    .run(state, now, evidence ? JSON.stringify(evidence) : null, err || null, jobId);
}
export function bumpJobRetry(db: Database.Database, jobId: string, delaySec: number, err: string) {
  const now = Math.floor(Date.now()/1000);
  db.prepare(`UPDATE jobs SET attempts=attempts+1, state='queued', next_run_at=?, updated_at=?, last_error=? WHERE job_id=?`)
    .run(now + delaySec, now, err, jobId);
}
export function listJobs(db: Database.Database, state?: string, limit=50, offset=0): JobRow[] {
  const sql = `SELECT * FROM jobs ${state ? 'WHERE state=?' : ''} ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
  const params = state ? [state, limit, offset] : [limit, offset];
  return db.prepare(sql).all(...params) as any[];
}
```

3) Create file: src/agents/predicate.ts
A minimal JSON-DSL evaluator (ops: and/or/not, gt/gte/lt/lte/eq, includes):
```ts
type Ctx = Record<string, any>;
type Pred =
  | { and: Pred[] }
  | { or: Pred[] }
  | { not: Pred }
  | { gt: Record<string, number> }
  | { gte: Record<string, number> }
  | { lt: Record<string, number> }
  | { lte: Record<string, number> }
  | { eq: Record<string, any> }
  | { includes: Record<string, any> };

function get(ctx: Ctx, path: string): any {
  const parts = path.split('.');
  let v: any = ctx;
  for (const p of parts) v = v?.[p];
  return v;
}

export function evalPredicate(pred: any, ctx: Ctx): boolean {
  if (!pred || typeof pred !== 'object') return true;
  if ('and' in pred) return (pred.and as any[]).every(p => evalPredicate(p, ctx));
  if ('or' in pred) return (pred.or as any[]).some(p => evalPredicate(p, ctx));
  if ('not' in pred) return !evalPredicate(pred.not, ctx);
  if ('gt' in pred) return Object.entries(pred.gt).every(([k,v]) => Number(get(ctx,k)) > Number(v));
  if ('gte' in pred) return Object.entries(pred.gte).every(([k,v]) => Number(get(ctx,k)) >= Number(v));
  if ('lt' in pred) return Object.entries(pred.lt).every(([k,v]) => Number(get(ctx,k)) < Number(v));
  if ('lte' in pred) return Object.entries(pred.lte).every(([k,v]) => Number(get(ctx,k)) <= Number(v));
  if ('eq' in pred) return Object.entries(pred.eq).every(([k,v]) => get(ctx,k) === v);
  if ('includes' in pred) {
    return Object.entries(pred.includes).every(([k,v]) => {
      const val = get(ctx,k);
      if (Array.isArray(val)) return val.map(x=>String(x).toLowerCase()).includes(String(v).toLowerCase());
      if (typeof val === 'string') return val.toLowerCase().includes(String(v).toLowerCase());
      return false;
    });
  }
  return true;
}
```

4) Create file: src/agents/webhook.ts
BRC-31 signed webhook caller (secp256k1):
```ts
import { createHash } from 'crypto';
import * as secp from '@noble/secp256k1';

const CALL_PRIV_HEX = (process.env.AGENT_CALL_PRIVKEY || '').toLowerCase();
let CALL_PUB_HEX = (process.env.AGENT_CALL_PUBKEY || '').toLowerCase();

function sha256hex(s: string) {
  return createHash('sha256').update(Buffer.from(s,'utf8')).digest('hex');
}

function ensureKeys() {
  if (!CALL_PRIV_HEX) throw new Error('AGENT_CALL_PRIVKEY not set');
  if (!CALL_PUB_HEX) {
    const pub = secp.getPublicKey(Buffer.from(CALL_PRIV_HEX,'hex'), true);
    CALL_PUB_HEX = Buffer.from(pub).toString('hex');
  }
}

export async function callAgentWebhook(url: string, body: any, fetchImpl: typeof fetch = fetch, timeoutMs = 8000) {
  ensureKeys();
  const nonce = Math.random().toString(16).slice(2) + Date.now().toString(16);
  const msgHash = sha256hex(JSON.stringify(body || {}) + nonce);
  const sigDer = Buffer.from(secp.signSync(msgHash, Buffer.from(CALL_PRIV_HEX,'hex'), { der: true })).toString('hex');

  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(url, {
      method: 'POST',
      signal: ctl.signal as any,
      headers: {
        'content-type':'application/json',
        'accept':'application/json',
        'X-Identity-Key': CALL_PUB_HEX,
        'X-Nonce': nonce,
        'X-Signature': sigDer
      },
      body: JSON.stringify(body || {})
    });
    const txt = await r.text();
    let js: any; try { js = JSON.parse(txt); } catch { js = { raw: txt }; }
    return { status: r.status, body: js };
  } finally {
    clearTimeout(tm);
  }
}
```

5) Create file: src/routes/agents.ts
```ts
import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
 //import { upsertAgent, getAgent, searchAgents, setAgentPing } from '../db';
import { requireIdentity } from '../middleware/identity';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function agentsRouter(db: Database.Database): Router {
  const router = makeRouter();

  // POST /agents/register (identity-signed recommended)
  router.post('/agents/register', requireIdentity(false), (req: Request & { identityKey?: string }, res: Response) => {
    try {
      const { name, capabilities, webhookUrl, identityKey } = req.body || {};
      if (!name || !webhookUrl || !Array.isArray(capabilities)) {
        return json(res, 400, { error: 'bad-request', hint: 'name, webhookUrl, capabilities[] required' });
      }
      const agentId = upsertAgent(db, {
        name, webhook_url: webhookUrl, capabilities_json: JSON.stringify(capabilities),
        identity_key: (identityKey || req.identityKey || '').toLowerCase(),
        status: 'unknown'
      });
      return json(res, 200, { status: 'ok', agentId });
    } catch (e:any) {
      return json(res, 500, { error: 'register-failed', message: String(e?.message || e) });
    }
  });

  // GET /agents/search?q&capability
  router.get('/agents/search', (req: Request, res: Response) => {
    const q = req.query.q ? String(req.query.q) : undefined;
    const cap = req.query.capability ? String(req.query.capability) : undefined;
    const items = searchAgents(db, q, cap, 50, 0).map(a => ({
      agentId: a.agent_id, name: a.name,
      capabilities: JSON.parse(a.capabilities_json || '[]'),
      webhookUrl: a.webhook_url, status: a.status, lastPingAt: a.last_ping_at || null
    }));
    return json(res, 200, { items });
  });

  // POST /agents/:id/ping (agent calls back to prove reachability)
  router.post('/agents/:id/ping', requireIdentity(false), (req: Request & { identityKey?: string }, res: Response) => {
    const id = String(req.params.id);
    const ag = getAgent(db, id);
    if (!ag) return json(res, 404, { error: 'not-found' });
    setAgentPing(db, id, true);
    return json(res, 200, { status: 'ok' });
  });

  return router;
}
```

6) Create file: src/routes/rules.ts
```ts
import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
 //import { createRule, updateRule, getRule, listRules, deleteRule, enqueueJob } from '../db';
import { requireIdentity } from '../middleware/identity';
import { searchManifests } from '../db'; // reuse your existing search

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

// Normalize rule bodies
function toJsonOrString(v: any) {
  return typeof v === 'string' ? v : JSON.stringify(v ?? {});
}

export function rulesRouter(db: Database.Database): Router {
  const router = makeRouter();

  // POST /rules (create)
  router.post('/rules', requireIdentity(false), (req: Request, res: Response) => {
    try {
      const { name, enabled=true, when, find, actions } = req.body || {};
      if (!name || !when || !find || !Array.isArray(actions)) {
        return json(res, 400, { error: 'bad-request', hint: 'name, when, find, actions[] required' });
      }
      const id = createRule(db, {
        name, enabled: enabled ? 1 : 0,
        when_json: toJsonOrString(when),
        find_json: toJsonOrString(find),
        actions_json: toJsonOrString(actions)
      });
      return json(res, 200, { status: 'ok', ruleId: id });
    } catch (e:any) {
      return json(res, 500, { error: 'create-rule-failed', message: String(e?.message || e) });
    }
  });

  // GET /rules
  router.get('/rules', (req: Request, res: Response) => {
    const enabledOnly = /^true$/i.test(String(req.query.enabled || 'false'));
    const items = listRules(db, enabledOnly, 100, 0).map(r => ({
      ruleId: r.rule_id, name: r.name, enabled: !!r.enabled,
      when: JSON.parse(r.when_json), find: JSON.parse(r.find_json), actions: JSON.parse(r.actions_json),
      updatedAt: r.updated_at
    }));
    return json(res, 200, { items });
  });

  // GET /rules/:id
  router.get('/rules/:id', (req: Request, res: Response) => {
    const r = getRule(db, String(req.params.id));
    if (!r) return json(res, 404, { error: 'not-found' });
    return json(res, 200, {
      ruleId: r.rule_id, name: r.name, enabled: !!r.enabled,
      when: JSON.parse(r.when_json), find: JSON.parse(r.find_json), actions: JSON.parse(r.actions_json),
      updatedAt: r.updated_at
    });
  });

  // PATCH /rules/:id (enable/disable/update)
  router.patch('/rules/:id', requireIdentity(false), (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const r = getRule(db, id);
      if (!r) return json(res, 404, { error: 'not-found' });
      const patch: any = {};
      if (typeof req.body?.name === 'string') patch.name = req.body.name;
      if (typeof req.body?.enabled !== 'undefined') patch.enabled = req.body.enabled ? 1 : 0;
      if (req.body?.when) patch.when_json = toJsonOrString(req.body.when);
      if (req.body?.find) patch.find_json = toJsonOrString(req.body.find);
      if (req.body?.actions) patch.actions_json = toJsonOrString(req.body.actions);
      updateRule(db, id, patch);
      return json(res, 200, { status: 'ok' });
    } catch (e:any) {
      return json(res, 500, { error: 'update-rule-failed', message: String(e?.message || e) });
    }
  });

  // DELETE /rules/:id
  router.delete('/rules/:id', requireIdentity(false), (req: Request, res: Response) => {
    deleteRule(db, String(req.params.id));
    return json(res, 200, { status: 'ok' });
  });

  // POST /rules/:id/run (manual trigger => enqueue jobs for found items)
  router.post('/rules/:id/run', requireIdentity(false), (req: Request, res: Response) => {
    try {
      const r = getRule(db, String(req.params.id));
      if (!r) return json(res, 404, { error: 'not-found' });
      const find = JSON.parse(r.find_json || '{}');
      const q = find?.query || {};
      const limit = Number(find?.limit || 50);
      const rows = searchManifests(db, { q: q.q, datasetId: q.datasetId, limit, offset: 0 });

      let count = 0;
      for (const m of rows) {
        // target_id = versionId (manifest_hash equals versionId in your system)
        enqueueJob(db, { rule_id: r.rule_id, target_id: m.version_id });
        count++;
      }
      return json(res, 200, { status: 'ok', enqueued: count });
    } catch (e:any) {
      return json(res, 500, { error: 'run-rule-failed', message: String(e?.message || e) });
    }
  });

  return router;
}
```

7) Create file: src/routes/jobs.ts
```ts
import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
 //import { listJobs } from '../db';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function jobsRouter(db: Database.Database): Router {
  const router = makeRouter();

  // GET /jobs?state=queued|running|done|failed|dead
  router.get('/jobs', (req: Request, res: Response) => {
    const state = req.query.state ? String(req.query.state) : undefined;
    const items = listJobs(db, state, 100, 0);
    return json(res, 200, { items });
  });

  return router;
}
```

8) Create file: src/agents/worker.ts
A simple in-process worker that executes jobs and calls agent webhooks:
```ts
 //import { claimNextJob, setJobResult, bumpJobRetry, getRule, getAgent } from '../db';
import { callAgentWebhook } from './webhook';
import { evalPredicate } from './predicate';

// Minimal evaluator context builder: load manifest details when needed (skipped here for brevity)

const RETRY_MAX = Number(process.env.JOB_RETRY_MAX || 5);
const BACKOFF_BASE = 500;
const BACKOFF_FACTOR = 2;

export function startJobsWorker(db: Database.Database) {
  async function processOne() {
    const job = claimNextJob(db);
    if (!job) return;

    try {
      const rule = getRule(db, job.rule_id);
      if (!rule) throw new Error('rule-not-found');

      const actions = JSON.parse(rule.actions_json || '[]') as any[];
      const evidence: any[] = [];
      for (const act of actions) {
        if (act.action === 'notify') {
          const agent = getAgent(db, String(act.agentId || ''));
          if (!agent) throw new Error('agent-not-found');
          const payload = act.payload || { targetId: job.target_id, ruleId: job.rule_id };
          const r = await callAgentWebhook(agent.webhook_url, { type:'notify', payload });
          evidence.push({ action:'notify', agentId: agent.agent_id, status: r.status, body: r.body });
          if (r.status >= 300) throw new Error('agent-notify-failed');
        } else if (act.action === 'contract.generate') {
          // In a real system you'd call an agent or template service. Here we simulate.
          const artifact = { type:'contract/pdf', url:`/contracts/${job.job_id}.pdf`, hash:'deadbeef' };
          evidence.push({ action:'contract.generate', artifact });
        } else if (act.action === 'price.set') {
          // You can call your own /price endpoints internally here; skipped to keep worker small.
          evidence.push({ action:'price.set', versionId: act.versionId, satoshis: act.satoshis });
        } else if (act.action === 'pay') {
          evidence.push({ action:'pay', versionId: act.versionId, quantity: act.quantity });
        } else if (act.action === 'publish') {
          evidence.push({ action:'publish', note:'not implemented in worker scaffold' });
        } else {
          evidence.push({ action: act.action, note: 'unknown action (skipped)' });
        }
      }

      setJobResult(db, job.job_id, 'done', evidence, undefined);
    } catch (e:any) {
      const row = (e?.message || 'error');
      if (job.attempts + 1 >= RETRY_MAX) {
        setJobResult(db, job.job_id, 'dead', undefined, row);
      } else {
        const delay = BACKOFF_BASE * Math.pow(BACKOFF_FACTOR, job.attempts);
        bumpJobRetry(db, job.job_id, Math.min(30_000/1000, Math.floor(delay/1000)), row);
      }
    }
  }

  setInterval(() => {
    processOne().catch(()=>{});
  }, 500);
}
```

9) Update file: server.ts
Mount the new routers and start the worker:
```ts
import express from 'express';
import { openDb, initSchema } from './src/db';
import { agentsRouter } from './src/routes/agents';
import { rulesRouter } from './src/routes/rules';
import { jobsRouter } from './src/routes/jobs';
import { startJobsWorker } from './src/agents/worker';

// ... existing imports and setup ...

async function main() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const db = openDb();
  initSchema(db);

  // Mount agent marketplace routes
  app.use(agentsRouter(db));
  app.use(rulesRouter(db));
  app.use(jobsRouter(db));

  // Start in-process worker
  startJobsWorker(db);

  // ... keep existing route mounts (submit, bundle, ready, price, pay, data, listings, producers, advisories, metrics, etc.)

  const PORT = Number(process.env.OVERLAY_PORT || 8788);
  app.listen(PORT, () => console.log(`Overlay listening on :${PORT}`));
}
main().catch(e => { console.error(e); process.exit(1); });
```

10) Create file: examples/agent-example.ts
Minimal agent server (Node/TS) that accepts signed webhooks:
```ts
import express from 'express';

const PORT = Number(process.env.AGENT_PORT || 9099);

const app = express();
app.use(express.json({ limit: '1mb' }));

// Example webhook (verify BRC-31 headers upstream if desired)
app.post('/webhook', (req, res) => {
  const { type, payload } = req.body || {};
  if (type === 'notify') {
    console.log('[agent] notify', payload);
    return res.status(200).json({ ok: true });
  }
  if (type === 'contract' || type === 'contract.generate') {
    const artifact = { type:'contract/pdf', url:`https://example.com/contracts/${Date.now()}.pdf`, hash:'cafebabe' };
    return res.status(200).json({ ok: true, artifacts:[artifact] });
  }
  return res.status(200).json({ ok: true, echo: { type, payload } });
});

app.listen(PORT, () => console.log(`Example Agent listening on :${PORT}`));
```

11) Add dependency for noble secp256k1 if not already present
Update file: package.json
```json
{
  "dependencies": {
    "@noble/secp256k1": "^2.1.0"
  },
  "scripts": {
    "agent:example": "ts-node examples/agent-example.ts"
  }
}
```

Environment knobs (document in README/ENV):
- AGENT_CALL_PRIVKEY=hex private key for webhook signing
- AGENT_CALL_PUBKEY=derived compressed pubkey hex (optional; computed from priv)
- JOB_RETRY_MAX=5
- RULES_MAX_CONCURRENCY (future)
- CALLBACK_TIMEOUT_MS=8000

How to try quickly
- Start overlay (server.ts)
- Start example agent: npm run agent:example (gets /webhook)
- Register agent:
  curl -X POST http://localhost:8788/agents/register -H 'content-type: application/json' -d '{"name":"DemoAgent","capabilities":[{"name":"notify"}],"webhookUrl":"http://localhost:9099/webhook"}'
- Create a simple rule:
  curl -X POST http://localhost:8788/rules -H 'content-type: application/json' -d '{"name":"demo","when":{"type":"ready","predicate":{"eq":{"always":true}}},"find":{"source":"search","query":{"q":""},"limit":5},"actions":[{"action":"notify","agentId":"<agentId>"}]}'
- Trigger it:
  curl -X POST http://localhost:8788/rules/<ruleId>/run
- Observe: /jobs shows queued → running → done, and agent logs.

This scaffold is intentionally minimal and safe:
- Identity on agent register is optional but supported (plug your existing requireIdentity(true) if you want strictness).
- Rule predicate evaluator is sandboxed (no string eval).
- The worker retries with exponential backoff and DLQ behavior; evidence logs are aggregated per job.

If you want, I can follow up with Postman/Newman entries and tests for this agent marketplace to validate end-to-end.
