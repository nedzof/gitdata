// Modern PostgreSQL/Redis Hybrid Database (D022HR + D011HR)
// Replaces legacy SQLite implementation

export { HybridDatabase, getHybridDatabase, closeHybridDatabase } from './hybrid';
export { PostgreSQLClient, getPostgreSQLClient, closePostgreSQLConnection } from './postgresql';
export { RedisClient, getRedisClient, closeRedisConnection, CacheKeys, getCacheTTLs as getRedisConnectionTTLs } from './redis';

// Database initialization
export async function initSchema(): Promise<any> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  // Schema is already initialized in PostgreSQL migrations
  return hybridDb;
}

// Test database compatibility functions
export { getTestDatabase, resetTestDatabase } from './test-setup';

// Test environment detection
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

// Close functions for testing
export async function closeTestDatabase(): Promise<void> {
  // For PostgreSQL/Redis, we don't need to close as they're handled by the connection pools
  return Promise.resolve();
}

// Get database instance with SQLite compatibility layer
export function getDatabase(): any {
  if (isTestEnvironment()) {
    // Return test database with SQLite compatibility
    const { getTestDatabase } = require('./test-setup');
    return getTestDatabase();
  } else {
    const { getHybridDatabase } = require('./hybrid');
    return getHybridDatabase();
  }
}

// Helper function to safely execute SQLite queries (deprecated - use PostgreSQL instead)
function executeSQLite(db: any, sql: string, params: any[] = []): any {
  console.warn('[executeSQLite] This function is deprecated - all queries should use PostgreSQL');
  return null;
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

// Modern API functions using the hybrid database

export async function upsertManifest(manifest: Partial<ManifestRow>): Promise<void> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.upsertAsset(manifest);
}

export async function createManifest(manifest: Partial<ManifestRow>): Promise<string> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  await hybridDb.upsertAsset(manifest);
  return manifest.version_id || '';
}

export async function getManifest(versionId: string): Promise<ManifestRow | null> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.getAsset(versionId);
}

export async function upsertProducer(producer: Partial<ProducerRow>): Promise<string> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.upsertProducer(producer);
}

export async function getProducerById(producerId: string): Promise<ProducerRow | null> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.getProducer(producerId);
}

export async function getProducerByDatasetId(datasetId: string): Promise<ProducerRow | null> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  // Get producer_id from manifests table using datasetId
  const result = await pgClient.query(
    'SELECT producer_id FROM manifests WHERE dataset_id = $1 LIMIT 1',
    [datasetId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Get full producer details
  return await getProducerById(result.rows[0].producer_id);
}

export async function replaceEdges(child: string, parents: string[]): Promise<void> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.replaceEdges(child, parents);
}

export async function setPrice(versionId: string, satoshis: number): Promise<void> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.setPrice(versionId, satoshis);
}

export async function getPrice(versionId: string): Promise<number | null> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.getPrice(versionId);
}

export async function insertReceipt(receipt: Omit<ReceiptRow, 'bytes_used' | 'last_seen'> & Partial<Pick<ReceiptRow, 'bytes_used' | 'last_seen'>>): Promise<void> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.insertReceipt(receipt);
}

export async function getReceipt(receiptId: string): Promise<ReceiptRow | null> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.getReceipt(receiptId);
}

export async function ingestOpenLineageEvent(event: OpenLineageEvent): Promise<boolean> {
  const { getHybridDatabase } = await import('./hybrid');
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
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.queryLineage(options);
}

// Database operations that use PostgreSQL directly

export async function upsertDeclaration(row: Partial<DeclarationRow>): Promise<void> {
  const { getPostgreSQLClient } = await import('./postgresql');
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
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();
  return await pgClient.queryOne<DeclarationRow>(
    'SELECT * FROM declarations WHERE version_id = $1',
    [versionId]
  );
}

export async function getDeclarationByTxid(txid: string): Promise<DeclarationRow | null> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();
  return await pgClient.queryOne<DeclarationRow>(
    'SELECT * FROM declarations WHERE txid = $1',
    [txid]
  );
}

