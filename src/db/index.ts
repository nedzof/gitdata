import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type DeclarationRow = {
  version_id: string;
  txid: string | null;
  type: 'DLM1' | 'TRN1' | 'UNKNOWN';
  status: 'pending' | 'confirmed';
  created_at: number;
  block_hash: string | null;
  height: number | null;
  opret_vout: number | null;
  raw_tx: string | null;
  proof_json: string | null;
};

export type ManifestRow = {
  version_id: string;
  manifest_hash: string;
  content_hash: string | null;
  title: string | null;
  license: string | null;
  classification: string | null;
  created_at: string | null;
  manifest_json: string;
  dataset_id?: string | null;
  producer_id?: string | null;
};

export type ProducerRow = {
  producer_id: string;
  name: string | null;
  website: string | null;
  identity_key: string | null;
  created_at: number;
};

export type ReceiptRow = {
  receipt_id: string;
  version_id: string;
  quantity: number;
  content_hash: string | null;
  amount_sat: number;
  status: 'pending' | 'paid' | 'consumed' | 'expired';
  created_at: number;
  expires_at: number;
  bytes_used: number;
  last_seen: number | null;
};

export type RevenueEventRow = {
  event_id?: number;
  receipt_id: string;
  version_id: string;
  amount_sat: number;
  quantity: number;
  created_at: number;
  type: 'pay' | 'refund' | 'adjust';
};

export type PriceRule = {
  rule_id?: number;
  version_id?: string | null;
  producer_id?: string | null;
  tier_from: number;
  satoshis: number;
  created_at: number;
  updated_at: number;
};

export type AdvisoryRow = {
  advisory_id: string;
  type: 'BLOCK' | 'WARN';
  reason: string;
  created_at: number;
  expires_at: number | null;
  payload_json: string | null;
};

// D24: Agent Marketplace Types
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

export function openDb(dbPath = process.env.DB_PATH || './data/overlay.db') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function initSchema(db: Database.Database, schemaFile = 'src/db/schema.sql') {
  const sql = fs.readFileSync(schemaFile, 'utf8');
  db.exec(sql);
}

/* Declarations */
export function upsertDeclaration(db: Database.Database, row: Partial<DeclarationRow>) {
  // Insert or update by version_id (if provided) else by txid
  if (row.version_id) {
    const ins = db.prepare(`
      INSERT INTO declarations(version_id, txid, type, status, created_at, block_hash, height, opret_vout, raw_tx, proof_json)
      VALUES (@version_id, @txid, @type, COALESCE(@status,'pending'), COALESCE(@created_at,CAST(strftime('%s','now') AS INTEGER)), @block_hash, @height, @opret_vout, @raw_tx, @proof_json)
      ON CONFLICT(version_id) DO UPDATE SET
        txid=COALESCE(excluded.txid, declarations.txid),
        type=COALESCE(excluded.type, declarations.type),
        status=COALESCE(excluded.status, declarations.status),
        block_hash=COALESCE(excluded.block_hash, declarations.block_hash),
        height=COALESCE(excluded.height, declarations.height),
        opret_vout=COALESCE(excluded.opret_vout, declarations.opret_vout),
        raw_tx=COALESCE(excluded.raw_tx, declarations.raw_tx),
        proof_json=COALESCE(excluded.proof_json, declarations.proof_json)
    `);
    ins.run(row as any);
  } else if (row.txid) {
    const existing = db.prepare('SELECT version_id FROM declarations WHERE txid = ?').get(row.txid) as any;
    const vid = existing?.version_id || null;
    const ins = db.prepare(`
      INSERT INTO declarations(version_id, txid, type, status, created_at, block_hash, height, opret_vout, raw_tx, proof_json)
      VALUES (@version_id, @txid, @type, COALESCE(@status,'pending'), COALESCE(@created_at,CAST(strftime('%s','now') AS INTEGER)), @block_hash, @height, @opret_vout, @raw_tx, @proof_json)
      ON CONFLICT(version_id) DO UPDATE SET
        txid=COALESCE(excluded.txid, declarations.txid),
        type=COALESCE(excluded.type, declarations.type),
        status=COALESCE(excluded.status, declarations.status),
        block_hash=COALESCE(excluded.block_hash, declarations.block_hash),
        height=COALESCE(excluded.height, declarations.height),
        opret_vout=COALESCE(excluded.opret_vout, declarations.opret_vout),
        raw_tx=COALESCE(excluded.raw_tx, declarations.raw_tx),
        proof_json=COALESCE(excluded.proof_json, declarations.proof_json)
    `);
    ins.run({ ...row, version_id: vid } as any);
  } else {
    throw new Error('upsertDeclaration requires version_id or txid');
  }
}

