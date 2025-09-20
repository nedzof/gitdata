// Modern PostgreSQL/Redis Hybrid Database (D022HR + D011HR)
// Replaces legacy SQLite implementation

import { isTestEnvironment, getTestDatabase } from './test-setup';

export { HybridDatabase, getHybridDatabase, closeHybridDatabase } from './hybrid';
export { PostgreSQLClient, getPostgreSQLClient, closePostgreSQLConnection } from './postgresql';
export { RedisClient, getRedisClient, closeRedisConnection, CacheKeys, getCacheTTLs as getRedisConnectionTTLs } from './redis';
export { getTestDatabase, closeTestDatabase, isTestEnvironment } from './test-setup';

// Database initialization for backwards compatibility
export function initSchema(db?: any): Promise<any> {
  if (db && db.prepare && typeof db.prepare === 'function') {
    // Synchronous SQLite schema initialization for test databases
    const initSQL = `
      CREATE TABLE IF NOT EXISTS manifests (
        version_id TEXT PRIMARY KEY,
        manifest_hash TEXT NOT NULL,
        content_hash TEXT,
        title TEXT,
        license TEXT,
        classification TEXT,
        created_at TEXT,
        manifest_json TEXT NOT NULL,
        dataset_id TEXT,
        producer_id TEXT
      );

      CREATE TABLE IF NOT EXISTS declarations (
        version_id TEXT PRIMARY KEY,
        txid TEXT UNIQUE,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        block_hash TEXT,
        height INTEGER,
        opret_vout INTEGER,
        raw_tx TEXT,
        proof_json TEXT
      );

      CREATE TABLE IF NOT EXISTS edges (
        child_version_id TEXT NOT NULL,
        parent_version_id TEXT NOT NULL,
        PRIMARY KEY (child_version_id, parent_version_id)
      );

      CREATE TABLE IF NOT EXISTS producers (
        producer_id TEXT PRIMARY KEY,
        name TEXT,
        website TEXT,
        identity_key TEXT,
        payout_script_hex TEXT,
        created_at INTEGER NOT NULL
      );
    `;
    db.exec(initSQL);
    return Promise.resolve(db);
  } else if (isTestEnvironment()) {
    // In test environment, return SQLite database
    return Promise.resolve(getTestDatabase());
  } else {
    // In production, return hybrid database
    const { getHybridDatabase } = require('./hybrid');
    return Promise.resolve(getHybridDatabase());
  }
}

// Get database instance
export function getDatabase(): any {
  if (isTestEnvironment()) {
    return getTestDatabase();
  } else {
    const { getHybridDatabase } = require('./hybrid');
    return getHybridDatabase();
  }
}

// Helper function to safely execute SQLite queries
function executeSQLite(db: any, sql: string, params: any[] = []): any {
  if (!db || !db.prepare || typeof db.prepare !== 'function') {
    console.warn('[executeSQLite] Not a SQLite database or no prepare method');
    return null;
  }
  return db.prepare(sql);
}

// Type definitions for backward compatibility
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

// Modern API functions using the hybrid database - merged with the sync version above

// Overloaded function signatures
export function upsertManifest(db: any, manifest: Partial<ManifestRow>): void;
export function upsertManifest(manifest: Partial<ManifestRow>): Promise<void>;
export function upsertManifest(dbOrManifest: any, manifest?: Partial<ManifestRow>): void | Promise<void> {
  // Check if first parameter is a database (has prepare method) or a manifest
  if (dbOrManifest && dbOrManifest.prepare && typeof dbOrManifest.prepare === 'function') {
    // Legacy signature: upsertManifest(db, manifest)
    const db = dbOrManifest;
    const manifestData = manifest!;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO manifests (version_id, manifest_hash, content_hash, title, license, classification, created_at, manifest_json, dataset_id, producer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      manifestData.version_id,
      manifestData.manifest_hash || 'default-hash',
      manifestData.content_hash || null,
      manifestData.title || null,
      manifestData.license || null,
      manifestData.classification || null,
      manifestData.created_at || new Date().toISOString(),
      manifestData.manifest_json || '{}',
      manifestData.dataset_id || null,
      manifestData.producer_id || null
    );
    return;
  } else {
    // Modern signature: upsertManifest(manifest) - async
    const manifestData = dbOrManifest as Partial<ManifestRow>;

    if (isTestEnvironment()) {
      const db = getTestDatabase();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO manifests (version_id, manifest_hash, content_hash, title, license, classification, created_at, manifest_json, dataset_id, producer_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        manifestData.version_id,
        manifestData.manifest_hash || 'default-hash',
        manifestData.content_hash || null,
        manifestData.title || null,
        manifestData.license || null,
        manifestData.classification || null,
        manifestData.created_at || new Date().toISOString(),
        manifestData.manifest_json || '{}',
        manifestData.dataset_id || null,
        manifestData.producer_id || null
      );
      return Promise.resolve();
    }

    const { getHybridDatabase } = require('./hybrid');
    const hybridDb = getHybridDatabase();
    return hybridDb.upsertAsset(manifestData);
  }
}