export async function setOpretVout(versionId: string, vout: number): Promise<void> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();
  await pgClient.query(
    'UPDATE declarations SET opret_vout = $1 WHERE version_id = $2',
    [vout, versionId]
  );
}

export async function setProofEnvelope(versionId: string, envelopeJson: string): Promise<void> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();
  await pgClient.query(
    'UPDATE declarations SET proof_json = $1 WHERE version_id = $2',
    [envelopeJson, versionId]
  );
}

// Advisory management functions
// Overloaded function signatures for insertAdvisory
export function insertAdvisory(db: any, advisory: Partial<AdvisoryRow>): void;
export function insertAdvisory(advisory: Partial<AdvisoryRow>): Promise<void>;
export function insertAdvisory(dbOrAdvisory: any, advisory?: Partial<AdvisoryRow>): void | Promise<void> {
  // Check if first parameter is a database (has prepare method) or an advisory
  if (dbOrAdvisory && dbOrAdvisory.prepare && typeof dbOrAdvisory.prepare === 'function') {
    // Legacy signature: insertAdvisory(db, advisory)
    const db = dbOrAdvisory;
    const advisoryData = advisory!;
    const stmt = db.prepare(`
      INSERT INTO advisories (advisory_id, type, reason, created_at, expires_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      advisoryData.advisory_id,
      advisoryData.type,
      advisoryData.reason,
      advisoryData.created_at,
      advisoryData.expires_at,
      advisoryData.payload_json
    );
    return;
  } else {
    // Modern signature: insertAdvisory(advisory) - async
    const advisoryData = dbOrAdvisory as Partial<AdvisoryRow>;
    return insertAdvisoryPostgreSQL(advisoryData);
  }
}

async function insertAdvisoryPostgreSQL(advisory: Partial<AdvisoryRow>): Promise<void> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  console.log('[insertAdvisory] Inserting advisory:', advisory);
  await pgClient.query(`
    INSERT INTO advisories (advisory_id, type, reason, created_at, expires_at, payload_json)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    advisory.advisory_id,
    advisory.type,
    advisory.reason,
    advisory.created_at,
    advisory.expires_at,
    advisory.payload_json
  ]);
  console.log('[insertAdvisory] Advisory inserted successfully');
}

// Overloaded function signatures for insertAdvisoryTargets
export function insertAdvisoryTargets(db: any, advisoryId: string, targets: Array<{ version_id?: string | null; producer_id?: string | null }>): void;
export function insertAdvisoryTargets(advisoryId: string, targets: Array<{ version_id?: string | null; producer_id?: string | null }>): Promise<void>;
export function insertAdvisoryTargets(dbOrAdvisoryId: any, advisoryIdOrTargets?: string | Array<{ version_id?: string | null; producer_id?: string | null }>, targets?: Array<{ version_id?: string | null; producer_id?: string | null }>): void | Promise<void> {
  // Check if first parameter is a database (has prepare method)
  if (dbOrAdvisoryId && dbOrAdvisoryId.prepare && typeof dbOrAdvisoryId.prepare === 'function') {
    // Legacy signature: insertAdvisoryTargets(db, advisoryId, targets)
    const db = dbOrAdvisoryId;
    const advisoryId = advisoryIdOrTargets as string;
    const targetsData = targets!;

    const stmt = db.prepare(`
      INSERT INTO advisory_targets (advisory_id, version_id, producer_id)
      VALUES (?, ?, ?)
    `);

    for (const target of targetsData) {
      stmt.run(advisoryId, target.version_id, target.producer_id);
    }
    return;
  } else {
    // Modern signature: insertAdvisoryTargets(advisoryId, targets) - async
    const advisoryId = dbOrAdvisoryId as string;
    const targetsData = advisoryIdOrTargets as Array<{ version_id?: string | null; producer_id?: string | null }>;
    return insertAdvisoryTargetsPostgreSQL(advisoryId, targetsData);
  }
}

