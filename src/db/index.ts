// Modern PostgreSQL/Redis Hybrid Database (D022HR + D011HR)
// Replaces legacy SQLite implementation

import { isTestEnvironment, getTestDatabase } from './test-setup';

export { HybridDatabase, getHybridDatabase, closeHybridDatabase } from './hybrid';
export { PostgreSQLClient, getPostgreSQLClient, closePostgreSQLConnection } from './postgresql';
export { RedisClient, getRedisClient, closeRedisConnection, CacheKeys, getCacheTTLs as getRedisConnectionTTLs } from './redis';
export { getTestDatabase, closeTestDatabase, isTestEnvironment } from './test-setup';

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

// Modern API functions using the hybrid database
export async function initSchema(): Promise<void> {
  if (isTestEnvironment()) {
    // Test database is auto-initialized in getTestDatabase()
    getTestDatabase();
    return;
  }

  const pgClient = getPostgreSQLClient();
  await pgClient.initSchema();
}

export async function upsertManifest(manifest: Partial<ManifestRow>): Promise<void> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO manifests (version_id, manifest_hash, content_hash, title, license, classification, created_at, manifest_json, dataset_id, producer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      manifest.version_id,
      manifest.manifest_hash || 'default-hash', // Provide default if missing
      manifest.content_hash,
      manifest.title,
      manifest.license,
      manifest.classification,
      manifest.created_at,
      manifest.manifest_json,
      manifest.dataset_id,
      manifest.producer_id
    );
    return;
  }

  const hybridDb = getHybridDatabase();
  return await hybridDb.upsertAsset(manifest);
}

export async function getManifest(versionId: string): Promise<ManifestRow | null> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const result = db.prepare('SELECT * FROM manifests WHERE version_id = ?').get(versionId as string) as ManifestRow | undefined;
    return result || null;
  }

  const hybridDb = getHybridDatabase();
  return await hybridDb.getAsset(versionId);
}

export async function searchManifests(opts: {
  q?: string;
  datasetId?: string;
  limit?: number;
  offset?: number;
}): Promise<ManifestRow[]> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    let sql = 'SELECT * FROM manifests WHERE 1=1';
    const params: any[] = [];

    if (opts.datasetId) {
      sql += ' AND dataset_id = ?';
      params.push(opts.datasetId);
    }

    if (opts.q) {
      sql += ' AND (title LIKE ? OR manifest_json LIKE ?)';
      params.push(`%${opts.q}%`, `%${opts.q}%`);
    }

    sql += ' ORDER BY created_at DESC';

    if (opts.limit) {
      sql += ' LIMIT ?';
      params.push(opts.limit);

      if (opts.offset) {
        sql += ' OFFSET ?';
        params.push(opts.offset);
      }
    }

    return db.prepare(sql).all(...params) as ManifestRow[];
  }

  const hybridDb = getHybridDatabase();
  return await hybridDb.searchAssets(opts);
}

export async function upsertProducer(producer: Partial<ProducerRow>): Promise<string> {
  const hybridDb = getHybridDatabase();
  return await hybridDb.upsertProducer(producer);
}

export async function getProducerById(producerId: string): Promise<ProducerRow | null> {
  const hybridDb = getHybridDatabase();
  return await hybridDb.getProducer(producerId);
}

export async function replaceEdges(child: string, parents: string[]): Promise<void> {
  const hybridDb = getHybridDatabase();
  return await hybridDb.replaceEdges(child, parents);
}

export async function getParents(child: string): Promise<string[]> {
  const hybridDb = getHybridDatabase();
  return await hybridDb.getParents(child);
}

export async function setPrice(versionId: string, satoshis: number): Promise<void> {
  const hybridDb = getHybridDatabase();
  return await hybridDb.setPrice(versionId, satoshis);
}

export async function getPrice(versionId: string): Promise<number | null> {
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
      receipt.receipt_id,
      receipt.version_id,
      receipt.quantity,
      receipt.content_hash,
      receipt.amount_sat,
      receipt.status,
      receipt.created_at,
      receipt.expires_at,
      receipt.bytes_used || 0,
      receipt.last_seen || null
    );
    return;
  }

  const hybridDb = getHybridDatabase();
  return await hybridDb.insertReceipt(receipt);
}

export async function getReceipt(receiptId: string): Promise<ReceiptRow | null> {
  if (isTestEnvironment()) {
    const db = getTestDatabase();
    const result = db.prepare('SELECT * FROM receipts WHERE receipt_id = ?').get(receiptId) as ReceiptRow | undefined;
    return result || null;
  }

  const hybridDb = getHybridDatabase();
  return await hybridDb.getReceipt(receiptId);
}

export async function ingestOpenLineageEvent(event: OpenLineageEvent): Promise<boolean> {
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
  const pgClient = getPostgreSQLClient();
  return await pgClient.queryOne<DeclarationRow>(
    'SELECT * FROM declarations WHERE version_id = $1',
    [versionId]
  );
}

export async function getDeclarationByTxid(txid: string): Promise<DeclarationRow | null> {
  const pgClient = getPostgreSQLClient();
  return await pgClient.queryOne<DeclarationRow>(
    'SELECT * FROM declarations WHERE txid = $1',
    [txid]
  );
}

export async function setOpretVout(versionId: string, vout: number): Promise<void> {
  const pgClient = getPostgreSQLClient();
  await pgClient.query(
    'UPDATE declarations SET opret_vout = $1 WHERE version_id = $2',
    [vout, versionId]
  );
}

export async function setProofEnvelope(versionId: string, envelopeJson: string): Promise<void> {
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

export function createTemplate(db: any, template: Partial<any>): string {
  if (!db) throw new Error('Database not available');

  const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  db.prepare(`
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

  return templateId;
}

export function getTemplate(db: any, templateId: string): any {
  if (!db) return null;
  return db.prepare('SELECT * FROM contract_templates WHERE template_id = ?').get(templateId);
}

export function listTemplates(db: any, limit = 100, offset = 0): any[] {
  if (!db) return [];
  return db.prepare('SELECT * FROM contract_templates ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
}

export function updateTemplate(db: any, templateId: string, updates: Partial<any>): void {
  if (!db) return;

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

  db.prepare(`UPDATE contract_templates SET ${setFields.join(', ')} WHERE template_id = ?`).run(...params);
}

export function deleteTemplate(db: any, templateId: string): void {
  if (!db) return;
  db.prepare('DELETE FROM contract_templates WHERE template_id = ?').run(templateId);
}