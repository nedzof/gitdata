"use strict";
// Modern PostgreSQL/Redis Hybrid Database (D022HR + D011HR)
// Replaces legacy SQLite implementation
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
exports.resetTestDatabase = exports.getTestDatabase = exports.getRedisConnectionTTLs = exports.CacheKeys = exports.closeRedisConnection = exports.getRedisClient = exports.RedisClient = exports.closePostgreSQLConnection = exports.getPostgreSQLClient = exports.PostgreSQLClient = exports.closeHybridDatabase = exports.getHybridDatabase = exports.HybridDatabase = void 0;
exports.initSchema = initSchema;
exports.isTestEnvironment = isTestEnvironment;
exports.closeTestDatabase = closeTestDatabase;
exports.getDatabase = getDatabase;
exports.upsertManifest = upsertManifest;
exports.createManifest = createManifest;
exports.getManifest = getManifest;
exports.upsertProducer = upsertProducer;
exports.getProducerById = getProducerById;
exports.getProducerByDatasetId = getProducerByDatasetId;
exports.replaceEdges = replaceEdges;
exports.setPrice = setPrice;
exports.getPrice = getPrice;
exports.insertReceipt = insertReceipt;
exports.getReceipt = getReceipt;
exports.getRecentReceipts = getRecentReceipts;
exports.setReceiptStatus = setReceiptStatus;
exports.updateReceiptUsage = updateReceiptUsage;
exports.ingestOpenLineageEvent = ingestOpenLineageEvent;
exports.queryLineage = queryLineage;
exports.upsertDeclaration = upsertDeclaration;
exports.getDeclarationByVersion = getDeclarationByVersion;
exports.getDeclarationByTxid = getDeclarationByTxid;
exports.setOpretVout = setOpretVout;
exports.setProofEnvelope = setProofEnvelope;
exports.insertAdvisory = insertAdvisory;
exports.insertAdvisoryTargets = insertAdvisoryTargets;
exports.listAdvisoriesForVersionActiveAsync = listAdvisoriesForVersionActiveAsync;
exports.listAdvisoriesForProducerActiveAsync = listAdvisoriesForProducerActiveAsync;
exports.getProducerIdForVersionAsync = getProducerIdForVersionAsync;
exports.listAdvisoriesForVersionActive = listAdvisoriesForVersionActive;
exports.listAdvisoriesForProducerActive = listAdvisoriesForProducerActive;
exports.getProducerIdForVersion = getProducerIdForVersion;
exports.getBestUnitPrice = getBestUnitPrice;
exports.upsertPriceRule = upsertPriceRule;
exports.deletePriceRule = deletePriceRule;
exports.listListings = listListings;
exports.healthCheck = healthCheck;
exports.getOLDataset = getOLDataset;
exports.getOLRun = getOLRun;
exports.getOLJob = getOLJob;
exports.searchOLDatasets = searchOLDatasets;
exports.listJobs = listJobs;
exports.upsertAgent = upsertAgent;
exports.getAgent = getAgent;
exports.searchAgents = searchAgents;
exports.setAgentPing = setAgentPing;
exports.createRule = createRule;
exports.getRule = getRule;
exports.listRules = listRules;
exports.updateRule = updateRule;
exports.deleteRule = deleteRule;
exports.listJobsByRule = listJobsByRule;
exports.createTemplate = createTemplate;
exports.getTemplate = getTemplate;
exports.listTemplates = listTemplates;
exports.updateTemplate = updateTemplate;
exports.deleteTemplate = deleteTemplate;
exports.searchManifests = searchManifests;
exports.listVersionsByDataset = listVersionsByDataset;
exports.getParents = getParents;
var hybrid_1 = require("./hybrid");
Object.defineProperty(exports, "HybridDatabase", { enumerable: true, get: function () { return hybrid_1.HybridDatabase; } });
Object.defineProperty(exports, "getHybridDatabase", { enumerable: true, get: function () { return hybrid_1.getHybridDatabase; } });
Object.defineProperty(exports, "closeHybridDatabase", { enumerable: true, get: function () { return hybrid_1.closeHybridDatabase; } });
var postgresql_1 = require("./postgresql");
Object.defineProperty(exports, "PostgreSQLClient", { enumerable: true, get: function () { return postgresql_1.PostgreSQLClient; } });
Object.defineProperty(exports, "getPostgreSQLClient", { enumerable: true, get: function () { return postgresql_1.getPostgreSQLClient; } });
Object.defineProperty(exports, "closePostgreSQLConnection", { enumerable: true, get: function () { return postgresql_1.closePostgreSQLConnection; } });
var redis_1 = require("./redis");
Object.defineProperty(exports, "RedisClient", { enumerable: true, get: function () { return redis_1.RedisClient; } });
Object.defineProperty(exports, "getRedisClient", { enumerable: true, get: function () { return redis_1.getRedisClient; } });
Object.defineProperty(exports, "closeRedisConnection", { enumerable: true, get: function () { return redis_1.closeRedisConnection; } });
Object.defineProperty(exports, "CacheKeys", { enumerable: true, get: function () { return redis_1.CacheKeys; } });
Object.defineProperty(exports, "getRedisConnectionTTLs", { enumerable: true, get: function () { return redis_1.getCacheTTLs; } });
// Database initialization
async function initSchema() {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    // Schema is already initialized in PostgreSQL migrations
    return hybridDb;
}
// Test database compatibility functions
var test_setup_1 = require("./test-setup");
Object.defineProperty(exports, "getTestDatabase", { enumerable: true, get: function () { return test_setup_1.getTestDatabase; } });
Object.defineProperty(exports, "resetTestDatabase", { enumerable: true, get: function () { return test_setup_1.resetTestDatabase; } });
// Test environment detection
function isTestEnvironment() {
    return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}