async function insertAdvisoryTargetsPostgreSQL(advisoryId: string, targets: Array<{ version_id?: string | null; producer_id?: string | null }>): Promise<void> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  console.log('[insertAdvisoryTargets] Inserting targets for advisory:', advisoryId, targets);
  for (const target of targets) {
    await pgClient.query(`
      INSERT INTO advisory_targets (advisory_id, version_id, producer_id)
      VALUES ($1, $2, $3)
    `, [advisoryId, target.version_id, target.producer_id]);
  }
  console.log('[insertAdvisoryTargets] All targets inserted successfully');
}

// Async PostgreSQL advisory functions
export async function listAdvisoriesForVersionActiveAsync(versionId: string, now: number): Promise<AdvisoryRow[]> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const result = await pgClient.query(`
    SELECT a.* FROM advisories a
    JOIN advisory_targets t ON a.advisory_id = t.advisory_id
    WHERE t.version_id = $1 AND (a.expires_at IS NULL OR a.expires_at > $2)
  `, [versionId, now]);

  return result.rows as AdvisoryRow[];
}

export async function listAdvisoriesForProducerActiveAsync(producerId: string, now: number): Promise<AdvisoryRow[]> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const result = await pgClient.query(`
    SELECT a.* FROM advisories a
    JOIN advisory_targets t ON a.advisory_id = t.advisory_id
    WHERE t.producer_id = $1 AND (a.expires_at IS NULL OR a.expires_at > $2)
  `, [producerId, now]);

  return result.rows as AdvisoryRow[];
}

export async function getProducerIdForVersionAsync(versionId: string): Promise<string | null> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const result = await pgClient.query('SELECT producer_id FROM manifests WHERE version_id = $1', [versionId]);
  return result.rows[0]?.producer_id || null;
}

// Legacy sync functions for SQLite compatibility
export function listAdvisoriesForVersionActive(db: any, versionId: string, now: number): AdvisoryRow[] {
  if (!db || typeof db.prepare !== 'function') {
    console.warn('[listAdvisoriesForVersionActive] This function needs to be converted to async for PostgreSQL');
    return [];
  }

  const stmt = db.prepare(`
    SELECT a.* FROM advisories a
    JOIN advisory_targets t ON a.advisory_id = t.advisory_id
    WHERE t.version_id = ? AND (a.expires_at IS NULL OR a.expires_at > ?)
  `);
  return stmt.all(versionId, now) as AdvisoryRow[];
}

export function listAdvisoriesForProducerActive(db: any, producerId: string, now: number): AdvisoryRow[] {
  if (!db || typeof db.prepare !== 'function') {
    console.warn('[listAdvisoriesForProducerActive] This function needs to be converted to async for PostgreSQL');
    return [];
  }

  const stmt = db.prepare(`
    SELECT a.* FROM advisories a
    JOIN advisory_targets t ON a.advisory_id = t.advisory_id
    WHERE t.producer_id = ? AND (a.expires_at IS NULL OR a.expires_at > ?)
  `);
  return stmt.all(producerId, now) as AdvisoryRow[];
}

export function getProducerIdForVersion(db: any, versionId: string): string | null {
  if (!db || typeof db.prepare !== 'function') {
    console.warn('[getProducerIdForVersion] This function needs to be converted to async for PostgreSQL');
    return null;
  }

  const stmt = db.prepare('SELECT producer_id FROM manifests WHERE version_id = ?');
  const result = stmt.get(versionId) as { producer_id?: string } | undefined;
  return result?.producer_id || null;
}

