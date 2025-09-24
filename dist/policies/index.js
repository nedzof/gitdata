"use strict";
/*
  D28 — Policy Filters & Readiness Governance

  Comprehensive policy evaluation system for versionId-based readiness decisions.
  Supports allow/warn/block decisions with detailed reason codes and evidence.
*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPolicyMigrations = runPolicyMigrations;
exports.evaluatePolicy = evaluatePolicy;
exports.policiesRouter = policiesRouter;
const express_1 = require("express");
//import { getDatabase, isTestEnvironment } from '../db/index.js';
// Environment configuration
const POLICY_PREVIEW_ENABLE = process.env.POLICY_PREVIEW_ENABLE === 'true';
const POLICY_PREVIEW_TTL_SEC = Number(process.env.POLICY_PREVIEW_TTL_SEC || 30);
const POLICY_DEFAULT_ID = process.env.POLICY_DEFAULT_ID || 'pol_default';
const POLICY_HEAVY_CHECKS_ENABLE = process.env.POLICY_HEAVY_CHECKS_ENABLE !== 'false';
// Database migrations
async function runPolicyMigrations(db) {
    if (isTestEnvironment() || db) {
        const database = db || getDatabase();
        database
            .prepare(`
      CREATE TABLE IF NOT EXISTS policies (
        policy_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        policy_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
            .run();
        database.prepare(`CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled)`).run();
        database
            .prepare(`CREATE INDEX IF NOT EXISTS idx_policies_created ON policies(created_at)`)
            .run();
    }
    else {
        const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
        const pgClient = getPostgreSQLClient();
        await pgClient.query(`
      CREATE TABLE IF NOT EXISTS policies (
        policy_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        policy_json TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `);
        await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled)`);
        await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_policies_created ON policies(created_at)`);
    }
}
// Database helpers
async function createPolicy(db, data) {
    const id = data.policy_id || `pol_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
    const now = Math.floor(Date.now() / 1000);
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    await pgClient.query(`INSERT INTO policies (policy_id, name, enabled, policy_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`, [id, data.name, data.enabled || 1, data.policy_json, now, now]);
    return id;
}
async function getPolicy(db, id) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query(`SELECT * FROM policies WHERE policy_id = $1`, [id]);
    return result.rows[0];
}
async function listPolicies(db, enabled, limit = 50, offset = 0) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    if (enabled !== undefined) {
        const result = await pgClient.query(`SELECT * FROM policies WHERE enabled = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`, [enabled ? 1 : 0, limit, offset]);
        return result.rows;
    }
    else {
        const result = await pgClient.query(`SELECT * FROM policies
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`, [limit, offset]);
        return result.rows;
    }
}
async function updatePolicy(db, id, updates) {
    const now = Math.floor(Date.now() / 1000);
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    const fields = Object.keys(updates).filter((k) => k !== 'policy_id' && k !== 'created_at');
    const setClause = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = fields.map((k) => updates[k]);
    values.push(now); // updated_at
    values.push(id); // WHERE policy_id
    await pgClient.query(`UPDATE policies SET ${setClause}, updated_at = $${values.length - 1} WHERE policy_id = $${values.length}`, values);
}
async function deletePolicy(db, id) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    await pgClient.query(`DELETE FROM policies WHERE policy_id = $1`, [id]);
}
// Policy evaluation logic
async function evaluatePolicy(versionId, policy, manifest, lineage, externalData) {
    const reasons = [];
    const warnings = [];
    const evidence = {};
    let decision = 'allow';
    // Helper to upgrade decision severity
    const setDecision = (newDecision, reason) => {
        if (newDecision === 'block' || (newDecision === 'warn' && decision === 'allow')) {
            decision = newDecision;
        }
        if (newDecision === 'block') {
            reasons.push(reason);
        }
        else if (newDecision === 'warn') {
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
        const hasAncestor = lineage.some((item) => item.versionId === policy.requiredAncestor);
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
        const hasAllTags = policy.requiredOntologyTags.every((tag) => tags.includes(tag));
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
    // 6. Quality & Profiling (limited for unstructured data)
    if (policy.maxRowCount !== undefined && manifest?.stats?.rowCount) {
        const rowCount = manifest.stats.rowCount;
        evidence.rowCount = rowCount;
        if (rowCount > policy.maxRowCount) {
            setDecision('block', 'POLICY.QA.ROWS_TOO_MANY');
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
    // 8. Security
    if (policy.blockIfInThreatFeed && externalData?.threatFeedMatch) {
        evidence.threatFeedMatch = true;
        setDecision('block', 'POLICY.SEC.THREAT_FEED_BLOCK');
    }
    return {
        decision,
        reasons,
        warnings,
        evidence,
    };
}
// Mock external data sources for demo
async function getExternalData(versionId) {
    // In production, these would call external services
    return {
        uptime: 99.5 + Math.random() * 0.5,
        threatFeedMatch: Math.random() < 0.01, // 1% chance of threat match
        pricing: {
            pricePerByte: Math.random() * 0.1,
        },
    };
}
// Mock manifest/lineage data for demo
function getMockManifest(versionId) {
    const manifests = {
        md_a1b2c3d4e5f6789012345678: {
            confirmations: 15,
            recalled: false,
            policy: { classification: 'public', license: 'MIT' },
            provenance: {
                producer: { identityKey: 'test-producer-key' },
                createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            },
            content: {
                mimeType: 'application/x-pytorch',
                schemaHash: 'abc123def456',
            },
            stats: { rowCount: 1000000, nullPercentage: 0.5 },
            featureSetId: 'test-features-v1',
            splitTag: 'train',
            piiFlags: [],
            geoOrigin: 'US',
        },
    };
    return (manifests[versionId] || {
        confirmations: 10,
        recalled: false,
        policy: { classification: 'public', license: 'Apache-2.0' },
        provenance: {
            producer: { identityKey: 'demo-producer' },
            createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        },
        content: { mimeType: 'application/json' },
        stats: { rowCount: 500000, nullPercentage: 1.2 },
        piiFlags: [],
        geoOrigin: 'EU',
    });
}
function getMockLineage(versionId) {
    return [
        { versionId: 'parent_dataset_v1', type: 'dataset' },
        { versionId: versionId, type: 'model' },
    ];
}
// Default policies
const DEFAULT_POLICIES = {
    pol_default: {
        name: 'Default Policy (Unstructured Data)',
        policy: {
            minConfs: 6,
            allowRecalled: false,
            classificationAllowList: ['public', 'internal'],
            licenseAllowList: ['MIT', 'Apache-2.0', 'GPL-3.0', 'CC-BY-4.0'],
            maxLineageDepth: 10,
            maxDataAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
    },
    pol_strict_banking: {
        name: 'Strict Banking Policy (Documents)',
        policy: {
            minConfs: 12,
            classificationAllowList: ['restricted'],
            allowRecalled: false,
            producerAllowList: ['internal-fraud-department-key', 'verified-partner-feed-key'],
            requiredAncestor: 'Q1-2024-AUDITED-TRANSACTIONS',
            licenseAllowList: ['Internal-Banking-Use-Only'],
            geoOriginAllowList: ['EU'],
            maxPricePerByte: 0.5,
            maxTotalCostForLineage: 250000,
            maxDataAgeSeconds: 3600,
            blockIfInThreatFeed: true,
        },
    },
    pol_content_general: {
        name: 'General Content Policy (Media & Documents)',
        policy: {
            minConfs: 3,
            classificationAllowList: ['public', 'academic'],
            licenseAllowList: ['MIT', 'Apache-2.0', 'CC-BY-4.0'],
            requiredFeatureSetId: 'content-features-v1',
            maxPricePerByte: 2.0,
            maxDataAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
    },
};
// Bootstrap default policies
async function bootstrapDefaultPolicies(db) {
    const existing = await listPolicies(db, true, 1, 0);
    if (existing.length === 0) {
        for (const [id, config] of Object.entries(DEFAULT_POLICIES)) {
            await createPolicy(db, {
                policy_id: id,
                name: config.name,
                enabled: 1,
                policy_json: JSON.stringify(config.policy),
            });
        }
    }
}
// Router implementation
function policiesRouter(db) {
    const router = (0, express_1.Router)();
    // Bootstrap on first use (async - don't wait)
    bootstrapDefaultPolicies(db).catch(console.warn);
    // POST /policies (create policy)
    router.post('/', async (req, res) => {
        try {
            const { name, enabled = true, policy } = req.body;
            if (!name || !policy) {
                return res.status(400).json({
                    error: 'bad-request',
                    hint: 'name and policy required',
                });
            }
            // Validate policy JSON
            try {
                JSON.stringify(policy);
            }
            catch (e) {
                return res.status(400).json({
                    error: 'invalid-policy-json',
                    hint: 'policy must be valid JSON object',
                });
            }
            const policyId = await createPolicy(db, {
                name,
                enabled: enabled ? 1 : 0,
                policy_json: JSON.stringify(policy),
            });
            res.json({ status: 'ok', policyId });
        }
        catch (error) {
            res.status(500).json({
                error: 'create-policy-failed',
                message: error.message,
            });
        }
    });
    // GET /policies (list policies)
    router.get('/', async (req, res) => {
        const enabled = req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined;
        const limit = Number(req.query.limit) || 50;
        const offset = Number(req.query.offset) || 0;
        const policies = await listPolicies(db, enabled, limit, offset);
        const items = policies.map((p) => ({
            policyId: p.policy_id,
            name: p.name,
            enabled: !!p.enabled,
            policy: JSON.parse(p.policy_json),
            createdAt: p.created_at,
            updatedAt: p.updated_at,
        }));
        res.json({ items });
    });
    // GET /policies/:id (get policy)
    router.get('/:id', async (req, res) => {
        const policy = await getPolicy(db, req.params.id);
        if (!policy) {
            return res.status(404).json({ error: 'not-found' });
        }
        res.json({
            policyId: policy.policy_id,
            name: policy.name,
            enabled: !!policy.enabled,
            policy: JSON.parse(policy.policy_json),
            createdAt: policy.created_at,
            updatedAt: policy.updated_at,
        });
    });
    // PATCH /policies/:id (update policy)
    router.patch('/:id', async (req, res) => {
        try {
            const existing = await getPolicy(db, req.params.id);
            if (!existing) {
                return res.status(404).json({ error: 'not-found' });
            }
            const updates = {};
            if (req.body.name !== undefined)
                updates.name = req.body.name;
            if (req.body.enabled !== undefined)
                updates.enabled = req.body.enabled ? 1 : 0;
            if (req.body.policy !== undefined) {
                try {
                    updates.policy_json = JSON.stringify(req.body.policy);
                }
                catch (e) {
                    return res.status(400).json({
                        error: 'invalid-policy-json',
                        hint: 'policy must be valid JSON object',
                    });
                }
            }
            await updatePolicy(db, req.params.id, updates);
            res.json({ status: 'ok' });
        }
        catch (error) {
            res.status(500).json({
                error: 'update-policy-failed',
                message: error.message,
            });
        }
    });
    // DELETE /policies/:id (delete policy)
    router.delete('/:id', async (req, res) => {
        await deletePolicy(db, req.params.id);
        res.json({ status: 'ok' });
    });
    // POST /policies/evaluate (evaluate policy)
    router.post('/evaluate', async (req, res) => {
        try {
            const { versionId, policy, policyId } = req.body;
            if (!versionId) {
                return res.status(400).json({
                    error: 'bad-request',
                    hint: 'versionId required',
                });
            }
            let policyToEvaluate;
            if (policyId) {
                const policyRow = await getPolicy(db, policyId);
                if (!policyRow || !policyRow.enabled) {
                    return res.status(404).json({ error: 'policy-not-found' });
                }
                policyToEvaluate = JSON.parse(policyRow.policy_json);
            }
            else if (policy) {
                policyToEvaluate = policy;
            }
            else {
                return res.status(400).json({
                    error: 'bad-request',
                    hint: 'policy or policyId required',
                });
            }
            // Get mock data (in production, these would call real services)
            const manifest = getMockManifest(versionId);
            const lineage = getMockLineage(versionId);
            const externalData = await getExternalData(versionId);
            const decision = await evaluatePolicy(versionId, policyToEvaluate, manifest, lineage, externalData);
            res.json(decision);
        }
        catch (error) {
            res.status(500).json({
                error: 'evaluation-failed',
                message: error.message,
            });
        }
    });
    return router;
}
function json(res, code, body) {
    return res.status(code).json(body);
}
//# sourceMappingURL=index.js.map