export function getDeclarationByVersion(db: Database.Database, versionId: string): DeclarationRow | undefined {
  return db.prepare('SELECT * FROM declarations WHERE version_id = ?').get(versionId) as any;
}
export function getDeclarationByTxid(db: Database.Database, txid: string): DeclarationRow | undefined {
  return db.prepare('SELECT * FROM declarations WHERE txid = ?').get(txid) as any;
}
export function setOpretVout(db: Database.Database, versionId: string, vout: number) {
  db.prepare('UPDATE declarations SET opret_vout = ? WHERE version_id = ?').run(vout, versionId);
}
export function setProofEnvelope(db: Database.Database, versionId: string, envelopeJson: string) {
  db.prepare('UPDATE declarations SET proof_json = ? WHERE version_id = ?').run(envelopeJson, versionId);
}

/* Manifests */
export function upsertManifest(db: Database.Database, row: Partial<ManifestRow>) {
  const stmt = db.prepare(`
    INSERT INTO manifests(version_id, manifest_hash, content_hash, title, license, classification, created_at, manifest_json, dataset_id, producer_id)
    VALUES (@version_id, @manifest_hash, @content_hash, @title, @license, @classification, @created_at, @manifest_json, @dataset_id, @producer_id)
    ON CONFLICT(version_id) DO UPDATE SET
      manifest_hash=excluded.manifest_hash,
      content_hash=excluded.content_hash,
      title=excluded.title,
      license=excluded.license,
      classification=excluded.classification,
      created_at=excluded.created_at,
      manifest_json=excluded.manifest_json,
      dataset_id=COALESCE(excluded.dataset_id, manifests.dataset_id),
      producer_id=COALESCE(excluded.producer_id, manifests.producer_id)
  `);
  stmt.run({
    ...row,
    dataset_id: row.dataset_id ?? null,
    producer_id: row.producer_id ?? null
  } as any);
}