// Pricing functions
export async function getBestUnitPrice(versionId: string, quantity: number, defaultSats: number): Promise<{ satoshis: number; source: string; tier_from?: number }>;
export function getBestUnitPrice(db: any, versionId: string, quantity: number, defaultSats: number): { satoshis: number; source: string; tier_from?: number };
export function getBestUnitPrice(dbOrVersionId: any, versionIdOrQuantity?: string | number, quantityOrDefault?: number, defaultSats2?: number): any {
  // Check if first parameter is a database (has prepare method)
  if (dbOrVersionId && dbOrVersionId.prepare && typeof dbOrVersionId.prepare === 'function') {
    // Legacy signature: getBestUnitPrice(db, versionId, quantity, defaultSats)
    const db = dbOrVersionId;
    const versionId = versionIdOrQuantity as string;
    const quantity = quantityOrDefault!;
    const defaultSats = defaultSats2!;

    // SQLite implementation for tests
    // First check for direct price override in prices table
    const priceStmt = db.prepare('SELECT satoshis FROM prices WHERE version_id = ?');
    const priceResult = priceStmt.get(versionId) as { satoshis: number } | undefined;

    if (priceResult) {
      return { satoshis: priceResult.satoshis, source: 'direct' };
    }

    // Then check price rules
    const ruleStmt = db.prepare(`
      SELECT satoshis, tier_from FROM price_rules
      WHERE (version_id = ? OR producer_id = (SELECT producer_id FROM manifests WHERE version_id = ?))
        AND tier_from <= ?
      ORDER BY tier_from DESC LIMIT 1
    `);
    const ruleResult = ruleStmt.get(versionId, versionId, quantity) as { satoshis: number; tier_from: number } | undefined;

    if (ruleResult) {
      return { satoshis: ruleResult.satoshis, source: 'rule', tier_from: ruleResult.tier_from };
    }

    return { satoshis: defaultSats, source: 'default' };
  } else {
    // Modern signature: getBestUnitPrice(versionId, quantity, defaultSats) - async
    return getBestUnitPricePostgreSQL(dbOrVersionId as string, versionIdOrQuantity as number, quantityOrDefault!);
  }
}

async function getBestUnitPricePostgreSQL(versionId: string, quantity: number, defaultSats: number): Promise<{ satoshis: number; source: string; tier_from?: number }> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  // Priority order: 1. Version rules, 2. Version overrides, 3. Producer rules, 4. Default

  // First check version-specific rules (highest priority)
  const versionRuleResult = await pgClient.query(`
    SELECT satoshis, tier_from FROM price_rules
    WHERE version_id = $1 AND tier_from <= $2
    ORDER BY tier_from DESC LIMIT 1
  `, [versionId, quantity]);

  if (versionRuleResult.rows.length > 0) {
    const row = versionRuleResult.rows[0];
    return { satoshis: row.satoshis, source: 'version-rule', tier_from: row.tier_from };
  }

  // Then check for direct price override in prices table
  const priceResult = await pgClient.query(
    'SELECT satoshis FROM prices WHERE version_id = $1',
    [versionId]
  );

  if (priceResult.rows.length > 0) {
    return { satoshis: priceResult.rows[0].satoshis, source: 'version-override' };
  }

  // Check producer-specific rules
  const producerRuleResult = await pgClient.query(`
    SELECT satoshis, tier_from FROM price_rules
    WHERE producer_id = (SELECT producer_id FROM manifests WHERE version_id = $1) AND tier_from <= $2
    ORDER BY tier_from DESC LIMIT 1
  `, [versionId, quantity]);

  if (producerRuleResult.rows.length > 0) {
    const row = producerRuleResult.rows[0];
    return { satoshis: row.satoshis, source: 'producer-rule', tier_from: row.tier_from };
  }

  return { satoshis: defaultSats, source: 'default' };
}

// Overloaded function declarations for pricing functions
export function upsertPriceRule(db: any, rule: { version_id?: string | null; producer_id?: string | null; tier_from: number; satoshis: number }): void;
export function upsertPriceRule(rule: { version_id?: string; producer_id?: string; tier_from: number; satoshis: number }): Promise<void>;
export function upsertPriceRule(dbOrRule: any, rule?: { version_id?: string | null; producer_id?: string | null; tier_from: number; satoshis: number }): void | Promise<void> {
  if (rule) {
    // SQLite mode: upsertPriceRule(db, rule)
    const now = Date.now();
    const stmt = dbOrRule.prepare(`
      INSERT INTO price_rules (version_id, producer_id, tier_from, satoshis, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (version_id, tier_from)
      DO UPDATE SET satoshis = excluded.satoshis, updated_at = excluded.updated_at
    `);
    stmt.run(rule.version_id, rule.producer_id, rule.tier_from, rule.satoshis, now, now);
  } else {
    // PostgreSQL mode: upsertPriceRule(rule)
    return upsertPriceRulePostgreSQL(dbOrRule);
  }
}