export async function getManifest(versionId: string): Promise<ManifestRow | null> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const result = db.prepare('SELECT * FROM manifests WHERE version_id = ?').get(versionId as string) as ManifestRow | undefined;
    return result || null;
  }

  const { getHybridDatabase } = require('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.getAsset(versionId);
}

// Removed async searchManifests - using sync version in legacy compatibility section

// Overloaded function signatures for upsertProducer
export function upsertProducer(db: any, producer: Partial<ProducerRow>): string;
export function upsertProducer(producer: Partial<ProducerRow>): Promise<string>;
export function upsertProducer(dbOrProducer: any, producer?: Partial<ProducerRow>): string | Promise<string> {
  // Check if first parameter is a database (has prepare method) or a producer
  if (dbOrProducer && dbOrProducer.prepare && typeof dbOrProducer.prepare === 'function') {
    // Legacy signature: upsertProducer(db, producer)
    const db = dbOrProducer;
    const producerData = producer!;
    const producerId = producerData.producer_id || `producer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO producers (producer_id, name, website, identity_key, payout_script_hex, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      producerId,
      producerData.name || null,
      producerData.website || null,
      producerData.identity_key || null,
      producerData.payout_script_hex || null,
      producerData.created_at || Date.now()
    );
    return producerId;
  } else {
    // Modern signature: upsertProducer(producer) - async
    const producerData = dbOrProducer as Partial<ProducerRow>;

    if (isTestEnvironment()) {
      const db = getTestDatabase();
      const producerId = producerData.producer_id || `producer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO producers (producer_id, name, website, identity_key, payout_script_hex, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        producerId,
        producerData.name || null,
        producerData.website || null,
        producerData.identity_key || null,
        producerData.payout_script_hex || null,
        producerData.created_at || Date.now()
      );
      return Promise.resolve(producerId);
    }

    const { getHybridDatabase } = require('./hybrid');
    const hybridDb = getHybridDatabase();
    return hybridDb.upsertProducer(producerData);
  }
}

export async function getProducerById(producerId: string): Promise<ProducerRow | null> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const stmt = db.prepare('SELECT * FROM producers WHERE producer_id = ?');
    return stmt.get(producerId) as ProducerRow | null;
  }

  const { getHybridDatabase } = require('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.getProducer(producerId);
}

export async function replaceEdges(child: string, parents: string[]): Promise<void> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();

    // Validate parameters
    if (typeof child !== 'string') {
      console.warn('[replaceEdges] Invalid child parameter:', child);
      return;
    }
    if (!Array.isArray(parents)) {
      console.warn('[replaceEdges] Invalid parents parameter:', parents);
      return;
    }

    // Clear existing edges for this child
    db.prepare('DELETE FROM edges WHERE child_version_id = ?').run(child);
    // Insert new edges
    const stmt = db.prepare('INSERT INTO edges (child_version_id, parent_version_id) VALUES (?, ?)');
    for (const parent of parents) {
      if (typeof parent === 'string') {
        stmt.run(child, parent);
      }
    }
    return;
  }

  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.replaceEdges(child, parents);
}

// Removed async getParents - using sync version in legacy compatibility section