// Close functions for testing
async function closeTestDatabase() {
    // For PostgreSQL/Redis, we don't need to close as they're handled by the connection pools
    return Promise.resolve();
}
// Get database instance with SQLite compatibility layer
function getDatabase() {
    if (isTestEnvironment()) {
        // Return test database with SQLite compatibility
        const { getTestDatabase } = require('./test-setup');
        return getTestDatabase();
    }
    else {
        const { getHybridDatabase } = require('./hybrid');
        return getHybridDatabase();
    }
}
// Helper function to safely execute SQLite queries (deprecated - use PostgreSQL instead)
function executeSQLite(db, sql, params = []) {
    console.warn('[executeSQLite] This function is deprecated - all queries should use PostgreSQL');
    return null;
}
// Modern API functions using the hybrid database
async function upsertManifest(manifest) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.upsertAsset(manifest);
}
async function createManifest(manifest) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    await hybridDb.upsertAsset(manifest);
    return manifest.version_id || '';
}
async function getManifest(versionId) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.getAsset(versionId);
}
async function upsertProducer(producer) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.upsertProducer(producer);
}
async function getProducerById(producerId) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.getProducer(producerId);
}
async function getProducerByDatasetId(datasetId) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    // Get producer_id from manifests table using datasetId
    const result = await pgClient.query('SELECT producer_id FROM assets WHERE dataset_id = $1 LIMIT 1', [datasetId]);
    if (result.rows.length === 0) {
        return null;
    }
    // Get full producer details
    return await getProducerById(result.rows[0].producer_id);
}
async function replaceEdges(child, parents) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.replaceEdges(child, parents);
}
async function setPrice(versionId, satoshis) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.setPrice(versionId, satoshis);
}
async function getPrice(versionId) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.getPrice(versionId);
}
async function insertReceipt(receipt) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.insertReceipt(receipt);
}
async function getReceipt(receiptId) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.getReceipt(receiptId);
}
async function getRecentReceipts(limit = 50, offset = 0) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.getRecentReceipts(limit, offset);
}
async function setReceiptStatus(receiptId, status) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    await pgClient.query('UPDATE overlay_receipts SET status = $1 WHERE receipt_id = $2', [
        status,
        receiptId,
    ]);
}
async function updateReceiptUsage(receiptId, bytesUsed) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    await pgClient.query('UPDATE overlay_receipts SET bytes_used = $1, last_seen = $2 WHERE receipt_id = $3', [bytesUsed, Math.floor(Date.now() / 1000), receiptId]);
}
async function ingestOpenLineageEvent(event) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.ingestOpenLineageEvent(event);
}
async function queryLineage(options) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.queryLineage(options);
}
// Database operations that use PostgreSQL directly
async function upsertDeclaration(row) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const columns = Object.keys(row);
    const values = Object.values(row);
    const placeholders = values.map((_, i) => `$${i + 1}`);
    const updateSet = columns
        .filter((col) => col !== 'version_id')
        .map((col) => `${col} = EXCLUDED.${col}`)
        .join(', ');
    await pgClient.query(`
    INSERT INTO declarations (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (version_id)
    DO UPDATE SET ${updateSet}
  `, values);
}
async function getDeclarationByVersion(versionId) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    return await pgClient.queryOne('SELECT * FROM declarations WHERE version_id = $1', [versionId]);
}
async function getDeclarationByTxid(txid) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    return await pgClient.queryOne('SELECT * FROM declarations WHERE txid = $1', [
        txid,
    ]);
}
async function setOpretVout(versionId, vout) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    await pgClient.query('UPDATE declarations SET opret_vout = $1 WHERE version_id = $2', [
        vout,
        versionId,
    ]);
}
async function setProofEnvelope(versionId, envelopeJson) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    await pgClient.query('UPDATE declarations SET proof_json = $1 WHERE version_id = $2', [
        envelopeJson,
        versionId,
    ]);
}
function insertAdvisory(dbOrAdvisory, advisory) {
    // Check if first parameter is a database (has prepare method) or an advisory
    if (dbOrAdvisory && dbOrAdvisory.prepare && typeof dbOrAdvisory.prepare === 'function') {
        // Legacy signature: insertAdvisory(db, advisory)
        const db = dbOrAdvisory;
        const advisoryData = advisory;
        const stmt = db.prepare(`
      INSERT INTO advisories (advisory_id, type, reason, created_at, expires_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(advisoryData.advisory_id, advisoryData.type, advisoryData.reason, advisoryData.created_at, advisoryData.expires_at, advisoryData.payload_json);
        return;
    }
    else {
        // Modern signature: insertAdvisory(advisory) - async
        const advisoryData = dbOrAdvisory;
        return insertAdvisoryPostgreSQL(advisoryData);
    }
}
async function insertAdvisoryPostgreSQL(advisory) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
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
        advisory.payload_json,
    ]);
    console.log('[insertAdvisory] Advisory inserted successfully');
}
function insertAdvisoryTargets(dbOrAdvisoryId, advisoryIdOrTargets, targets) {
    // Check if first parameter is a database (has prepare method)
    if (dbOrAdvisoryId && dbOrAdvisoryId.prepare && typeof dbOrAdvisoryId.prepare === 'function') {
        // Legacy signature: insertAdvisoryTargets(db, advisoryId, targets)
        const db = dbOrAdvisoryId;
        const advisoryId = advisoryIdOrTargets;
        const targetsData = targets;
        const stmt = db.prepare(`
      INSERT INTO advisory_targets (advisory_id, version_id, producer_id)
      VALUES (?, ?, ?)
    `);
        for (const target of targetsData) {
            stmt.run(advisoryId, target.version_id, target.producer_id);
        }
        return;
    }
    else {
        // Modern signature: insertAdvisoryTargets(advisoryId, targets) - async
        const advisoryId = dbOrAdvisoryId;
        const targetsData = advisoryIdOrTargets;
        return insertAdvisoryTargetsPostgreSQL(advisoryId, targetsData);
    }
}
async function insertAdvisoryTargetsPostgreSQL(advisoryId, targets) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
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
async function listAdvisoriesForVersionActiveAsync(versionId, now) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query(`
    SELECT a.* FROM advisories a
    JOIN advisory_targets t ON a.advisory_id = t.advisory_id
    WHERE t.version_id = $1 AND (a.expires_at IS NULL OR a.expires_at > $2)
  `, [versionId, now]);
    return result.rows;
}
async function listAdvisoriesForProducerActiveAsync(producerId, now) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query(`
    SELECT a.* FROM advisories a
    JOIN advisory_targets t ON a.advisory_id = t.advisory_id
    WHERE t.producer_id = $1 AND (a.expires_at IS NULL OR a.expires_at > $2)
  `, [producerId, now]);
    return result.rows;
}
async function getProducerIdForVersionAsync(versionId) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query('SELECT producer_id FROM assets WHERE version_id = $1', [
        versionId,
    ]);
    return result.rows[0]?.producer_id || null;
}
// Legacy sync functions for SQLite compatibility
function listAdvisoriesForVersionActive(db, versionId, now) {
    if (!db || typeof db.prepare !== 'function') {
        console.warn('[listAdvisoriesForVersionActive] This function needs to be converted to async for PostgreSQL');
        return [];
    }
    const stmt = db.prepare(`
    SELECT a.* FROM advisories a
    JOIN advisory_targets t ON a.advisory_id = t.advisory_id
    WHERE t.version_id = ? AND (a.expires_at IS NULL OR a.expires_at > ?)
  `);
    return stmt.all(versionId, now);
}
function listAdvisoriesForProducerActive(db, producerId, now) {
    if (!db || typeof db.prepare !== 'function') {
        console.warn('[listAdvisoriesForProducerActive] This function needs to be converted to async for PostgreSQL');
        return [];
    }
    const stmt = db.prepare(`
    SELECT a.* FROM advisories a
    JOIN advisory_targets t ON a.advisory_id = t.advisory_id
    WHERE t.producer_id = ? AND (a.expires_at IS NULL OR a.expires_at > ?)
  `);
    return stmt.all(producerId, now);
}
function getProducerIdForVersion(db, versionId) {
    if (!db || typeof db.prepare !== 'function') {
        console.warn('[getProducerIdForVersion] This function needs to be converted to async for PostgreSQL');
        return null;
    }
    const stmt = db.prepare('SELECT producer_id FROM assets WHERE version_id = ?');
    const result = stmt.get(versionId);
    return result?.producer_id || null;
}
function getBestUnitPrice(dbOrVersionId, versionIdOrQuantity, quantityOrDefault, defaultSats2) {
    // Check if first parameter is a database (has prepare method)
    if (dbOrVersionId && dbOrVersionId.prepare && typeof dbOrVersionId.prepare === 'function') {
        // Legacy signature: getBestUnitPrice(db, versionId, quantity, defaultSats)
        const db = dbOrVersionId;
        const versionId = versionIdOrQuantity;
        const quantity = quantityOrDefault;
        const defaultSats = defaultSats2;
        // SQLite implementation for tests
        // First check for direct price override in prices table
        const priceStmt = db.prepare('SELECT satoshis FROM prices WHERE version_id = ?');
        const priceResult = priceStmt.get(versionId);
        if (priceResult) {
            return { satoshis: priceResult.satoshis, source: 'direct' };
        }
        // Then check price rules
        const ruleStmt = db.prepare(`
      SELECT satoshis, tier_from FROM price_rules
      WHERE (version_id = ? OR producer_id = (SELECT producer_id FROM assets WHERE version_id = ?))
        AND tier_from <= ?
      ORDER BY tier_from DESC LIMIT 1
    `);
        const ruleResult = ruleStmt.get(versionId, versionId, quantity);
        if (ruleResult) {
            return { satoshis: ruleResult.satoshis, source: 'rule', tier_from: ruleResult.tier_from };
        }
        return { satoshis: defaultSats, source: 'default' };
    }
    else {
        // Modern signature: getBestUnitPrice(versionId, quantity, defaultSats) - async
        return getBestUnitPricePostgreSQL(dbOrVersionId, versionIdOrQuantity, quantityOrDefault);
    }
}
async function getBestUnitPricePostgreSQL(versionId, quantity, defaultSats) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
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
    const priceResult = await pgClient.query('SELECT satoshis FROM prices WHERE version_id = $1', [
        versionId,
    ]);
    if (priceResult.rows.length > 0) {
        return { satoshis: priceResult.rows[0].satoshis, source: 'version-override' };
    }
    // Check producer-specific rules
    const producerRuleResult = await pgClient.query(`
    SELECT satoshis, tier_from FROM price_rules
    WHERE producer_id = (SELECT producer_id FROM assets WHERE version_id = $1) AND tier_from <= $2
    ORDER BY tier_from DESC LIMIT 1
  `, [versionId, quantity]);
    if (producerRuleResult.rows.length > 0) {
        const row = producerRuleResult.rows[0];
        return { satoshis: row.satoshis, source: 'producer-rule', tier_from: row.tier_from };
    }
    return { satoshis: defaultSats, source: 'default' };
}
function upsertPriceRule(dbOrRule, rule) {
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
    }
    else {
        // PostgreSQL mode: upsertPriceRule(rule)
        return upsertPriceRulePostgreSQL(dbOrRule);
    }
}
async function upsertPriceRulePostgreSQL(rule) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
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
    }
    else if (rule.producer_id) {
        // Producer-specific rule
        await pgClient.query(`
      INSERT INTO price_rules (version_id, producer_id, tier_from, satoshis, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (producer_id, tier_from) WHERE producer_id IS NOT NULL
      DO UPDATE SET satoshis = EXCLUDED.satoshis, updated_at = EXCLUDED.updated_at
    `, [rule.version_id, rule.producer_id, rule.tier_from, rule.satoshis, now, now]);
    }
    else {
        throw new Error('Either version_id or producer_id must be provided for price rule');
    }
}
function deletePriceRule(dbOrVersionId, paramsOrProducerId, tierFrom) {
    if (typeof dbOrVersionId === 'object' && typeof paramsOrProducerId === 'object') {
        // SQLite mode: deletePriceRule(db, params)
        const db = dbOrVersionId;
        const params = paramsOrProducerId;
        let query = 'DELETE FROM price_rules WHERE 1=1';
        const values = [];
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
    }
    else {
        // PostgreSQL mode: deletePriceRule(versionId?, producerId?, tierFrom?)
        return deletePriceRulePostgreSQL(dbOrVersionId, paramsOrProducerId, tierFrom);
    }
}
async function deletePriceRulePostgreSQL(versionId, producerId, tierFrom) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    let query = 'DELETE FROM price_rules WHERE 1=1';
    const params = [];
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
async function listListings(limit = 50, offset = 0) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
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
    FROM assets m
    LEFT JOIN declarations d ON d.version_id = m.version_id
    LEFT JOIN producers p ON p.producer_id = m.producer_id
    ORDER BY d.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
    return result.rows;
}
// Health check function
async function healthCheck() {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.healthCheck();
}
// OpenLineage stub functions for compatibility (TODO: implement fully)
async function getOLDataset(namespace, name) {
    // TODO: Implement OpenLineage dataset retrieval
    return null;
}
async function getOLRun(namespace, runId) {
    // TODO: Implement OpenLineage run retrieval
    return null;
}
async function getOLJob(namespace, name) {
    // TODO: Implement OpenLineage job retrieval
    return null;
}
async function searchOLDatasets(namespace, query) {
    // TODO: Implement OpenLineage dataset search
    return [];
}
// Agent, Rule, and Job management functions - Now using PostgreSQL
async function listJobs(state, limit = 100, offset = 0) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    let query = 'SELECT * FROM jobs';
    const params = [];
    let paramIndex = 1;
    if (state) {
        query += ` WHERE state = $${paramIndex++}`;
        params.push(state);
    }
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit) || 100, Number(offset) || 0);
    const result = await pgClient.query(query, params);
    return result.rows;
}
async function upsertAgent(agent) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
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
        now,
    ]);
    return agentId;
}
async function getAgent(agentId) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    return await pgClient.queryOne('SELECT * FROM agents WHERE agent_id = $1', [agentId]);
}
async function searchAgents(q, capability, limit = 50, offset = 0) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    let query = 'SELECT * FROM agents WHERE 1=1';
    const params = [];
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
async function setAgentPing(agentId, success) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
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
async function createRule(rule) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
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
        rule.enabled ? 1 : 0,
        rule.when_json || '{}',
        rule.find_json || '{}',
        rule.actions_json || '[]',
        rule.owner_producer_id,
        rule.created_at || now,
        now,
    ]);
    return ruleId;
}
async function getRule(ruleId) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query('SELECT * FROM rules WHERE rule_id = $1', [ruleId]);
    return result.rows.length > 0 ? result.rows[0] : null;
}
async function listRules(enabled) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    let query = 'SELECT * FROM rules';
    const params = [];
    if (enabled !== undefined) {
        query += ' WHERE enabled = $1';
        params.push(enabled ? 1 : 0);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pgClient.query(query, params);
    return result.rows;
}
async function updateRule(ruleId, updates) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
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
async function deleteRule(ruleId) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query('DELETE FROM rules WHERE rule_id = $1', [ruleId]);
    return result.rowCount > 0;
}
// Job management functions using PostgreSQL
async function listJobsByRule(ruleId, state, limit = 100, offset = 0) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    let query = 'SELECT * FROM jobs WHERE rule_id = $1';
    const params = [ruleId];
    let paramIndex = 2;
    if (state) {
        query += ` AND state = $${paramIndex++}`;
        params.push(state);
    }
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit) || 100, Number(offset) || 0);
    const result = await pgClient.query(query, params);
    return result.rows;
}
// Template management functions using PostgreSQL
async function createTemplate(template) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const now = new Date(); // agent_templates uses timestamp, not integer
    const result = await pgClient.query(`
    INSERT INTO agent_templates (
      template_name, template_config, created_at
    ) VALUES ($1, $2, $3)
    RETURNING template_id
  `, [
        template.name,
        JSON.stringify({
            description: template.description,
            content: template.template_content,
            type: template.template_type || 'pdf',
            variables: template.variables_json ? JSON.parse(template.variables_json) : null,
            owner_producer_id: template.owner_producer_id,
        }),
        now,
    ]);
    return result.rows[0].template_id;
}
async function getTemplate(templateId) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.queryOne('SELECT * FROM agent_templates WHERE template_id = $1', [
        templateId,
    ]);
    if (!result)
        return null;
    // Map the agent_templates structure back to the expected ContractTemplateRow format
    // template_config is JSONB which is already parsed by PostgreSQL client
    const config = result.template_config || {};
    return {
        template_id: result.template_id,
        name: result.template_name,
        description: config.description,
        template_content: config.content,
        template_type: config.type || 'pdf',
        variables_json: config.variables ? JSON.stringify(config.variables) : null,
        owner_producer_id: config.owner_producer_id,
        created_at: result.created_at,
        updated_at: result.created_at, // agent_templates doesn't have updated_at, use created_at
    };
}
async function listTemplates(limit = 100, offset = 0) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query(`
    SELECT * FROM agent_templates
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
    // Map agent_templates structure to ContractTemplateRow format
    return result.rows.map((row) => {
        // template_config is JSONB which is already parsed by PostgreSQL client
        const config = row.template_config || {};
        return {
            template_id: row.template_id,
            name: row.template_name,
            description: config.description,
            template_content: config.content,
            template_type: config.type || 'pdf',
            variables_json: config.variables ? JSON.stringify(config.variables) : null,
            owner_producer_id: config.owner_producer_id,
            created_at: row.created_at,
            updated_at: row.created_at,
        };
    });
}
async function updateTemplate(templateId, updates) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
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
    // Since agent_templates structure is different, we need to rebuild the entire config
    // Get current template first
    const current = await getTemplate(templateId);
    if (!current)
        return null;
    const updatedConfig = {
        description: updates.description !== undefined ? updates.description : current.description,
        content: updates.template_content !== undefined ? updates.template_content : current.template_content,
        type: updates.template_type !== undefined ? updates.template_type : current.template_type,
        variables: updates.variables_json !== undefined
            ? JSON.parse(updates.variables_json)
            : JSON.parse(current.variables_json || 'null'),
        owner_producer_id: updates.owner_producer_id !== undefined
            ? updates.owner_producer_id
            : current.owner_producer_id,
    };
    const query = `
    UPDATE agent_templates
    SET template_name = $1, template_config = $2
    WHERE template_id = $3
    RETURNING *
  `;
    const result = await pgClient.query(query, [
        updates.name !== undefined ? updates.name : current.name,
        JSON.stringify(updatedConfig),
        templateId,
    ]);
    if (result.rows.length === 0)
        return null;
    // Map back to ContractTemplateRow format
    const row = result.rows[0];
    // template_config is JSONB which is already parsed by PostgreSQL client
    const config = row.template_config;
    return {
        template_id: row.template_id,
        name: row.template_name,
        description: config.description,
        template_content: config.content,
        template_type: config.type,
        variables_json: config.variables ? JSON.stringify(config.variables) : null,
        owner_producer_id: config.owner_producer_id,
        created_at: row.created_at,
        updated_at: row.created_at,
    };
}
async function deleteTemplate(templateId) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query('DELETE FROM agent_templates WHERE template_id = $1', [
        templateId,
    ]);
    return result.rowCount > 0;
}
// Search and catalog functions
async function searchManifests(q, limit = 50, offset = 0) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.searchAssets({ q, limit, offset });
}
async function listVersionsByDataset(datasetId) {
    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('./hybrid')));
    const hybridDb = getHybridDatabase();
    return await hybridDb.searchAssets({ datasetId, limit: 1000, offset: 0 });
}
async function getParents(versionId) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('./postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query('SELECT parent_version_id FROM edges WHERE child_version_id = $1', [versionId]);
    return result.rows.map((row) => row.parent_version_id);
}
// Note: All other D24 functions (artifacts, etc.)
// should use the HybridDatabase class methods directly.
// These legacy compatibility functions are kept minimal for backwards compatibility.
//# sourceMappingURL=index.js.map