async function upsertPriceRulePostgreSQL(rule: { version_id?: string; producer_id?: string; tier_from: number; satoshis: number }): Promise<void> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const now = Date.now();

  // Choose the correct conflict clause based on which ID is provided
  if (rule.version_id) {
    // Version-specific rule
    await pgClient.query(`
      INSERT INTO price_rules (version_id, producer_id, tier_from, satoshis, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (version_id, tier_from) WHERE version_id IS NOT NULL
      DO UPDATE SET satoshis = EXCLUDED.satoshis, updated_at = EXCLUDED.updated_at
    `, [rule.version_id, rule.producer_id, rule.tier_from, rule.satoshis, now, now]);
  } else if (rule.producer_id) {
    // Producer-specific rule
    await pgClient.query(`
      INSERT INTO price_rules (version_id, producer_id, tier_from, satoshis, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (producer_id, tier_from) WHERE producer_id IS NOT NULL
      DO UPDATE SET satoshis = EXCLUDED.satoshis, updated_at = EXCLUDED.updated_at
    `, [rule.version_id, rule.producer_id, rule.tier_from, rule.satoshis, now, now]);
  } else {
    throw new Error('Either version_id or producer_id must be provided for price rule');
  }
}

// Overloaded function declarations for deletePriceRule
export function deletePriceRule(db: any, params: { version_id?: string; producer_id?: string; tier_from?: number | null }): void;
export function deletePriceRule(versionId?: string, producerId?: string, tierFrom?: number): Promise<void>;
export function deletePriceRule(dbOrVersionId: any, paramsOrProducerId?: { version_id?: string; producer_id?: string; tier_from?: number | null } | string, tierFrom?: number): void | Promise<void> {
  if (typeof dbOrVersionId === 'object' && typeof paramsOrProducerId === 'object') {
    // SQLite mode: deletePriceRule(db, params)
    const db = dbOrVersionId;
    const params = paramsOrProducerId;
    let query = 'DELETE FROM price_rules WHERE 1=1';
    const values: any[] = [];

    if (params.version_id) {
      query += ' AND version_id = ?';
      values.push(params.version_id);
    }
    if (params.producer_id) {
      query += ' AND producer_id = ?';
      values.push(params.producer_id);
    }
    if (params.tier_from !== undefined && params.tier_from !== null) {
      query += ' AND tier_from = ?';
      values.push(params.tier_from);
    }

    const stmt = db.prepare(query);
    stmt.run(...values);
  } else {
    // PostgreSQL mode: deletePriceRule(versionId?, producerId?, tierFrom?)
    return deletePriceRulePostgreSQL(dbOrVersionId, paramsOrProducerId as string, tierFrom);
  }
}

async function deletePriceRulePostgreSQL(versionId?: string, producerId?: string, tierFrom?: number): Promise<void> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  let query = 'DELETE FROM price_rules WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (versionId) {
    query += ` AND version_id = $${paramIndex++}`;
    params.push(versionId);
  }
  if (producerId) {
    query += ` AND producer_id = $${paramIndex++}`;
    params.push(producerId);
  }
  if (tierFrom !== undefined) {
    query += ` AND tier_from = $${paramIndex++}`;
    params.push(tierFrom);
  }

  await pgClient.query(query, params);
}

