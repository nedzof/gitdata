/*
  D28 — Policy Filters & Readiness Governance

  Comprehensive policy evaluation system for versionId-based readiness decisions.
  Supports allow/warn/block decisions with detailed reason codes and evidence.
*/

import type { Router, Request, Response } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';

// Environment configuration
const POLICY_PREVIEW_ENABLE = process.env.POLICY_PREVIEW_ENABLE === 'true';
const POLICY_PREVIEW_TTL_SEC = Number(process.env.POLICY_PREVIEW_TTL_SEC || 30);
const POLICY_DEFAULT_ID = process.env.POLICY_DEFAULT_ID || 'pol_default';
const POLICY_HEAVY_CHECKS_ENABLE = process.env.POLICY_HEAVY_CHECKS_ENABLE !== 'false';

// Types
export interface PolicyJSON {
  // SPV & Trust
  minConfs?: number;
  allowRecalled?: boolean;

  // Provenance
  classificationAllowList?: string[];
  producerAllowList?: string[];
  producerBlockList?: string[];
  maxLineageDepth?: number;
  requiredAncestor?: string;

  // Content & Schema
  requiredSchemaHash?: string;
  requiredMimeTypes?: string[];
  requiredOntologyTags?: string[];

  // Compliance
  licenseAllowList?: string[];
  piiFlagsBlockList?: string[];
  geoOriginAllowList?: string[];

  // Economics
  maxPricePerByte?: number;
  maxTotalCostForLineage?: number;
  maxDataAgeSeconds?: number;
  minProducerUptime?: number;
  requiresBillingAccount?: boolean;

  // Quality & Profiling
  minRowCount?: number;
  maxRowCount?: number;
  maxNullValuePercentage?: number;
  requiredDistributionProfileHash?: string;
  maxOutlierScore?: number;
  minUniquenessRatio?: number;

  // MLOps
  requiredFeatureSetId?: string;
  requiresValidSplit?: boolean;
  maxBiasScore?: number;
  maxDriftScore?: number;
  requiredParentModelId?: string;

  // Security
  blockIfInThreatFeed?: boolean;
  minAnonymizationLevel?: {
    type: 'k-anon' | 'dp';
    k?: number;
    epsilon?: number;
  };
}

export interface PolicyDecision {
  decision: 'allow' | 'warn' | 'block';
  reasons: string[];
  warnings?: string[];
  evidence: Record<string, any>;
}

interface PolicyRow {
  policy_id: string;
  name: string;
  enabled: number;
  policy_json: string;
  created_at: number;
  updated_at: number;
}

// Database migrations
export function runPolicyMigrations(db: Database.Database) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS policies (
      policy_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      policy_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_policies_created ON policies(created_at)`).run();
}

// Database helpers
function createPolicy(db: Database.Database, data: Partial<PolicyRow>): string {
  const id = data.policy_id || `pol_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO policies (policy_id, name, enabled, policy_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.enabled || 1, data.policy_json, now, now);

  return id;
}

function getPolicy(db: Database.Database, id: string): PolicyRow | undefined {
  return db.prepare(`SELECT * FROM policies WHERE policy_id = ?`).get(id) as PolicyRow | undefined;
}

