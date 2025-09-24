"use strict";
/*
  D22 Storage Lifecycle Management

  Implements automated storage tiering and lifecycle policies:
  - Hot tier: Fast access, high cost (recent/popular content)
  - Warm tier: Moderate access, medium cost (older content)
  - Cold tier: Archive, low cost (rarely accessed content)

  Lifecycle Rules:
  1. Auto-tier based on access patterns and age
  2. Cost optimization through intelligent placement
  3. Cleanup of expired/orphaned content
  4. Performance monitoring and optimization

  Usage:
    const lifecycle = new StorageLifecycleManager(storage, db);
    await lifecycle.runTieringJob();
    await lifecycle.cleanupExpiredContent();
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
exports.StorageLifecycleManager = void 0;
exports.createStorageEventsMigration = createStorageEventsMigration;
//import { StorageDriver, StorageTier, StorageObject } from './index';
const index_js_1 = require("../db/index.js");
class StorageLifecycleManager {
    constructor(storage, db, config) {
        this.storage = storage;
        this.db = db;
        this.config = {
            hotToWarmAfterDays: Number(process.env.HOT_TO_WARM_DAYS || 7),
            warmToColdAfterDays: Number(process.env.WARM_TO_COLD_DAYS || 30),
            hotMinAccessesPerDay: Number(process.env.HOT_MIN_ACCESSES_DAY || 5),
            warmMinAccessesPerWeek: Number(process.env.WARM_MIN_ACCESSES_WEEK || 2),
            deleteAfterDays: Number(process.env.DELETE_AFTER_DAYS || 365),
            orphanCleanupEnabled: process.env.ORPHAN_CLEANUP === 'true',
            maxObjectsPerBatch: Number(process.env.LIFECYCLE_BATCH_SIZE || 100),
            tieringIntervalHours: Number(process.env.TIERING_INTERVAL_HOURS || 6),
            ...config,
        };
    }
    async runTieringJob() {
        console.log('Starting storage tiering job...');
        const metrics = await this.collectAccessMetrics();
        const decisions = this.analyzeTieringDecisions(metrics);
        let moved = 0;
        let skipped = 0;
        let errors = 0;
        // Sort by priority (highest first)
        decisions.sort((a, b) => b.priority - a.priority);
        for (const decision of decisions.slice(0, this.config.maxObjectsPerBatch)) {
            try {
                await this.executeTieringDecision(decision);
                await this.logTieringEvent(decision, 'success');
                moved++;
                console.log(`Moved ${decision.contentHash} from ${decision.fromTier} to ${decision.toTier}: ${decision.reason}`);
            }
            catch (error) {
                await this.logTieringEvent(decision, 'error', error);
                console.error(`Failed to tier ${decision.contentHash}:`, error);
                errors++;
            }
        }
        skipped = decisions.length - moved - errors;
        console.log(`Tiering job completed: ${moved} moved, ${skipped} skipped, ${errors} errors`);
        return { moved, skipped, errors };
    }
    async cleanupExpiredContent() {
        console.log('Starting expired content cleanup...');
        const cutoffDate = new Date(Date.now() - this.config.deleteAfterDays * 24 * 60 * 60 * 1000);
        // Find expired content across all tiers
        const expiredObjects = await this.findExpiredObjects(cutoffDate);
        let deleted = 0;
        let errors = 0;
        for (const obj of expiredObjects) {
            try {
                // Verify object is truly orphaned before deletion
                if (this.config.orphanCleanupEnabled && (await this.isOrphanedObject(obj.contentHash))) {
                    await this.storage.deleteObject(obj.contentHash, obj.tier);
                    await this.logDeletionEvent(obj, 'expired-orphaned');
                    deleted++;
                    console.log(`Deleted expired orphaned object: ${obj.contentHash} (${obj.tier})`);
                }
            }
            catch (error) {
                console.error(`Failed to delete ${obj.contentHash}:`, error);
                errors++;
            }
        }
        console.log(`Cleanup completed: ${deleted} deleted, ${errors} errors`);
        return { deleted, errors };
    }
    async collectAccessMetrics() {
        // Query access patterns from database
        const query = `
      SELECT
        m.content_hash,
        m.created_at,
        COALESCE(SUM(r.bytes_used), 0) as total_bytes,
        COUNT(CASE WHEN r.last_seen > datetime('now', '-1 day') THEN 1 END) as access_24h,
        COUNT(CASE WHEN r.last_seen > datetime('now', '-7 days') THEN 1 END) as access_7d,
        COUNT(CASE WHEN r.last_seen > datetime('now', '-30 days') THEN 1 END) as access_30d,
        MAX(r.last_seen) as last_accessed
      FROM assets m
      LEFT JOIN receipts r ON m.version_id = r.version_id
      WHERE m.content_hash IS NOT NULL
      GROUP BY m.content_hash, m.created_at
    `;
        const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
        const pgClient = getPostgreSQLClient();
        const result = await pgClient.query(`
      SELECT
        m.content_hash,
        m.created_at,
        COALESCE(SUM(r.bytes_used), 0) as total_bytes,
        COUNT(CASE WHEN r.last_seen > NOW() - INTERVAL '1 day' THEN 1 END) as access_24h,
        COUNT(CASE WHEN r.last_seen > NOW() - INTERVAL '7 days' THEN 1 END) as access_7d,
        COUNT(CASE WHEN r.last_seen > NOW() - INTERVAL '30 days' THEN 1 END) as access_30d,
        MAX(r.last_seen) as last_accessed
      FROM assets m
      LEFT JOIN receipts r ON m.version_id = r.version_id
      WHERE m.content_hash IS NOT NULL
      GROUP BY m.content_hash, m.created_at
    `);
        const rows = result.rows;
        const metrics = [];
        for (const row of rows) {
            // Determine current tier by checking which tier has the object
            let currentTier = 'hot';
            for (const tier of ['hot', 'warm', 'cold']) {
                if (await this.storage.objectExists(row.content_hash, tier)) {
                    currentTier = tier;
                    break;
                }
            }
            metrics.push({
                contentHash: row.content_hash,
                currentTier,
                lastAccessed: new Date(row.last_accessed || row.created_at),
                accessCount24h: row.access_24h || 0,
                accessCount7d: row.access_7d || 0,
                accessCount30d: row.access_30d || 0,
                totalSize: row.total_bytes || 0,
                createdAt: new Date(row.created_at),
            });
        }
        return metrics;
    }
    analyzeTieringDecisions(metrics) {
        const decisions = [];
        const now = new Date();
        for (const metric of metrics) {
            const ageInDays = (now.getTime() - metric.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            const daysSinceAccess = (now.getTime() - metric.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
            let targetTier = null;
            let reason = '';
            let priority = 0;
            let estimatedSavings = 0;
            // Hot → Warm tier logic
            if (metric.currentTier === 'hot') {
                if (ageInDays > this.config.hotToWarmAfterDays &&
                    metric.accessCount24h < this.config.hotMinAccessesPerDay) {
                    targetTier = 'warm';
                    reason = `Age ${ageInDays.toFixed(1)}d > ${this.config.hotToWarmAfterDays}d, low access (${metric.accessCount24h}/day)`;
                    priority = Math.floor(ageInDays);
                    estimatedSavings = metric.totalSize * 0.5; // Assume 50% cost reduction
                }
            }
            // Warm → Cold tier logic
            if (metric.currentTier === 'warm') {
                if (ageInDays > this.config.warmToColdAfterDays &&
                    metric.accessCount7d < this.config.warmMinAccessesPerWeek) {
                    targetTier = 'cold';
                    reason = `Age ${ageInDays.toFixed(1)}d > ${this.config.warmToColdAfterDays}d, very low access (${metric.accessCount7d}/week)`;
                    priority = Math.floor(ageInDays / 2);
                    estimatedSavings = metric.totalSize * 0.8; // Assume 80% cost reduction
                }
            }
            // Cold → Warm promotion (high access)
            if (metric.currentTier === 'cold' &&
                metric.accessCount7d >= this.config.warmMinAccessesPerWeek) {
                targetTier = 'warm';
                reason = `High access pattern detected (${metric.accessCount7d}/week)`;
                priority = 100 + metric.accessCount7d; // High priority for promotions
                estimatedSavings = -metric.totalSize * 0.3; // Cost increase but performance gain
            }
            // Warm → Hot promotion (very high access)
            if (metric.currentTier === 'warm' &&
                metric.accessCount24h >= this.config.hotMinAccessesPerDay) {
                targetTier = 'hot';
                reason = `Very high access pattern detected (${metric.accessCount24h}/day)`;
                priority = 150 + metric.accessCount24h; // Highest priority for hot promotions
                estimatedSavings = -metric.totalSize * 0.5; // Cost increase but best performance
            }
            if (targetTier && targetTier !== metric.currentTier) {
                decisions.push({
                    contentHash: metric.contentHash,
                    fromTier: metric.currentTier,
                    toTier: targetTier,
                    reason,
                    priority,
                    estimatedSavings,
                });
            }
        }
        return decisions;
    }
    async executeTieringDecision(decision) {
        await this.storage.moveObject(decision.contentHash, decision.fromTier, decision.toTier);
    }
    async findExpiredObjects(cutoffDate) {
        const expiredObjects = [];
        // Check each tier for old objects
        for (const tier of ['hot', 'warm', 'cold']) {
            try {
                const objects = await this.storage.listObjects(tier);
                for (const obj of objects) {
                    if (obj.lastModified && obj.lastModified < cutoffDate) {
                        expiredObjects.push({
                            contentHash: obj.contentHash,
                            tier,
                        });
                    }
                }
            }
            catch (error) {
                console.warn(`Failed to list objects in ${tier} tier:`, error);
            }
        }
        return expiredObjects;
    }
    async isOrphanedObject(contentHash) {
        // Check if object is referenced by any active manifest
        let manifestCount;
        const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
        const pgClient = getPostgreSQLClient();
        const result = await pgClient.query(`SELECT COUNT(*) as count FROM assets WHERE content_hash = $1`, [contentHash]);
        manifestCount = result.rows[0];
        return manifestCount.count === 0;
    }
    async logTieringEvent(decision, status, error) {
        try {
            const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
            const pgClient = getPostgreSQLClient();
            await pgClient.query(`
        INSERT INTO storage_events (
          event_type, content_hash, from_tier, to_tier,
          reason, status, error_message, estimated_savings, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
                'tiering',
                decision.contentHash,
                decision.fromTier,
                decision.toTier,
                decision.reason,
                status,
                error ? String(error) : null,
                decision.estimatedSavings || 0,
                Date.now(),
            ]);
        }
        catch {
            // Ignore logging errors
        }
    }
    async logDeletionEvent(obj, reason) {
        try {
            const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
            const pgClient = getPostgreSQLClient();
            await pgClient.query(`
        INSERT INTO storage_events (
          event_type, content_hash, from_tier, reason, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, ['deletion', obj.contentHash, obj.tier, reason, 'success', Date.now()]);
        }
        catch {
            // Ignore logging errors
        }
    }
    async getStorageStats() {
        const tierBreakdown = {
            hot: { objectCount: 0, totalSize: 0 },
            warm: { objectCount: 0, totalSize: 0 },
            cold: { objectCount: 0, totalSize: 0 },
        };
        // Collect current tier statistics
        for (const tier of ['hot', 'warm', 'cold']) {
            try {
                const objects = await this.storage.listObjects(tier);
                tierBreakdown[tier] = {
                    objectCount: objects.length,
                    totalSize: objects.reduce((sum, obj) => sum + (obj.size || 0), 0),
                };
            }
            catch (error) {
                console.warn(`Failed to get stats for ${tier} tier:`, error);
            }
        }
        // Get recent move activity (last 24 hours)
        const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
        const pgClient = getPostgreSQLClient();
        const recentResult = await pgClient.query(`
      SELECT COUNT(*) as count
      FROM storage_events
      WHERE event_type = 'tiering'
        AND status = 'success'
        AND created_at > $1
    `, [Date.now() - 24 * 60 * 60 * 1000]);
        const recentMoves = recentResult.rows[0];
        const savingsResult = await pgClient.query(`
      SELECT COALESCE(SUM(estimated_savings), 0) as savings
      FROM storage_events
      WHERE event_type = 'tiering'
        AND status = 'success'
        AND created_at > $1
    `, [Date.now() - 30 * 24 * 60 * 60 * 1000]);
        const monthlySavings = savingsResult.rows[0];
        return {
            tierBreakdown,
            recentMoves: recentMoves.count,
            estimatedMonthlySavings: monthlySavings.savings,
        };
    }
}
exports.StorageLifecycleManager = StorageLifecycleManager;
// Migration for storage events table
async function createStorageEventsMigration(db) {
    try {
        if ((0, index_js_1.isTestEnvironment)() || db) {
            const database = db;
            database.exec(`
        CREATE TABLE IF NOT EXISTS storage_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          from_tier TEXT,
          to_tier TEXT,
          reason TEXT,
          status TEXT NOT NULL,
          error_message TEXT,
          estimated_savings REAL DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_storage_events_content_hash ON storage_events(content_hash);
        CREATE INDEX IF NOT EXISTS idx_storage_events_created_at ON storage_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_storage_events_type_status ON storage_events(event_type, status);
      `);
        }
        else {
            const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
            const pgClient = getPostgreSQLClient();
            await pgClient.query(`
        CREATE TABLE IF NOT EXISTS storage_events (
          id SERIAL PRIMARY KEY,
          event_type TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          from_tier TEXT,
          to_tier TEXT,
          reason TEXT,
          status TEXT NOT NULL,
          error_message TEXT,
          estimated_savings REAL DEFAULT 0,
          created_at BIGINT NOT NULL
        )
      `);
            await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_storage_events_content_hash ON storage_events(content_hash)`);
            await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_storage_events_created_at ON storage_events(created_at)`);
            await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_storage_events_type_status ON storage_events(event_type, status)`);
        }
    }
    catch (error) {
        console.warn('Failed to create storage_events table:', error);
    }
}
//# sourceMappingURL=lifecycle.js.map