// Additional functions that need PostgreSQL implementation
export async function listListings(limit = 50, offset = 0): Promise<any[]> {
  const { getPostgreSQLClient } = await import('./postgresql');
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
  const { getHybridDatabase } = await import('./hybrid');
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

// Agent, Rule, and Job management functions - Now using PostgreSQL

export async function listJobs(state?: string, limit = 100, offset = 0): Promise<JobRow[]> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  let query = 'SELECT * FROM jobs';
  const params: any[] = [];
  let paramIndex = 1;

  if (state) {
    query += ` WHERE state = $${paramIndex++}`;
    params.push(state);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(Number(limit) || 100, Number(offset) || 0);

  const result = await pgClient.query(query, params);
  return result.rows as JobRow[];
}

export async function upsertAgent(agent: Partial<any>): Promise<string> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const agentId = agent.agent_id || `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  await pgClient.query(`
    INSERT INTO agents (
      agent_id, name, capabilities_json, webhook_url, identity_key,
      status, last_ping_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (agent_id) DO UPDATE SET
      name = EXCLUDED.name,
      capabilities_json = EXCLUDED.capabilities_json,
      webhook_url = EXCLUDED.webhook_url,
      identity_key = EXCLUDED.identity_key,
      status = EXCLUDED.status,
      last_ping_at = EXCLUDED.last_ping_at,
      updated_at = EXCLUDED.updated_at
  `, [
    agentId,
    agent.name,
    agent.capabilities_json || '[]',
    agent.webhook_url,
    agent.identity_key,
    agent.status || 'unknown',
    agent.last_ping_at,
    agent.created_at || now,
    now
  ]);

  return agentId;
}

export async function getAgent(agentId: string): Promise<any> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();
  return await pgClient.queryOne('SELECT * FROM agents WHERE agent_id = $1', [agentId]);
}

export async function searchAgents(q?: string, capability?: string, limit = 50, offset = 0): Promise<any[]> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  let query = 'SELECT * FROM agents WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (q) {
    query += ` AND (name LIKE $${paramIndex++} OR agent_id LIKE $${paramIndex++})`;
    params.push(`%${q}%`, `%${q}%`);
  }

  if (capability) {
    query += ` AND capabilities_json LIKE $${paramIndex++}`;
    params.push(`%${capability}%`);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  const result = await pgClient.query(query, params);
  return result.rows;
}

export async function setAgentPing(agentId: string, success: boolean): Promise<void> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const status = success ? 'up' : 'down';
  const now = Date.now();

  await pgClient.query(`
    UPDATE agents
    SET status = $1, last_ping_at = $2, updated_at = $3
    WHERE agent_id = $4
  `, [status, now, now, agentId]);
}

// Rule management functions using PostgreSQL
export async function createRule(rule: Partial<RuleRow>): Promise<string> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const ruleId = rule.rule_id || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  await pgClient.query(`
    INSERT INTO rules (
      rule_id, name, enabled, when_json, find_json, actions_json,
      owner_producer_id, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    ruleId,
    rule.name,
    rule.enabled !== false ? 1 : 0,
    rule.when_json || '{}',
    rule.find_json || '{}',
    rule.actions_json || '[]',
    rule.owner_producer_id,
    rule.created_at || now,
    now
  ]);

  return ruleId;
}

export async function getRule(ruleId: string): Promise<RuleRow | null> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const result = await pgClient.query('SELECT * FROM rules WHERE rule_id = $1', [ruleId]);
  return result.rows.length > 0 ? result.rows[0] as RuleRow : null;
}

export async function listRules(enabled?: boolean): Promise<RuleRow[]> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  let query = 'SELECT * FROM rules';
  const params: any[] = [];

  if (enabled !== undefined) {
    query += ' WHERE enabled = $1';
    params.push(enabled ? 1 : 0);
  }

  query += ' ORDER BY created_at DESC';

  const result = await pgClient.query(query, params);
  return result.rows as RuleRow[];
}

export async function updateRule(ruleId: string, updates: Partial<RuleRow>): Promise<RuleRow | null> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const setClauses = [];
  const params = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    params.push(updates.name);
  }
  if (updates.enabled !== undefined) {
    setClauses.push(`enabled = $${paramIndex++}`);
    params.push(updates.enabled ? 1 : 0);
  }
  if (updates.when_json !== undefined) {
    setClauses.push(`when_json = $${paramIndex++}`);
    params.push(updates.when_json);
  }
  if (updates.find_json !== undefined) {
    setClauses.push(`find_json = $${paramIndex++}`);
    params.push(updates.find_json);
  }
  if (updates.actions_json !== undefined) {
    setClauses.push(`actions_json = $${paramIndex++}`);
    params.push(updates.actions_json);
  }

  if (setClauses.length === 0) {
    return null;
  }

  setClauses.push(`updated_at = $${paramIndex++}`);
  params.push(Date.now());
  params.push(ruleId);

  const query = `
    UPDATE rules SET ${setClauses.join(', ')}
    WHERE rule_id = $${paramIndex}
    RETURNING *
  `;

  const result = await pgClient.query(query, params);
  return result.rows[0] || null;
}

