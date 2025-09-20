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