export function createManifest(db: Database.Database, manifest: {
  version_id: string;
  dataset_id?: string;
  manifest_json: string;
  manifest_hash?: string;
  content_hash?: string;
  title?: string;
  license?: string;
  classification?: string;
  created_at?: string;
  producer_id?: string;
}): void {
  const stmt = db.prepare(`
    INSERT INTO manifests (
      version_id, manifest_hash, content_hash, title, license,
      classification, created_at, manifest_json, dataset_id, producer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    manifest.version_id,
    manifest.manifest_hash || 'unknown',
    manifest.content_hash || null,
    manifest.title || null,
    manifest.license || null,
    manifest.classification || null,
    manifest.created_at || new Date().toISOString(),
    manifest.manifest_json,
    manifest.dataset_id || null,
    manifest.producer_id || null
  );
}

export function getManifest(db: Database.Database, versionId: string): ManifestRow | undefined {
  return db.prepare('SELECT * FROM manifests WHERE version_id = ?').get(versionId) as any;
}

export function searchManifests(db: Database.Database, opts: {
  q?: string;
  datasetId?: string;
  limit?: number;
}): ManifestRow[] {
  let sql = 'SELECT * FROM manifests WHERE 1=1';
  const params: any[] = [];

  if (opts.q) {
    sql += ' AND (dataset_id LIKE ? OR version_id LIKE ? OR manifest_json LIKE ?)';
    const searchTerm = `%${opts.q}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (opts.datasetId) {
    sql += ' AND dataset_id = ?';
    params.push(opts.datasetId);
  }

  sql += ' ORDER BY created_at DESC';

  if (opts.limit && opts.limit > 0) {
    sql += ' LIMIT ?';
    params.push(opts.limit);
  }

  return db.prepare(sql).all(...params) as ManifestRow[];
}

/* Producers */
export function upsertProducer(db: Database.Database, p: { identity_key?: string | null; name?: string | null; website?: string | null }): string {
  // If identity_key present and exists, reuse producer_id. Else create a new one.
  let existing: ProducerRow | undefined;
  if (p.identity_key) {
    existing = db.prepare('SELECT * FROM producers WHERE identity_key = ?').get(String(p.identity_key).toLowerCase()) as any;
  }
  if (existing) {
    // Optionally update name/website if provided
    db.prepare('UPDATE producers SET name = COALESCE(?, name), website = COALESCE(?, website) WHERE producer_id = ?')
      .run(p.name ?? null, p.website ?? null, existing.producer_id);
    return existing.producer_id;
  }
  const producer_id = 'pr_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  db.prepare(`
    INSERT INTO producers(producer_id, name, website, identity_key, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(producer_id, p.name ?? null, p.website ?? null, p.identity_key ? String(p.identity_key).toLowerCase() : null, Math.floor(Date.now()/1000));
  return producer_id;
}

export function getProducerById(db: Database.Database, producerId: string): ProducerRow | undefined {
  return db.prepare('SELECT * FROM producers WHERE producer_id = ?').get(producerId) as any;
}

export function getProducerByDatasetId(db: Database.Database, datasetId: string): ProducerRow | undefined {
  // Resolve latest manifest for datasetId and join to producers
  const row = db.prepare(`
    SELECT p.* FROM manifests m
    JOIN producers p ON p.producer_id = m.producer_id
    WHERE m.dataset_id = ?
    ORDER BY m.created_at DESC NULLS LAST
    LIMIT 1
  `).get(datasetId) as any;
  return row as ProducerRow | undefined;
}

/* Lineage edges */
export function replaceEdges(db: Database.Database, child: string, parents: string[]) {
  const del = db.prepare('DELETE FROM edges WHERE child_version_id = ?');
  del.run(child);
  if (parents.length === 0) return;
  const ins = db.prepare('INSERT OR IGNORE INTO edges(child_version_id, parent_version_id) VALUES (?, ?)');
  const tx = db.transaction((ps: string[]) => { for (const p of ps) ins.run(child, p); });
  tx(parents);
}
export function getParents(db: Database.Database, child: string): string[] {
  return db.prepare('SELECT parent_version_id AS p FROM edges WHERE child_version_id = ?').all(child).map((r: any) => r.p);
}

/* Prices */
export function setPrice(db: Database.Database, versionId: string, satoshis: number) {
  db.prepare(`
    INSERT INTO prices(version_id, satoshis) VALUES (?, ?)
    ON CONFLICT(version_id) DO UPDATE SET satoshis = excluded.satoshis
  `).run(versionId, satoshis);
}
export function getPrice(db: Database.Database, versionId: string): number | undefined {
  const row = db.prepare('SELECT satoshis FROM prices WHERE version_id = ?').get(versionId) as any;
  return row?.satoshis;
}

/* Listing helpers */
export function listListings(db: Database.Database, limit = 50, offset = 0) {
  const sql = `
    SELECT
      m.version_id,
      m.title,
      m.license,
      m.classification,
      m.content_hash,
      m.dataset_id,
      p.name AS producer_name,
      p.website AS producer_website,
      d.txid,
      d.status,
      d.created_at
    FROM manifests m
    LEFT JOIN declarations d ON d.version_id = m.version_id
    LEFT JOIN producers p ON p.producer_id = m.producer_id
    ORDER BY d.created_at DESC
    LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(limit, offset) as any[];
}

/* Receipts */
export function insertReceipt(db: Database.Database, row: Omit<ReceiptRow, 'bytes_used' | 'last_seen'> & Partial<Pick<ReceiptRow, 'bytes_used' | 'last_seen'>>) {
  const stmt = db.prepare(`
    INSERT INTO receipts(receipt_id, version_id, quantity, content_hash, amount_sat, status, created_at, expires_at, bytes_used, last_seen)
    VALUES (@receipt_id, @version_id, @quantity, @content_hash, @amount_sat, @status, @created_at, @expires_at, COALESCE(@bytes_used,0), @last_seen)
  `);
  stmt.run(row as any);
}

export function getReceipt(db: Database.Database, receiptId: string): ReceiptRow | undefined {
  return db.prepare('SELECT * FROM receipts WHERE receipt_id = ?').get(receiptId) as any;
}

export function setReceiptStatus(
  db: Database.Database,
  receiptId: string,
  status: ReceiptRow['status'],
) {
  db.prepare('UPDATE receipts SET status = ?, last_seen = ? WHERE receipt_id = ?').run(status, Math.floor(Date.now()/1000), receiptId);
}

export function updateReceiptUsage(
  db: Database.Database,
  receiptId: string,
  addBytes: number,
) {
  const now = Math.floor(Date.now() / 1000);
  const tx = db.transaction(() => {
    const r = getReceipt(db, receiptId);
    if (!r) throw new Error('receipt-not-found');
    const newBytes = (r.bytes_used || 0) + addBytes;
    db.prepare('UPDATE receipts SET bytes_used = ?, last_seen = ? WHERE receipt_id = ?')
      .run(newBytes, now, receiptId);
  });
  tx();
}

/* Revenue log */
export function logRevenue(db: Database.Database, ev: RevenueEventRow) {
  const stmt = db.prepare(`
    INSERT INTO revenue_events(receipt_id, version_id, amount_sat, quantity, created_at, type)
    VALUES (@receipt_id, @version_id, @amount_sat, @quantity, @created_at, @type)
  `);
  stmt.run(ev as any);
}

/* Producers + Manifests (from D08) */
export function getProducerIdForVersion(db: Database.Database, versionId: string): string | null {
  const r = db.prepare('SELECT producer_id FROM manifests WHERE version_id = ?').get(versionId) as any;
  return r?.producer_id || null;
}

/* Price rules (D09) */
export function upsertPriceRule(db: Database.Database, rule: { version_id?: string | null; producer_id?: string | null; tier_from: number; satoshis: number }) {
  const now = Math.floor(Date.now() / 1000);
  const { version_id = null, producer_id = null, tier_from, satoshis } = rule;
  if (!version_id && !producer_id) throw new Error('scope-required');
  if (tier_from < 1 || !Number.isInteger(tier_from)) throw new Error('invalid-tier');
  if (!Number.isInteger(satoshis) || satoshis <= 0) throw new Error('invalid-satoshis');

  if (version_id) {
    db.prepare(`
      INSERT INTO price_rules(version_id, producer_id, tier_from, satoshis, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?)
      ON CONFLICT(version_id, tier_from) DO UPDATE SET
        satoshis = excluded.satoshis,
        updated_at = excluded.updated_at
    `).run(version_id.toLowerCase(), tier_from, satoshis, now, now);
    return;
  }
  if (producer_id) {
    db.prepare(`
      INSERT INTO price_rules(version_id, producer_id, tier_from, satoshis, created_at, updated_at)
      VALUES (NULL, ?, ?, ?, ?, ?)
      ON CONFLICT(producer_id, tier_from) DO UPDATE SET
        satoshis = excluded.satoshis,
        updated_at = excluded.updated_at
    `).run(producer_id, tier_from, satoshis, now, now);
  }
}

export function deletePriceRule(db: Database.Database, where: { version_id?: string | null; producer_id?: string | null; tier_from?: number | null }) {
  const { version_id = null, producer_id = null, tier_from = null } = where;
  if (!version_id && !producer_id) throw new Error('scope-required');
  if (version_id) {
    if (tier_from) {
      db.prepare('DELETE FROM price_rules WHERE version_id = ? AND tier_from = ?').run(version_id.toLowerCase(), tier_from);
    } else {
      db.prepare('DELETE FROM price_rules WHERE version_id = ?').run(version_id.toLowerCase());
    }
    return;
  }
  if (producer_id) {
    if (tier_from) {
      db.prepare('DELETE FROM price_rules WHERE producer_id = ? AND tier_from = ?').run(producer_id, tier_from);
    } else {
      db.prepare('DELETE FROM price_rules WHERE producer_id = ?').run(producer_id);
    }
  }
}

/**
 * Resolve best-matching unit price for (versionId, quantity)
 * Priority:
 *   1) Version-scoped rules: highest tier_from <= quantity
 *   2) Version override (prices table)
 *   3) Producer-scoped rules: highest tier_from <= quantity (via manifests.producer_id)
 *   4) Default PRICE_DEFAULT_SATS
 */
export function getBestUnitPrice(
  db: Database.Database,
  versionId: string,
  quantity: number,
  defaultSats: number,
): { satoshis: number; source: 'version-rule' | 'version-override' | 'producer-rule' | 'default'; tier_from?: number; producer_id?: string | null } {
  const qty = Math.max(1, Math.floor(quantity || 1));
  const vid = versionId.toLowerCase();

  // 1) Version-scoped rules
  const vRule = db.prepare(`
    SELECT tier_from, satoshis FROM price_rules
    WHERE version_id = ? AND tier_from <= ?
    ORDER BY tier_from DESC
    LIMIT 1
  `).get(vid, qty) as any;
  if (vRule?.satoshis) {
    return { satoshis: Number(vRule.satoshis), source: 'version-rule', tier_from: Number(vRule.tier_from) };
  }

  // 2) Version override (D05)
  const vOverride = getPrice(db, vid);
  if (typeof vOverride === 'number') {
    return { satoshis: vOverride, source: 'version-override' };
  }

  // 3) Producer-scoped rules
  const pid = getProducerIdForVersion(db, vid);
  if (pid) {
    const pRule = db.prepare(`
      SELECT tier_from, satoshis FROM price_rules
      WHERE producer_id = ? AND tier_from <= ?
      ORDER BY tier_from DESC
      LIMIT 1
    `).get(pid, qty) as any;
    if (pRule?.satoshis) {
      return { satoshis: Number(pRule.satoshis), source: 'producer-rule', tier_from: Number(pRule.tier_from), producer_id: pid };
    }
  }

  // 4) Default
  return { satoshis: defaultSats, source: 'default' };
}

/* Advisory functions (D10) */
export function insertAdvisory(db: Database.Database, adv: AdvisoryRow) {
  const stmt = db.prepare(`
    INSERT INTO advisories(advisory_id, type, reason, created_at, expires_at, payload_json)
    VALUES (@advisory_id, @type, @reason, @created_at, @expires_at, @payload_json)
  `);
  stmt.run(adv as any);
}

export function insertAdvisoryTargets(
  db: Database.Database,
  advisoryId: string,
  targets: { version_id?: string | null; producer_id?: string | null }[],
) {
  const ins = db.prepare(`INSERT OR IGNORE INTO advisory_targets(advisory_id, version_id, producer_id) VALUES (?, ?, ?)`);
  const tx = db.transaction((list: { version_id?: string | null; producer_id?: string | null }[]) => {
    for (const t of list) ins.run(advisoryId, t.version_id ?? null, t.producer_id ?? null);
  });
  tx(targets);
}

export function listAdvisoriesForVersionActive(
  db: Database.Database,
  versionId: string,
  nowUnix: number,
): AdvisoryRow[] {
  // Active = expires_at IS NULL OR expires_at >= now
  // Matches if advisory_targets has version_id == versionId
  const rows = db.prepare(`
    SELECT a.*
    FROM advisory_targets t
    JOIN advisories a ON a.advisory_id = t.advisory_id
    WHERE t.version_id = ?
      AND (a.expires_at IS NULL OR a.expires_at >= ?)
  `).all(versionId.toLowerCase(), nowUnix) as any[];
  return rows as AdvisoryRow[];
}

export function listAdvisoriesForProducerActive(
  db: Database.Database,
  producerId: string,
  nowUnix: number,
): AdvisoryRow[] {
  const rows = db.prepare(`
    SELECT a.*
    FROM advisory_targets t
    JOIN advisories a ON a.advisory_id = t.advisory_id
    WHERE t.producer_id = ?
      AND (a.expires_at IS NULL OR a.expires_at >= ?)
  `).all(producerId, nowUnix) as any[];
  return rows as AdvisoryRow[];
}

/* D24: Agent Marketplace Functions */

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

// D18: Search and Resolve functionality
export type SearchItem = {
  version_id: string;
  dataset_id: string | null;
  title: string | null;
  license: string | null;
  classification: string | null;
  content_hash: string | null;
  created_at: string | null;
  manifest_json: string;
};

/**
 * listVersionsByDataset:
 * - returns versions for a datasetId, sorted newest-first
 */
export function listVersionsByDataset(
  db: Database.Database,
  datasetId: string,
  limit: number,
  offset: number,
): { version_id: string; created_at: string | null; content_hash: string | null }[] {
  const sql = `
    SELECT version_id, created_at, content_hash
    FROM manifests
    WHERE dataset_id = ?
    ORDER BY COALESCE(created_at, '') DESC
    LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(datasetId, limit, offset) as any[];
}

// Contract Templates
export type ContractTemplateRow = {
  template_id: string;
  name: string;
  description?: string | null;
  template_content: string;
  template_type: 'pdf' | 'markdown' | 'html' | 'json';
  variables_json?: string | null;
  owner_producer_id?: string | null;
  created_at: number;
  updated_at: number;
};

export function createTemplate(db: Database.Database, t: Partial<ContractTemplateRow>): string {
  const id = t.template_id || ('tpl_' + Math.random().toString(16).slice(2) + Date.now().toString(16));
  const now = Math.floor(Date.now()/1000);
  db.prepare(`
    INSERT INTO contract_templates(template_id, name, description, template_content, template_type, variables_json, owner_producer_id, created_at, updated_at)
    VALUES (@template_id, @name, @description, @template_content, @template_type, @variables_json, @owner_producer_id, @created_at, @updated_at)
  `).run({
    template_id: id,
    name: t.name!,
    description: t.description || null,
    template_content: t.template_content!,
    template_type: t.template_type || 'pdf',
    variables_json: t.variables_json || null,
    owner_producer_id: t.owner_producer_id || null,
    created_at: now,
    updated_at: now,
  });
  return id;
}

export function getTemplate(db: Database.Database, templateId: string): ContractTemplateRow | undefined {
  return db.prepare('SELECT * FROM contract_templates WHERE template_id = ?').get(templateId) as any;
}

export function listTemplates(db: Database.Database, ownerId?: string, limit=50, offset=0): ContractTemplateRow[] {
  const sql = `
    SELECT * FROM contract_templates
    ${ownerId ? 'WHERE owner_producer_id = ?' : ''}
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?`;
  const params = ownerId ? [ownerId, limit, offset] : [limit, offset];
  return db.prepare(sql).all(...params) as any[];
}

export function updateTemplate(db: Database.Database, id: string, patch: Partial<ContractTemplateRow>) {
  const now = Math.floor(Date.now()/1000);
  db.prepare(`
    UPDATE contract_templates SET
      name=COALESCE(@name,name),
      description=COALESCE(@description,description),
      template_content=COALESCE(@template_content,template_content),
      template_type=COALESCE(@template_type,template_type),
      variables_json=COALESCE(@variables_json,variables_json),
      updated_at=@updated_at
    WHERE template_id=@template_id
  `).run({
    template_id: id,
    name: patch.name,
    description: patch.description,
    template_content: patch.template_content,
    template_type: patch.template_type,
    variables_json: patch.variables_json,
    updated_at: now
  });
}

export function deleteTemplate(db: Database.Database, id: string) {
  db.prepare('DELETE FROM contract_templates WHERE template_id = ?').run(id);
}

// Artifacts
export type ArtifactRow = {
  artifact_id: string;
  job_id: string;
  artifact_type: string;
  content_hash: string;
  file_path?: string | null;
  content_data?: Buffer | null;
  version_id?: string | null;
  metadata_json?: string | null;
  created_at: number;
  published_at?: number | null;
};

export function createArtifact(db: Database.Database, a: Partial<ArtifactRow>): string {
  const id = a.artifact_id || ('art_' + Math.random().toString(16).slice(2) + Date.now().toString(16));
  const now = Math.floor(Date.now()/1000);

  db.prepare(`
    INSERT INTO artifacts(artifact_id, job_id, artifact_type, content_hash, file_path, content_data, version_id, metadata_json, created_at, published_at)
    VALUES (@artifact_id, @job_id, @artifact_type, @content_hash, @file_path, @content_data, @version_id, @metadata_json, @created_at, @published_at)
  `).run({
    artifact_id: id,
    job_id: a.job_id!,
    artifact_type: a.artifact_type!,
    content_hash: a.content_hash!,
    file_path: a.file_path || null,
    content_data: a.content_data || null,
    version_id: a.version_id || null,
    metadata_json: a.metadata_json || null,
    created_at: now,
    published_at: a.published_at || null,
  });
  return id;
}

export function getArtifact(db: Database.Database, artifactId: string): ArtifactRow | undefined {
  return db.prepare('SELECT * FROM artifacts WHERE artifact_id = ?').get(artifactId) as any;
}

export function getArtifactsByJob(db: Database.Database, jobId: string): ArtifactRow[] {
  return db.prepare('SELECT * FROM artifacts WHERE job_id = ? ORDER BY created_at DESC').all(jobId) as any[];
}

export function updateArtifactVersion(db: Database.Database, artifactId: string, versionId: string) {
  const now = Math.floor(Date.now()/1000);
  db.prepare('UPDATE artifacts SET version_id = ?, published_at = ? WHERE artifact_id = ?')
    .run(versionId, now, artifactId);
}

export function listArtifacts(db: Database.Database, options: {
  type?: string;
  jobId?: string;
  published?: boolean;
  limit?: number;
  offset?: number;
} = {}): ArtifactRow[] {
  const { type, jobId, published, limit = 100, offset = 0 } = options;

  const conditions: string[] = [];
  const params: any[] = [];

  if (type) {
    conditions.push('artifact_type = ?');
    params.push(type);
  }

  if (jobId) {
    conditions.push('job_id = ?');
    params.push(jobId);
  }

  if (published !== undefined) {
    if (published) {
      conditions.push('version_id IS NOT NULL');
    } else {
      conditions.push('version_id IS NULL');
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM artifacts
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);
  return db.prepare(sql).all(...params) as any[];
}

// D38: OpenLineage Types and Functions

export type OpenLineageEvent = {
  eventType: 'START' | 'COMPLETE' | 'ABORT';
  eventTime: string; // ISO UTC
  producer: string;
  job: {
    namespace: string;
    name: string;
    facets?: Record<string, any>;
  };
  run: {
    runId: string;
    facets?: Record<string, any>;
  };
  inputs?: Array<{
    namespace: string;
    name: string;
    facets?: Record<string, any>;
  }>;
  outputs?: Array<{
    namespace: string;
    name: string;
    facets?: Record<string, any>;
  }>;
};

export type OLEventRow = {
  event_id: string;
  event_time: string;
  namespace: string;
  job_name: string;
  run_id: string;
  event_type: string;
  payload_json: string;
  hash: string;
  created_at: number;
};

export type OLJobRow = {
  job_id: string;
  namespace: string;
  name: string;
  latest_facets_json?: string;
  created_at: number;
  updated_at: number;
};

export type OLRunRow = {
  run_key: string;
  namespace: string;
  job_name: string;
  run_id: string;
  state: string;
  start_time?: string;
  end_time?: string;
  facets_json?: string;
  created_at: number;
  updated_at: number;
};

export type OLDatasetRow = {
  dataset_key: string;
  namespace: string;
  name: string;
  latest_facets_json?: string;
  created_at: number;
  updated_at: number;
};

export type OLEdgeRow = {
  edge_id: string;
  namespace: string;
  parent_dataset_name: string;
  child_dataset_name: string;
  run_id: string;
  created_at: number;
};

// Initialize OpenLineage schema
export function initOpenLineageSchema(db: Database.Database) {
  const schemaFile = 'src/db/openlineage-schema.sql';
  const sql = fs.readFileSync(schemaFile, 'utf8');
  db.exec(sql);
}

// OpenLineage event ingestion (idempotent)
export function ingestOpenLineageEvent(db: Database.Database, event: OpenLineageEvent): boolean {
  const payload = JSON.stringify(event);
  const hash = require('crypto').createHash('sha256').update(payload).digest('hex');
  const eventId = `ol_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  const now = Math.floor(Date.now() / 1000);

  // Check if already exists
  const existing = db.prepare('SELECT event_id FROM ol_events WHERE hash = ?').get(hash);
  if (existing) {
    return false; // Already processed
  }

  const tx = db.transaction(() => {
    // Insert raw event
    db.prepare(`
      INSERT INTO ol_events(event_id, event_time, namespace, job_name, run_id, event_type, payload_json, hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, event.eventTime, event.job.namespace, event.job.name, event.run.runId, event.eventType, payload, hash, now);

    // Upsert job
    const jobId = `${event.job.namespace}:${event.job.name}`;
    db.prepare(`
      INSERT INTO ol_jobs(job_id, namespace, name, latest_facets_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(namespace, name) DO UPDATE SET
        latest_facets_json = COALESCE(excluded.latest_facets_json, ol_jobs.latest_facets_json),
        updated_at = excluded.updated_at
    `).run(jobId, event.job.namespace, event.job.name,
           event.job.facets ? JSON.stringify(event.job.facets) : null, now, now);

    // Upsert run
    const runKey = `${event.job.namespace}:${event.job.name}:${event.run.runId}`;
    const endTime = event.eventType === 'COMPLETE' || event.eventType === 'ABORT' ? event.eventTime : null;
    const startTime = event.eventType === 'START' ? event.eventTime : null;

    db.prepare(`
      INSERT INTO ol_runs(run_key, namespace, job_name, run_id, state, start_time, end_time, facets_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(namespace, job_name, run_id) DO UPDATE SET
        state = excluded.state,
        start_time = COALESCE(excluded.start_time, ol_runs.start_time),
        end_time = COALESCE(excluded.end_time, ol_runs.end_time),
        facets_json = COALESCE(excluded.facets_json, ol_runs.facets_json),
        updated_at = excluded.updated_at
    `).run(runKey, event.job.namespace, event.job.name, event.run.runId, event.eventType,
           startTime, endTime, event.run.facets ? JSON.stringify(event.run.facets) : null, now, now);

    // Process datasets and edges
    const allDatasets = [...(event.inputs || []), ...(event.outputs || [])];
    for (const dataset of allDatasets) {
      // Upsert dataset
      const datasetKey = `${dataset.namespace}:${dataset.name}`;
      db.prepare(`
        INSERT INTO ol_datasets(dataset_key, namespace, name, latest_facets_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(namespace, name) DO UPDATE SET
          latest_facets_json = COALESCE(excluded.latest_facets_json, ol_datasets.latest_facets_json),
          updated_at = excluded.updated_at
      `).run(datasetKey, dataset.namespace, dataset.name,
             dataset.facets ? JSON.stringify(dataset.facets) : null, now, now);
    }

    // Create edges for inputs -> outputs (lineage)
    if (event.inputs && event.outputs) {
      for (const input of event.inputs) {
        for (const output of event.outputs) {
          const edgeId = `${event.job.namespace}_${input.name}_${output.name}_${event.run.runId}`;
          db.prepare(`
            INSERT OR IGNORE INTO ol_edges(edge_id, namespace, parent_dataset_name, child_dataset_name, run_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(edgeId, event.job.namespace, input.name, output.name, event.run.runId, now);
        }
      }
    }
  });

  tx();
  return true; // Successfully processed
}

// Query lineage graph
export function queryLineage(db: Database.Database, options: {
  node: string; // dataset:namespace:name
  depth?: number;
  direction?: 'up' | 'down' | 'both';
  namespace?: string;
}): {
  node: string;
  depth: number;
  direction: string;
  nodes: Array<{
    namespace: string;
    name: string;
    type: 'dataset';
    facets?: Record<string, any>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    rel: 'parent';
  }>;
  stats: {
    nodes: number;
    edges: number;
    truncated: boolean;
  };
} {
  const { depth = 3, direction = 'both' } = options;
  const maxDepth = Math.min(depth, parseInt(process.env.OL_QUERY_MAX_DEPTH || '10'));

  // Parse node identifier
  const [, nodeNamespace, nodeName] = options.node.split(':');
  const namespace = options.namespace || nodeNamespace;

  const visitedNodes = new Set<string>();
  const resultNodes = new Map<string, any>();
  const resultEdges: Array<{ from: string; to: string; rel: 'parent' }> = [];

  function traverse(currentName: string, currentDepth: number, goingUp: boolean) {
    if (currentDepth > maxDepth || visitedNodes.has(currentName)) return;
    visitedNodes.add(currentName);

    // Get dataset info
    const dataset = db.prepare(`
      SELECT namespace, name, latest_facets_json
      FROM ol_datasets
      WHERE namespace = ? AND name = ?
    `).get(namespace, currentName) as OLDatasetRow;

    if (dataset) {
      const nodeKey = `dataset:${dataset.namespace}:${dataset.name}`;
      resultNodes.set(nodeKey, {
        namespace: dataset.namespace,
        name: dataset.name,
        type: 'dataset',
        facets: dataset.latest_facets_json ? JSON.parse(dataset.latest_facets_json) : {}
      });
    }

    if (currentDepth < maxDepth) {
      if (direction === 'up' || direction === 'both') {
        // Get parents (inputs that led to this output)
        const parents = db.prepare(`
          SELECT DISTINCT parent_dataset_name
          FROM ol_edges
          WHERE namespace = ? AND child_dataset_name = ?
        `).all(namespace, currentName) as any[];

        for (const parent of parents) {
          const parentKey = `dataset:${namespace}:${parent.parent_dataset_name}`;
          const childKey = `dataset:${namespace}:${currentName}`;
          resultEdges.push({ from: parentKey, to: childKey, rel: 'parent' });
          traverse(parent.parent_dataset_name, currentDepth + 1, true);
        }
      }

      if (direction === 'down' || direction === 'both') {
        // Get children (outputs this was input to)
        const children = db.prepare(`
          SELECT DISTINCT child_dataset_name
          FROM ol_edges
          WHERE namespace = ? AND parent_dataset_name = ?
        `).all(namespace, currentName) as any[];

        for (const child of children) {
          const parentKey = `dataset:${namespace}:${currentName}`;
          const childKey = `dataset:${namespace}:${child.child_dataset_name}`;
          resultEdges.push({ from: parentKey, to: childKey, rel: 'parent' });
          traverse(child.child_dataset_name, currentDepth + 1, false);
        }
      }
    }
  }

  traverse(nodeName, 0, false);

  return {
    node: options.node,
    depth: maxDepth,
    direction,
    nodes: Array.from(resultNodes.values()),
    edges: resultEdges,
    stats: {
      nodes: resultNodes.size,
      edges: resultEdges.length,
      truncated: visitedNodes.size > resultNodes.size
    }
  };
}

// Get dataset details
export function getOLDataset(db: Database.Database, namespace: string, name: string): OLDatasetRow | undefined {
  return db.prepare(`
    SELECT * FROM ol_datasets
    WHERE namespace = ? AND name = ?
  `).get(namespace, name) as OLDatasetRow;
}

// Get run details
export function getOLRun(db: Database.Database, runId: string): OLRunRow | undefined {
  return db.prepare(`
    SELECT * FROM ol_runs
    WHERE run_id = ?
  `).get(runId) as OLRunRow;
}