export async function deleteRule(ruleId: string): Promise<boolean> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const result = await pgClient.query('DELETE FROM rules WHERE rule_id = $1', [ruleId]);
  return result.rowCount > 0;
}

// Job management functions using PostgreSQL
export async function listJobsByRule(ruleId: string, state?: string, limit = 100, offset = 0): Promise<JobRow[]> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  let query = 'SELECT * FROM jobs WHERE rule_id = $1';
  const params: any[] = [ruleId];
  let paramIndex = 2;

  if (state) {
    query += ` AND state = $${paramIndex++}`;
    params.push(state);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(Number(limit) || 100, Number(offset) || 0);

  const result = await pgClient.query(query, params);
  return result.rows as JobRow[];
}

// Template management functions using PostgreSQL
export async function createTemplate(template: Partial<ContractTemplateRow>): Promise<string> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const templateId = template.template_id || `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  await pgClient.query(`
    INSERT INTO contract_templates (
      template_id, name, description, template_content, template_type,
      variables_json, owner_producer_id, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    templateId,
    template.name,
    template.description,
    template.template_content,
    template.template_type || 'pdf',
    template.variables_json,
    template.owner_producer_id,
    template.created_at || now,
    now
  ]);

  return templateId;
}

export async function getTemplate(templateId: string): Promise<ContractTemplateRow | null> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();
  return await pgClient.queryOne('SELECT * FROM contract_templates WHERE template_id = $1', [templateId]);
}

export async function listTemplates(limit = 100, offset = 0): Promise<ContractTemplateRow[]> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const result = await pgClient.query(`
    SELECT * FROM contract_templates
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  return result.rows as ContractTemplateRow[];
}

export async function updateTemplate(templateId: string, updates: Partial<ContractTemplateRow>): Promise<ContractTemplateRow | null> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const setClauses = [];
  const params = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    params.push(updates.description);
  }
  if (updates.template_content !== undefined) {
    setClauses.push(`template_content = $${paramIndex++}`);
    params.push(updates.template_content);
  }
  if (updates.template_type !== undefined) {
    setClauses.push(`template_type = $${paramIndex++}`);
    params.push(updates.template_type);
  }
  if (updates.variables_json !== undefined) {
    setClauses.push(`variables_json = $${paramIndex++}`);
    params.push(updates.variables_json);
  }

  if (setClauses.length === 0) {
    return null;
  }

  setClauses.push(`updated_at = $${paramIndex++}`);
  params.push(Date.now());
  params.push(templateId);

  const query = `
    UPDATE contract_templates SET ${setClauses.join(', ')}
    WHERE template_id = $${paramIndex}
    RETURNING *
  `;

  const result = await pgClient.query(query, params);
  return result.rows[0] || null;
}

export async function deleteTemplate(templateId: string): Promise<boolean> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();

  const result = await pgClient.query('DELETE FROM contract_templates WHERE template_id = $1', [templateId]);
  return result.rowCount > 0;
}

// Search and catalog functions
export async function searchManifests(q?: string, limit = 50, offset = 0): Promise<any[]> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.searchAssets({ q, limit, offset });
}

export async function listVersionsByDataset(datasetId: string): Promise<any[]> {
  const { getHybridDatabase } = await import('./hybrid');
  const hybridDb = getHybridDatabase();
  return await hybridDb.searchAssets({ datasetId, limit: 1000, offset: 0 });
}

export async function getParents(versionId: string): Promise<string[]> {
  const { getPostgreSQLClient } = await import('./postgresql');
  const pgClient = getPostgreSQLClient();
  const result = await pgClient.query(
    'SELECT parent_version_id FROM edges WHERE child_version_id = $1',
    [versionId]
  );
  return result.rows.map(row => row.parent_version_id);
}

// Note: All other D24 functions (artifacts, etc.)
// should use the HybridDatabase class methods directly.
// These legacy compatibility functions are kept minimal for backwards compatibility.