function listPolicies(db: Database.Database, enabled?: boolean, limit = 50, offset = 0): PolicyRow[] {
  const where = enabled !== undefined ? 'WHERE enabled = ?' : '';
  const params = enabled !== undefined ? [enabled ? 1 : 0, limit, offset] : [limit, offset];

  return db.prepare(`
    SELECT * FROM policies ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params) as PolicyRow[];
}

function updatePolicy(db: Database.Database, id: string, updates: Partial<PolicyRow>) {
  const now = Math.floor(Date.now() / 1000);
  const fields = Object.keys(updates).filter(k => k !== 'policy_id' && k !== 'created_at')
    .map(k => `${k} = ?`).join(', ');
  const values = Object.keys(updates).filter(k => k !== 'policy_id' && k !== 'created_at')
    .map(k => updates[k as keyof PolicyRow]);

  values.push(now); // updated_at
  values.push(id);  // WHERE policy_id

  db.prepare(`UPDATE policies SET ${fields}, updated_at = ? WHERE policy_id = ?`).run(...values);
}

function deletePolicy(db: Database.Database, id: string) {
  db.prepare(`DELETE FROM policies WHERE policy_id = ?`).run(id);
}

// Policy evaluation logic
export async function evaluatePolicy(
  versionId: string,
  policy: PolicyJSON,
  manifest?: any,
  lineage?: any[],
  externalData?: Record<string, any>
): Promise<PolicyDecision> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const evidence: Record<string, any> = {};
  let decision: 'allow' | 'warn' | 'block' = 'allow';

  // Helper to upgrade decision severity
  const setDecision = (newDecision: 'allow' | 'warn' | 'block', reason: string) => {
    if (newDecision === 'block' || (newDecision === 'warn' && decision === 'allow')) {
      decision = newDecision;
    }
    if (newDecision === 'block') {
      reasons.push(reason);
    } else if (newDecision === 'warn') {
      warnings.push(reason);
    }
  };

  // 1. SPV & Trust Checks
  if (policy.minConfs !== undefined) {
    const confs = manifest?.confirmations || 0;
    evidence.confirmations = confs;
    if (confs < policy.minConfs) {
      setDecision('block', 'POLICY.SPV.CONFS_TOO_LOW');
    }
  }

  if (policy.allowRecalled === false && manifest?.recalled) {
    evidence.recalled = true;
    setDecision('block', 'POLICY.SPV.RECALLED_BLOCKED');
  }

  // 2. Provenance & Lineage
  if (policy.classificationAllowList && manifest?.policy?.classification) {
    const classification = manifest.policy.classification;
    evidence.classification = classification;
    if (!policy.classificationAllowList.includes(classification)) {
      setDecision('block', 'POLICY.PROVENANCE.CLASSIFICATION_NOT_ALLOWED');
    }
  }

  if (policy.producerAllowList && manifest?.provenance?.producer?.identityKey) {
    const producerKey = manifest.provenance.producer.identityKey;
    evidence.producerKey = producerKey;
    if (!policy.producerAllowList.includes(producerKey)) {
      setDecision('block', 'POLICY.PRODUCER.NOT_ALLOWED');
    }
  }

  if (policy.producerBlockList && manifest?.provenance?.producer?.identityKey) {
    const producerKey = manifest.provenance.producer.identityKey;
    evidence.producerKey = producerKey;
    if (policy.producerBlockList.includes(producerKey)) {
      setDecision('block', 'POLICY.PRODUCER.BLOCK_LISTED');
    }
  }

  if (policy.maxLineageDepth !== undefined && lineage) {
    evidence.lineageDepth = lineage.length;
    if (lineage.length > policy.maxLineageDepth) {
      setDecision('block', 'POLICY.LINEAGE.TOO_DEEP');
    }
  }

  if (policy.requiredAncestor && lineage) {
    const hasAncestor = lineage.some(item => item.versionId === policy.requiredAncestor);
    evidence.hasRequiredAncestor = hasAncestor;
    if (!hasAncestor) {
      setDecision('block', 'POLICY.LINEAGE.MISSING_ANCESTOR');
    }
  }

  // 3. Content & Schema
  if (policy.requiredSchemaHash && manifest?.content?.schemaHash) {
    const schemaHash = manifest.content.schemaHash;
    evidence.schemaHash = schemaHash;
    if (schemaHash !== policy.requiredSchemaHash) {
      setDecision('block', 'POLICY.CONTENT.SCHEMA_MISMATCH');
    }
  }

  if (policy.requiredMimeTypes && manifest?.content?.mimeType) {
    const mimeType = manifest.content.mimeType;
    evidence.mimeType = mimeType;
    if (!policy.requiredMimeTypes.includes(mimeType)) {
      setDecision('block', 'POLICY.CONTENT.MIME_NOT_ALLOWED');
    }
  }

  if (policy.requiredOntologyTags && manifest?.ontologyTags) {
    const tags = manifest.ontologyTags;
    evidence.ontologyTags = tags;
    const hasAllTags = policy.requiredOntologyTags.every(tag => tags.includes(tag));
    if (!hasAllTags) {
      setDecision('block', 'POLICY.CONTENT.TAGS_MISSING');
    }
  }

  // 4. Compliance
  if (policy.licenseAllowList && manifest?.policy?.license) {
    const license = manifest.policy.license;
    evidence.license = license;
    if (!policy.licenseAllowList.includes(license)) {
      setDecision('block', 'POLICY.COMPLIANCE.LICENSE_NOT_ALLOWED');
    }
  }

  if (policy.piiFlagsBlockList && manifest?.piiFlags) {
    const piiFlags = manifest.piiFlags;
    evidence.piiFlags = piiFlags;
    const hasBlockedFlag = policy.piiFlagsBlockList.some(flag => piiFlags.includes(flag));
    if (hasBlockedFlag) {
      setDecision('block', 'POLICY.COMPLIANCE.PII_BLOCKED');
    }
  }

  if (policy.geoOriginAllowList && manifest?.geoOrigin) {
    const geoOrigin = manifest.geoOrigin;
    evidence.geoOrigin = geoOrigin;
    if (!policy.geoOriginAllowList.includes(geoOrigin)) {
      setDecision('block', 'POLICY.COMPLIANCE.GEO_NOT_ALLOWED');
    }
  }

  // 5. Economics
  if (policy.maxPricePerByte !== undefined && manifest?.pricing) {
    const pricePerByte = manifest.pricing.pricePerByte || 0;
    evidence.pricePerByte = pricePerByte;
    if (pricePerByte > policy.maxPricePerByte) {
      setDecision('block', 'POLICY.ECON.PRICE_PER_BYTE_EXCEEDED');
    }
  }

  if (policy.maxDataAgeSeconds !== undefined && manifest?.provenance?.createdAt) {
    const createdAt = new Date(manifest.provenance.createdAt).getTime();
    const ageSeconds = (Date.now() - createdAt) / 1000;
    evidence.dataAgeSeconds = ageSeconds;
    if (ageSeconds > policy.maxDataAgeSeconds) {
      setDecision('block', 'POLICY.ECON.DATA_TOO_OLD');
    }
  }

  if (policy.minProducerUptime !== undefined && externalData?.uptime) {
    const uptime = externalData.uptime;
    evidence.producerUptime = uptime;
    if (uptime < policy.minProducerUptime) {
      setDecision('warn', 'POLICY.ECON.UPTIME_TOO_LOW');
    }
  }

  // 6. Quality & Profiling
  if (policy.minRowCount !== undefined && manifest?.stats?.rowCount) {
    const rowCount = manifest.stats.rowCount;
    evidence.rowCount = rowCount;
    if (rowCount < policy.minRowCount) {
      setDecision('block', 'POLICY.QA.ROWS_TOO_FEW');
    }
  }

  if (policy.maxRowCount !== undefined && manifest?.stats?.rowCount) {
    const rowCount = manifest.stats.rowCount;
    evidence.rowCount = rowCount;
    if (rowCount > policy.maxRowCount) {
      setDecision('block', 'POLICY.QA.ROWS_TOO_MANY');
    }
  }

  if (policy.maxNullValuePercentage !== undefined && manifest?.stats?.nullPercentage) {
    const nullPercent = manifest.stats.nullPercentage;
    evidence.nullPercentage = nullPercent;
    if (nullPercent > policy.maxNullValuePercentage) {
      setDecision('warn', 'POLICY.QA.NULL_PERCENT_EXCEEDED');
    }
  }

  // 7. MLOps
  if (policy.requiredFeatureSetId && manifest?.featureSetId) {
    const featureSetId = manifest.featureSetId;
    evidence.featureSetId = featureSetId;
    if (featureSetId !== policy.requiredFeatureSetId) {
      setDecision('block', 'POLICY.MLOPS.FEATURE_SET_MISSING');
    }
  }

  if (policy.requiresValidSplit && manifest?.splitTag) {
    const splitTag = manifest.splitTag;
    evidence.splitTag = splitTag;
    const validSplits = ['train', 'val', 'test'];
    if (!validSplits.includes(splitTag)) {
      setDecision('block', 'POLICY.MLOPS.SPLIT_INVALID');
    }
  }

  // 8. Security
  if (policy.blockIfInThreatFeed && externalData?.threatFeedMatch) {
    evidence.threatFeedMatch = true;
    setDecision('block', 'POLICY.SEC.THREAT_FEED_BLOCK');
  }

  return {
    decision,
    reasons,
    warnings,
    evidence
  };
}

// Mock external data sources for demo
async function getExternalData(versionId: string): Promise<Record<string, any>> {
  // In production, these would call external services
  return {
    uptime: 99.5 + Math.random() * 0.5,
    threatFeedMatch: Math.random() < 0.01, // 1% chance of threat match
    pricing: {
      pricePerByte: Math.random() * 0.1
    }
  };
}

// Mock manifest/lineage data for demo
function getMockManifest(versionId: string): any {
  const manifests = {
    'md_a1b2c3d4e5f6789012345678': {
      confirmations: 15,
      recalled: false,
      policy: { classification: 'public', license: 'MIT' },
      provenance: {
        producer: { identityKey: 'test-producer-key' },
        createdAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      content: {
        mimeType: 'application/x-pytorch',
        schemaHash: 'abc123def456'
      },
      stats: { rowCount: 1000000, nullPercentage: 0.5 },
      featureSetId: 'test-features-v1',
      splitTag: 'train',
      piiFlags: [],
      geoOrigin: 'US'
    }
  };

  return manifests[versionId] || {
    confirmations: 10,
    recalled: false,
    policy: { classification: 'public', license: 'Apache-2.0' },
    provenance: {
      producer: { identityKey: 'demo-producer' },
      createdAt: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
    },
    content: { mimeType: 'application/json' },
    stats: { rowCount: 500000, nullPercentage: 1.2 },
    piiFlags: [],
    geoOrigin: 'EU'
  };
}

function getMockLineage(versionId: string): any[] {
  return [
    { versionId: 'parent_dataset_v1', type: 'dataset' },
    { versionId: versionId, type: 'model' }
  ];
}

// Default policies
const DEFAULT_POLICIES = {
  'pol_default': {
    name: 'Default Policy',
    policy: {
      minConfs: 6,
      allowRecalled: false,
      classificationAllowList: ['public', 'internal'],
      licenseAllowList: ['MIT', 'Apache-2.0', 'GPL-3.0', 'CC-BY-4.0'],
      maxLineageDepth: 10,
      maxDataAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      minProducerUptime: 95.0
    }
  },
  'pol_strict_banking': {
    name: 'Strict Banking Policy',
    policy: {
      minConfs: 12,
      classificationAllowList: ['restricted'],
      allowRecalled: false,
      producerAllowList: ['internal-fraud-department-key', 'verified-partner-feed-key'],
      requiredAncestor: 'Q1-2024-AUDITED-TRANSACTIONS',
      licenseAllowList: ['Internal-Banking-Use-Only'],
      piiFlagsBlockList: ['has_customer_name', 'has_address'],
      geoOriginAllowList: ['EU'],
      maxPricePerByte: 0.5,
      maxTotalCostForLineage: 250000,
      maxDataAgeSeconds: 3600,
      minProducerUptime: 99.9,
      requiresBillingAccount: true,
      minRowCount: 1000000,
      maxNullValuePercentage: 1.0,
      blockIfInThreatFeed: true,
      minAnonymizationLevel: { type: 'k-anon', k: 5 }
    }
  },
  'pol_ml_research': {
    name: 'ML Research Policy',
    policy: {
      minConfs: 3,
      classificationAllowList: ['public', 'academic'],
      licenseAllowList: ['MIT', 'Apache-2.0', 'CC-BY-4.0'],
      requiredFeatureSetId: 'research-features-v2',
      requiresValidSplit: true,
      maxBiasScore: 0.3,
      maxDriftScore: 0.2,
      minRowCount: 10000,
      maxNullValuePercentage: 5.0
    }
  }
};

// Bootstrap default policies
function bootstrapDefaultPolicies(db: Database.Database) {
  const existing = listPolicies(db, true, 1, 0);
  if (existing.length === 0) {
    for (const [id, config] of Object.entries(DEFAULT_POLICIES)) {
      createPolicy(db, {
        policy_id: id,
        name: config.name,
        enabled: 1,
        policy_json: JSON.stringify(config.policy)
      });
    }
  }
}

// Router implementation
export function policiesRouter(db: Database.Database): Router {
  const router = makeRouter();

  // Bootstrap on first use
  bootstrapDefaultPolicies(db);

  // POST /policies (create policy)
  router.post('/', (req: Request, res: Response) => {
    try {
      const { name, enabled = true, policy } = req.body;

      if (!name || !policy) {
        return res.status(400).json({
          error: 'bad-request',
          hint: 'name and policy required'
        });
      }

      // Validate policy JSON
      try {
        JSON.stringify(policy);
      } catch (e) {
        return res.status(400).json({
          error: 'invalid-policy-json',
          hint: 'policy must be valid JSON object'
        });
      }

      const policyId = createPolicy(db, {
        name,
        enabled: enabled ? 1 : 0,
        policy_json: JSON.stringify(policy)
      });

      res.json({ status: 'ok', policyId });
    } catch (error) {
      res.status(500).json({
        error: 'create-policy-failed',
        message: error.message
      });
    }
  });

  // GET /policies (list policies)
  router.get('/', (req: Request, res: Response) => {
    const enabled = req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined;
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;

    const policies = listPolicies(db, enabled, limit, offset);
    const items = policies.map(p => ({
      policyId: p.policy_id,
      name: p.name,
      enabled: !!p.enabled,
      policy: JSON.parse(p.policy_json),
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));

    res.json({ items });
  });

  // GET /policies/:id (get policy)
  router.get('/:id', (req: Request, res: Response) => {
    const policy = getPolicy(db, req.params.id);
    if (!policy) {
      return res.status(404).json({ error: 'not-found' });
    }

    res.json({
      policyId: policy.policy_id,
      name: policy.name,
      enabled: !!policy.enabled,
      policy: JSON.parse(policy.policy_json),
      createdAt: policy.created_at,
      updatedAt: policy.updated_at
    });
  });

  // PATCH /policies/:id (update policy)
  router.patch('/:id', (req: Request, res: Response) => {
    try {
      const existing = getPolicy(db, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'not-found' });
      }

      const updates: Partial<PolicyRow> = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.enabled !== undefined) updates.enabled = req.body.enabled ? 1 : 0;
      if (req.body.policy !== undefined) {
        try {
          updates.policy_json = JSON.stringify(req.body.policy);
        } catch (e) {
          return res.status(400).json({
            error: 'invalid-policy-json',
            hint: 'policy must be valid JSON object'
          });
        }
      }

      updatePolicy(db, req.params.id, updates);
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({
        error: 'update-policy-failed',
        message: error.message
      });
    }
  });

  // DELETE /policies/:id (delete policy)
  router.delete('/:id', (req: Request, res: Response) => {
    deletePolicy(db, req.params.id);
    res.json({ status: 'ok' });
  });

  // POST /policies/evaluate (evaluate policy)
  router.post('/evaluate', async (req: Request, res: Response) => {
    try {
      const { versionId, policy, policyId } = req.body;

      if (!versionId) {
        return res.status(400).json({
          error: 'bad-request',
          hint: 'versionId required'
        });
      }

      let policyToEvaluate: PolicyJSON;

      if (policyId) {
        const policyRow = getPolicy(db, policyId);
        if (!policyRow || !policyRow.enabled) {
          return res.status(404).json({ error: 'policy-not-found' });
        }
        policyToEvaluate = JSON.parse(policyRow.policy_json);
      } else if (policy) {
        policyToEvaluate = policy;
      } else {
        return res.status(400).json({
          error: 'bad-request',
          hint: 'policy or policyId required'
        });
      }

      // Get mock data (in production, these would call real services)
      const manifest = getMockManifest(versionId);
      const lineage = getMockLineage(versionId);
      const externalData = await getExternalData(versionId);

      const decision = await evaluatePolicy(
        versionId,
        policyToEvaluate,
        manifest,
        lineage,
        externalData
      );

      res.json(decision);
    } catch (error) {
      res.status(500).json({
        error: 'evaluation-failed',
        message: error.message
      });
    }
  });

  return router;
}

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}