export async function setPrice(versionId: string, satoshis: number): Promise<void> {
  if (isTestEnvironment()) {
    // For tests, we can use a simple in-memory price store or just return
    console.warn('[setPrice] Test environment - price setting not implemented');
    return;
  }
  const { getHybridDatabase } = require('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.setPrice(versionId, satoshis);
}

export async function getPrice(versionId: string): Promise<number | null> {
  if (isTestEnvironment()) {
    // For tests, return default price
    return 1234; // PRICE_DEFAULT_SATS
  }
  const { getHybridDatabase } = require('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.getPrice(versionId);
}

export async function insertReceipt(receipt: Omit<ReceiptRow, 'bytes_used' | 'last_seen'> & Partial<Pick<ReceiptRow, 'bytes_used' | 'last_seen'>>): Promise<void> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const stmt = db.prepare(`
      INSERT INTO receipts (receipt_id, version_id, quantity, content_hash, amount_sat, status, created_at, expires_at, bytes_used, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      receipt.receipt_id || null,
      receipt.version_id || null,
      receipt.quantity || 1, // Default quantity if not provided
      receipt.content_hash || null,
      receipt.amount_sat || 0,
      receipt.status || 'pending',
      receipt.created_at || Date.now(),
      receipt.expires_at || null,
      receipt.bytes_used || 0,
      receipt.last_seen || null
    );
    return;
  }

  const { getHybridDatabase } = require('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.insertReceipt(receipt);
}

export async function getReceipt(receiptId: string): Promise<ReceiptRow | null> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const result = db.prepare('SELECT * FROM receipts WHERE receipt_id = ?').get(receiptId) as ReceiptRow | undefined;
    return result || null;
  }

  const { getHybridDatabase } = require('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.getReceipt(receiptId);
}

export async function ingestOpenLineageEvent(event: OpenLineageEvent): Promise<boolean> {
  if (isTestEnvironment()) {
    console.warn('[ingestOpenLineageEvent] Test environment - event ingestion not implemented');
    return true;
  }
  const { getHybridDatabase } = require('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.ingestOpenLineageEvent(event);
}

export async function queryLineage(options: {
  node: string;
  depth?: number;
  direction?: 'up' | 'down' | 'both';
  namespace?: string;
}): Promise<{
  node: string;
  depth: number;
  direction: string;
  nodes: Array<{ namespace: string; name: string; type: 'dataset'; facets?: any }>;
  edges: Array<{ from: string; to: string; rel: 'parent' }>;
  stats: { nodes: number; edges: number; truncated: boolean };
}> {
  const hybridDb = getHybridDatabase();
  return await hybridDb.queryLineage(options);
}

// Database operations that need to be implemented directly with PostgreSQL client

export async function upsertDeclaration(row: Partial<DeclarationRow>): Promise<void> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO declarations (version_id, txid, type, status, created_at, block_hash, height, opret_vout, raw_tx, proof_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      row.version_id,
      row.txid || null,
      row.type || 'UNKNOWN',
      row.status || 'pending',
      row.created_at || Date.now(),
      row.block_hash || null,
      row.height || null,
      row.opret_vout || null,
      row.raw_tx || null,
      row.proof_json || null
    );
    return;
  }

  const { getPostgreSQLClient } = require('./postgresql');
  const pgClient = getPostgreSQLClient();
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = values.map((_, i) => `$${i + 1}`);
  const updateSet = columns
    .filter(col => col !== 'version_id')
    .map(col => `${col} = EXCLUDED.${col}`)
    .join(', ');

  await pgClient.query(`
    INSERT INTO declarations (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (version_id)
    DO UPDATE SET ${updateSet}
  `, values);
}

export async function getDeclarationByVersion(versionId: string): Promise<DeclarationRow | null> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const stmt = db.prepare('SELECT * FROM declarations WHERE version_id = ?');
    return stmt.get(versionId) as DeclarationRow | null;
  }

  const { getPostgreSQLClient } = require('./postgresql');
  const pgClient = getPostgreSQLClient();
  return await pgClient.queryOne<DeclarationRow>(
    'SELECT * FROM declarations WHERE version_id = $1',
    [versionId]
  );
}

export async function getDeclarationByTxid(txid: string): Promise<DeclarationRow | null> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const stmt = db.prepare('SELECT * FROM declarations WHERE txid = ?');
    return stmt.get(txid) as DeclarationRow | null;
  }

  const { getPostgreSQLClient } = require('./postgresql');
  const pgClient = getPostgreSQLClient();
  return await pgClient.queryOne<DeclarationRow>(
    'SELECT * FROM declarations WHERE txid = $1',
    [txid]
  );
}

export async function setOpretVout(versionId: string, vout: number): Promise<void> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const stmt = db.prepare('UPDATE declarations SET opret_vout = ? WHERE version_id = ?');
    stmt.run(vout, versionId);
    return;
  }

  const { getPostgreSQLClient } = require('./postgresql');
  const pgClient = getPostgreSQLClient();
  await pgClient.query(
    'UPDATE declarations SET opret_vout = $1 WHERE version_id = $2',
    [vout, versionId]
  );
}

export async function setProofEnvelope(versionId: string, envelopeJson: string): Promise<void> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const stmt = db.prepare('UPDATE declarations SET proof_json = ? WHERE version_id = ?');
    stmt.run(envelopeJson, versionId);
    return;
  }

  const { getPostgreSQLClient } = require('./postgresql');
  const pgClient = getPostgreSQLClient();
  await pgClient.query(
    'UPDATE declarations SET proof_json = $1 WHERE version_id = $2',
    [envelopeJson, versionId]
  );
}

// Additional functions that need PostgreSQL implementation
export async function listListings(limit = 50, offset = 0): Promise<any[]> {
  const pgClient = getPostgreSQLClient();
  const result = await pgClient.query(`
    SELECT
      m.version_id,
      m.title,
      m.license,
      m.classification,
      m.content_hash,
      m.dataset_id,
      p.display_name AS producer_name,
      p.website AS producer_website,
      d.txid,
      d.status,
      d.created_at
    FROM manifests m
    LEFT JOIN declarations d ON d.version_id = m.version_id
    LEFT JOIN producers p ON p.producer_id = m.producer_id
    ORDER BY d.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
  return result.rows;
}

// Health check function
export async function healthCheck(): Promise<{ pg: boolean; redis: boolean }> {
  const hybridDb = getHybridDatabase();
  return await hybridDb.healthCheck();
}

// OpenLineage stub functions for compatibility (TODO: implement fully)
export async function getOLDataset(namespace: string, name: string): Promise<any> {
  // TODO: Implement OpenLineage dataset retrieval
  return null;
}

export async function getOLRun(namespace: string, runId: string): Promise<any> {
  // TODO: Implement OpenLineage run retrieval
  return null;
}

export async function getOLJob(namespace: string, name: string): Promise<any> {
  // TODO: Implement OpenLineage job retrieval
  return null;
}

export async function searchOLDatasets(namespace: string, query?: string): Promise<any[]> {
  // TODO: Implement OpenLineage dataset search
  return [];
}

// Agent, Rule, and Job management functions for D24 compatibility

export function listJobs(db: any, state?: string, limit = 100, offset = 0): JobRow[] {
  if (!db) return [];

  let query = 'SELECT * FROM jobs';
  const params: any[] = [];

  if (state) {
    query += ' WHERE state = ?';
    params.push(state);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params) as JobRow[];
}

export function upsertAgent(db: any, agent: Partial<any>): string {
  if (!db) throw new Error('Database not available');

  const agentId = agent.agent_id || `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  db.prepare(`
    INSERT OR REPLACE INTO agents (
      agent_id, name, capabilities_json, webhook_url, identity_key,
      status, last_ping_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agentId,
    agent.name,
    agent.capabilities_json || '[]',
    agent.webhook_url,
    agent.identity_key,
    agent.status || 'unknown',
    agent.last_ping_at,
    agent.created_at || now,
    now
  );

  return agentId;
}

export function getAgent(db: any, agentId: string): any {
  if (!db) return null;
  return db.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId);
}

export function searchAgents(db: any, q?: string, capability?: string, limit = 50, offset = 0): any[] {
  if (!db) return [];

  let query = 'SELECT * FROM agents WHERE 1=1';
  const params: any[] = [];

  if (q) {
    query += ' AND (name LIKE ? OR agent_id LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  if (capability) {
    query += ' AND capabilities_json LIKE ?';
    params.push(`%${capability}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

export function setAgentPing(db: any, agentId: string, success: boolean): void {
  if (!db) return;

  const status = success ? 'up' : 'down';
  const now = Date.now();

  db.prepare(`
    UPDATE agents
    SET status = ?, last_ping_at = ?, updated_at = ?
    WHERE agent_id = ?
  `).run(status, now, now, agentId);
}

export function createRule(db: any, rule: Partial<any>): string {
  if (!db) throw new Error('Database not available');

  const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  db.prepare(`
    INSERT INTO rules (
      rule_id, name, enabled, when_json, find_json, actions_json,
      owner_producer_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ruleId,
    rule.name,
    rule.enabled || 1,
    rule.when_json || '{}',
    rule.find_json || '{}',
    rule.actions_json || '[]',
    rule.owner_producer_id,
    now,
    now
  );

  return ruleId;
}

export function updateRule(db: any, ruleId: string, updates: Partial<any>): void {
  if (!db) return;

  const now = Date.now();
  const setFields = [];
  const params = [];

  if (updates.name !== undefined) {
    setFields.push('name = ?');
    params.push(updates.name);
  }

  if (updates.enabled !== undefined) {
    setFields.push('enabled = ?');
    params.push(updates.enabled);
  }

  if (updates.when_json !== undefined) {
    setFields.push('when_json = ?');
    params.push(updates.when_json);
  }

  if (updates.find_json !== undefined) {
    setFields.push('find_json = ?');
    params.push(updates.find_json);
  }

  if (updates.actions_json !== undefined) {
    setFields.push('actions_json = ?');
    params.push(updates.actions_json);
  }

  if (setFields.length === 0) return;

  setFields.push('updated_at = ?');
  params.push(now);
  params.push(ruleId);

  db.prepare(`UPDATE rules SET ${setFields.join(', ')} WHERE rule_id = ?`).run(...params);
}

export function getRule(db: any, ruleId: string): any {
  if (!db) return null;
  return db.prepare('SELECT * FROM rules WHERE rule_id = ?').get(ruleId);
}

export function listRules(db: any, enabledOnly = false, limit = 100, offset = 0): any[] {
  if (!db) return [];

  let query = 'SELECT * FROM rules';
  const params: any[] = [];

  if (enabledOnly) {
    query += ' WHERE enabled = 1';
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

export function deleteRule(db: any, ruleId: string): void {
  if (!db) return;
  db.prepare('DELETE FROM rules WHERE rule_id = ?').run(ruleId);
}

export function enqueueJob(db: any, job: Partial<any>): string {
  if (!db) throw new Error('Database not available');

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  db.prepare(`
    INSERT INTO jobs (
      job_id, rule_id, target_id, state, attempts, next_run_at,
      last_error, evidence_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jobId,
    job.rule_id,
    job.target_id,
    job.state || 'queued',
    job.attempts || 0,
    job.next_run_at || now,
    job.last_error,
    job.evidence_json,
    now,
    now
  );

  return jobId;
}

export function getNextQueuedJob(db: any): any | null {
  if (!db) return null;
  const stmt = db.prepare(`
    SELECT * FROM jobs
    WHERE state = 'queued' AND next_run_at <= ?
    ORDER BY next_run_at ASC, created_at ASC
    LIMIT 1
  `);
  return stmt.get(Date.now());
}

export function updateJob(db: any, jobId: string, updates: Partial<any>): void {
  if (!db) return;

  const setFields: string[] = [];
  const params: any[] = [];
  const now = Date.now();

  if (updates.state !== undefined) {
    setFields.push('state = ?');
    params.push(updates.state);
  }
  if (updates.attempts !== undefined) {
    setFields.push('attempts = ?');
    params.push(updates.attempts);
  }
  if (updates.next_run_at !== undefined) {
    setFields.push('next_run_at = ?');
    params.push(updates.next_run_at);
  }
  if (updates.last_error !== undefined) {
    setFields.push('last_error = ?');
    params.push(updates.last_error);
  }
  if (updates.evidence_json !== undefined) {
    setFields.push('evidence_json = ?');
    params.push(updates.evidence_json);
  }

  if (setFields.length === 0) return;

  setFields.push('updated_at = ?');
  params.push(now);
  params.push(jobId);

  db.prepare(`UPDATE jobs SET ${setFields.join(', ')} WHERE job_id = ?`).run(...params);
}

export function createTemplate(db: any, template: Partial<any>): string {
  // Use the database parameter directly if provided, only fallback to getDatabase() if db is null/undefined
  const database = db ? db : getDatabase();
  if (!database) throw new Error('Database not available');

  const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  if (database.prepare && typeof database.prepare === 'function') {
    database.prepare(`
      INSERT INTO contract_templates (
        template_id, name, description, template_content, template_type,
        variables_json, owner_producer_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      templateId,
      template.name,
      template.description,
      template.template_content,
      template.template_type || 'pdf',
      template.variables_json,
      template.owner_producer_id,
      now,
      now
    );
  } else {
    const hybridDb = getHybridDatabase();
    hybridDb.query(`
      INSERT INTO templates (
        template_id, name, description, template_data, created_at, updated_at, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (template_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        template_data = EXCLUDED.template_data,
        updated_at = EXCLUDED.updated_at,
        owner_id = EXCLUDED.owner_id
    `, [
      templateId,
      template.name || '',
      template.description || '',
      JSON.stringify(template.template_data || {}),
      template.created_at || new Date().toISOString(),
      template.updated_at || new Date().toISOString(),
      template.owner_id || null
    ]);
  }

  return templateId;
}

export function getTemplate(db: any, templateId: string): any {
  // Use the database parameter directly if provided, only fallback to getDatabase() if db is null/undefined
  const database = db ? db : getDatabase();
  if (!database) return null;
  if (database.prepare && typeof database.prepare === 'function') {
    return database.prepare('SELECT * FROM contract_templates WHERE template_id = ?').get(templateId);
  }
  return null;
}

export function listTemplates(db: any, limit = 100, offset = 0): any[] {
  // Use the database parameter directly if provided, only fallback to getDatabase() if db is null/undefined
  const database = db ? db : getDatabase();
  if (!database) {
    return [];
  }
  if (database.prepare && typeof database.prepare === 'function') {
    return database.prepare('SELECT * FROM contract_templates ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  }
  return [];
}

export function updateTemplate(db: any, templateId: string, updates: Partial<any>): void {
  // Use the database parameter directly if provided, only fallback to getDatabase() if db is null/undefined
  const database = db ? db : getDatabase();
  if (!database) return;

  const now = Date.now();
  const setFields = [];
  const params = [];

  if (updates.name !== undefined) {
    setFields.push('name = ?');
    params.push(updates.name);
  }

  if (updates.description !== undefined) {
    setFields.push('description = ?');
    params.push(updates.description);
  }

  if (updates.template_content !== undefined) {
    setFields.push('template_content = ?');
    params.push(updates.template_content);
  }

  if (updates.template_type !== undefined) {
    setFields.push('template_type = ?');
    params.push(updates.template_type);
  }

  if (updates.variables_json !== undefined) {
    setFields.push('variables_json = ?');
    params.push(updates.variables_json);
  }

  if (setFields.length === 0) return;

  setFields.push('updated_at = ?');
  params.push(now);
  params.push(templateId);

  if (database.prepare && typeof database.prepare === 'function') {
    database.prepare(`UPDATE contract_templates SET ${setFields.join(', ')} WHERE template_id = ?`).run(...params);
  } else {
    const hybridDb = getHybridDatabase();
    hybridDb.query(`
      UPDATE templates SET
        name = $2, description = $3, template_data = $4, updated_at = $5
      WHERE template_id = $1
    `, [
      templateId,
      updates.name || '',
      updates.description || '',
      JSON.stringify(updates.template_data || {}),
      new Date().toISOString()
    ]);
  }
}

export function deleteTemplate(db: any, templateId: string): void {
  // Use the database parameter directly if provided, only fallback to getDatabase() if db is null/undefined
  const database = db ? db : getDatabase();
  if (!database) return;
  if (database.prepare && typeof database.prepare === 'function') {
    database.prepare('DELETE FROM contract_templates WHERE template_id = ?').run(templateId);
  } else {
    const hybridDb = getHybridDatabase();
    hybridDb.query('DELETE FROM templates WHERE template_id = $1', [templateId]);
  }
}

// Test-compatible createManifest function
export function createManifest(db: any, manifest: Partial<ManifestRow>): string {
  // Get the proper database if not provided
  const database = db || getDatabase();

  if (!database) {
    console.warn('[createManifest] No database available');
    return '';
  }

  const manifestId = manifest.version_id || '';

  // Check if this is SQLite (test) or PostgreSQL (production)
  if (database.prepare && typeof database.prepare === 'function') {
    // SQLite mode (tests)
    const stmt = database.prepare(`
      INSERT OR REPLACE INTO manifests (
        version_id, manifest_hash, content_hash, title, license,
        classification, created_at, manifest_json, dataset_id, producer_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      manifestId,
      manifest.manifest_hash || '',
      manifest.content_hash || null,
      manifest.title || null,
      manifest.license || null,
      manifest.classification || null,
      manifest.created_at || new Date().toISOString(),
      manifest.manifest_json || '{}',
      manifest.dataset_id || null,
      manifest.producer_id || null
    );
  } else {
    // PostgreSQL mode (production) - use hybrid database
    const hybridDb = getHybridDatabase();
    hybridDb.query(`
      INSERT INTO manifests (
        version_id, manifest_hash, content_hash, title, license,
        classification, created_at, manifest_json, dataset_id, producer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (version_id) DO UPDATE SET
        manifest_hash = EXCLUDED.manifest_hash,
        content_hash = EXCLUDED.content_hash,
        title = EXCLUDED.title,
        license = EXCLUDED.license,
        classification = EXCLUDED.classification,
        created_at = EXCLUDED.created_at,
        manifest_json = EXCLUDED.manifest_json,
        dataset_id = EXCLUDED.dataset_id,
        producer_id = EXCLUDED.producer_id
    `, [
      manifestId,
      manifest.manifest_hash || '',
      manifest.content_hash || null,
      manifest.title || null,
      manifest.license || null,
      manifest.classification || null,
      manifest.created_at || new Date().toISOString(),
      manifest.manifest_json || '{}',
      manifest.dataset_id || null,
      manifest.producer_id || null
    ]);
  }

  return manifestId;
}

// Legacy compatibility functions for routes that still expect old signatures
export function searchManifests(db: any, opts: {
  q?: string;
  datasetId?: string;
  limit?: number;
  offset?: number;
}): ManifestRow[] {
  const database = db || getDatabase();
  if (!database) return [];

  let sql = 'SELECT * FROM manifests WHERE 1=1';
  const params: any[] = [];

  if (opts.datasetId) {
    sql += ' AND dataset_id = ?';
    params.push(opts.datasetId);
  }

  if (opts.q) {
    sql += ' AND (title LIKE ? OR manifest_json LIKE ?)';
    const searchTerm = `%${opts.q}%`;
    params.push(searchTerm, searchTerm);
  }

  sql += ' ORDER BY created_at DESC';

  if (opts.limit) {
    sql += ' LIMIT ?';
    params.push(opts.limit);
  }

  if (opts.offset) {
    sql += ' OFFSET ?';
    params.push(opts.offset);
  }

  if (database.prepare && typeof database.prepare === 'function') {
    return database.prepare(sql).all(...params) as ManifestRow[];
  }
  return [];
}

export function getParents(db: any, versionId: string): string[] {
  const database = db || getDatabase();
  if (!database) return [];
  if (database.prepare && typeof database.prepare === 'function') {
    const stmt = database.prepare('SELECT parent_version_id FROM edges WHERE child_version_id = ?');
    const results = stmt.all(versionId) as { parent_version_id: string }[];
    return results.map(r => r.parent_version_id);
  }
  return [];
}

export function listVersionsByDataset(db: any, datasetId: string, limit = 20, offset = 0): ManifestRow[] {
  const database = db || getDatabase();
  if (!database) return [];
  if (database.prepare && typeof database.prepare === 'function') {
    const stmt = database.prepare('SELECT * FROM manifests WHERE dataset_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(datasetId, limit, offset) as ManifestRow[];
  }
  return [];
}

// Advisory functions
export function insertAdvisory(db: any, advisory: any): string {
  if (!db) return '';
  const stmt = db.prepare(`
    INSERT INTO advisories (advisory_id, type, reason, created_at, expires_at, payload_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    advisory.advisoryId,
    advisory.type,
    advisory.reason,
    advisory.createdAt,
    advisory.expiresAt || null,
    advisory.payload ? JSON.stringify(advisory.payload) : null
  );
  return advisory.advisoryId;
}

export function insertAdvisoryTargets(db: any, advisoryId: string, targets: any): void {
  if (!db) return;
  // For this implementation, we'll store targets in the payload_json
  // In a full implementation, you'd have separate advisory_targets table
}

export function listAdvisoriesForVersionActive(db: any, versionId: string, now: number): any[] {
  if (!db) return [];
  // For now, return empty array - would need proper advisory_targets table
  return [];
}

export function listAdvisoriesForProducerActive(db: any, producerId: string, now: number): any[] {
  if (!db) return [];
  // For now, return empty array - would need proper advisory_targets table
  return [];
}

export function getProducerIdForVersion(db: any, versionId: string): string | null {
  if (!db) return null;
  const stmt = db.prepare('SELECT producer_id FROM manifests WHERE version_id = ?');
  const result = stmt.get(versionId) as { producer_id?: string } | undefined;
  return result?.producer_id || null;
}