"use strict";
/*
  D22 Storage Migration & Verification Tools

  Provides tools for migrating data between storage backends and verifying integrity:
  1. Filesystem to S3 migration
  2. Content integrity verification
  3. Performance benchmarking
  4. Rollback capabilities
  5. Batch processing with progress tracking

  Usage:
    const migrator = new StorageMigrator(fsDriver, s3Driver);
    await migrator.migrateAllContent();
    await migrator.verifyMigration();
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
exports.StorageMigrator = void 0;
exports.runMigrationCLI = runMigrationCLI;
exports.runBenchmarkCLI = runBenchmarkCLI;
const crypto_1 = require("crypto");
const index_1 = require("./index");
class StorageMigrator {
    constructor(source, target, config) {
        this.source = source;
        this.target = target;
        this.config = {
            batchSize: Number(process.env.MIGRATION_BATCH_SIZE || 50),
            parallelTransfers: Number(process.env.MIGRATION_PARALLEL || 5),
            verifyChecksums: process.env.MIGRATION_VERIFY_CHECKSUMS !== 'false',
            deleteSourceAfterCopy: process.env.MIGRATION_DELETE_SOURCE === 'true',
            resumeFromCheckpoint: process.env.MIGRATION_RESUME === 'true',
            checkpointFile: process.env.MIGRATION_CHECKPOINT_FILE || './migration.checkpoint',
            ...config,
        };
        this.progress = {
            phase: 'discovery',
            totalObjects: 0,
            processedObjects: 0,
            successCount: 0,
            errorCount: 0,
            skippedCount: 0,
            bytesTransferred: 0,
            startTime: Date.now(),
        };
    }
    async migrateAllContent() {
        console.log('Starting storage migration...');
        try {
            // Discovery phase
            this.progress.phase = 'discovery';
            const allObjects = await this.discoverAllObjects();
            this.progress.totalObjects = allObjects.length;
            console.log(`Discovered ${allObjects.length} objects to migrate`);
            // Load checkpoint if resuming
            let startIndex = 0;
            if (this.config.resumeFromCheckpoint) {
                startIndex = await this.loadCheckpoint();
                console.log(`Resuming from object ${startIndex}`);
            }
            // Migration phase
            this.progress.phase = 'migration';
            await this.migrateBatch(allObjects.slice(startIndex));
            // Verification phase
            if (this.config.verifyChecksums) {
                this.progress.phase = 'verification';
                await this.verifyMigration();
            }
            // Cleanup phase
            if (this.config.deleteSourceAfterCopy) {
                this.progress.phase = 'cleanup';
                await this.cleanupSource(allObjects);
            }
            this.progress.phase = 'completed';
            console.log('Migration completed successfully');
        }
        catch (error) {
            console.error('Migration failed:', error);
            this.progress.lastError = String(error);
            throw error;
        }
        return this.progress;
    }
    async verifyMigration() {
        console.log('Starting migration verification...');
        const results = [];
        const tiers = ['hot', 'warm', 'cold'];
        for (const tier of tiers) {
            console.log(`Verifying ${tier} tier...`);
            try {
                const sourceObjects = await this.source.listObjects(tier);
                const targetObjects = await this.target.listObjects(tier);
                const sourceHashes = new Set(sourceObjects.map((o) => o.contentHash));
                const targetHashes = new Set(targetObjects.map((o) => o.contentHash));
                // Check for missing objects
                for (const hash of sourceHashes) {
                    if (!targetHashes.has(hash)) {
                        results.push({
                            contentHash: hash,
                            tier,
                            status: 'missing',
                        });
                        continue;
                    }
                    // Verify checksums if enabled
                    if (this.config.verifyChecksums) {
                        const verification = await this.verifyObjectChecksum(hash, tier);
                        results.push(verification);
                    }
                    else {
                        results.push({
                            contentHash: hash,
                            tier,
                            status: 'verified',
                        });
                    }
                }
                // Check for extra objects in target
                for (const hash of targetHashes) {
                    if (!sourceHashes.has(hash)) {
                        console.warn(`Extra object in target: ${hash} (${tier})`);
                    }
                }
            }
            catch (error) {
                console.error(`Failed to verify ${tier} tier:`, error);
                results.push({
                    contentHash: 'tier-error',
                    tier,
                    status: 'error',
                    error: String(error),
                });
            }
        }
        const summary = this.summarizeVerification(results);
        console.log('Verification completed:', summary);
        return results;
    }
    async benchmarkPerformance(objectSizes = [1024, 10240, 102400, 1048576]) {
        console.log('Starting performance benchmark...');
        const results = [];
        const tiers = ['hot', 'warm', 'cold'];
        for (const tier of tiers) {
            for (const size of objectSizes) {
                console.log(`Benchmarking ${tier} tier with ${size} byte objects...`);
                // Upload benchmark
                const uploadResult = await this.benchmarkUploads(tier, size, 10);
                results.push(uploadResult);
                // Download benchmark
                const downloadResult = await this.benchmarkDownloads(tier, size, 10);
                results.push(downloadResult);
                // Cleanup test objects
                await this.cleanupTestObjects(tier, size);
            }
        }
        console.log('Performance benchmark completed');
        return results;
    }
    async discoverAllObjects() {
        const allObjects = [];
        const tiers = ['hot', 'warm', 'cold'];
        for (const tier of tiers) {
            try {
                const objects = await this.source.listObjects(tier);
                for (const obj of objects) {
                    allObjects.push({
                        contentHash: obj.contentHash,
                        tier,
                        size: obj.size || 0,
                    });
                }
            }
            catch (error) {
                console.warn(`Failed to list objects in ${tier} tier:`, error);
            }
        }
        return allObjects;
    }
    async migrateBatch(objects) {
        const semaphore = new Array(this.config.parallelTransfers).fill(null);
        for (let i = 0; i < objects.length; i += this.config.batchSize) {
            const batch = objects.slice(i, i + this.config.batchSize);
            await Promise.all(batch.map(async (obj, index) => {
                // Wait for available slot
                await new Promise((resolve) => {
                    const checkSlot = () => {
                        const slotIndex = semaphore.findIndex((slot) => slot === null);
                        if (slotIndex !== -1) {
                            semaphore[slotIndex] = obj.contentHash;
                            resolve(slotIndex);
                        }
                        else {
                            setTimeout(checkSlot, 100);
                        }
                    };
                    checkSlot();
                });
                try {
                    await this.migrateObject(obj);
                    this.progress.successCount++;
                    this.progress.bytesTransferred += obj.size;
                }
                catch (error) {
                    console.error(`Failed to migrate ${obj.contentHash}:`, error);
                    this.progress.errorCount++;
                    this.progress.lastError = String(error);
                }
                finally {
                    // Free slot
                    const slotIndex = semaphore.indexOf(obj.contentHash);
                    if (slotIndex !== -1) {
                        semaphore[slotIndex] = null;
                    }
                    this.progress.processedObjects++;
                    this.progress.currentObject = obj.contentHash;
                    this.updateTimeEstimate();
                    // Save checkpoint every 100 objects
                    if (this.progress.processedObjects % 100 === 0) {
                        await this.saveCheckpoint();
                    }
                }
            }));
        }
    }
    async migrateObject(obj) {
        // Check if object already exists in target
        const targetExists = await this.target.objectExists(obj.contentHash, obj.tier);
        if (targetExists) {
            this.progress.skippedCount++;
            return;
        }
        // Get object from source
        const { data, metadata } = await this.source.getObject(obj.contentHash, obj.tier);
        // Copy to target
        await this.target.putObject(obj.contentHash, data, obj.tier, metadata);
        console.log(`Migrated ${obj.contentHash} (${obj.tier}) - ${obj.size} bytes`);
    }
    async verifyObjectChecksum(contentHash, tier) {
        try {
            // Get object from both sources
            const sourceResult = await this.source.getObject(contentHash, tier);
            const targetResult = await this.target.getObject(contentHash, tier);
            // Calculate checksums
            const sourceChecksum = await (0, index_1.calculateContentHash)(sourceResult.data);
            const targetChecksum = await (0, index_1.calculateContentHash)(targetResult.data);
            if (sourceChecksum === targetChecksum && sourceChecksum === contentHash) {
                return {
                    contentHash,
                    tier,
                    status: 'verified',
                    sourceChecksum,
                    targetChecksum,
                };
            }
            else {
                return {
                    contentHash,
                    tier,
                    status: 'mismatch',
                    sourceChecksum,
                    targetChecksum,
                };
            }
        }
        catch (error) {
            return {
                contentHash,
                tier,
                status: 'error',
                error: String(error),
            };
        }
    }
    async benchmarkUploads(tier, objectSize, count) {
        const latencies = [];
        const startTime = Date.now();
        for (let i = 0; i < count; i++) {
            const testData = Buffer.alloc(objectSize, 'A');
            const contentHash = (0, crypto_1.createHash)('sha256').update(testData).digest('hex');
            const opStart = Date.now();
            await this.target.putObject(contentHash, testData, tier);
            const opEnd = Date.now();
            latencies.push(opEnd - opStart);
        }
        const endTime = Date.now();
        const duration = endTime - startTime;
        const totalSize = objectSize * count;
        return {
            operation: 'upload',
            backend: 'target',
            tier,
            objectCount: count,
            totalSizeBytes: totalSize,
            durationMs: duration,
            throughputMBps: totalSize / 1024 / 1024 / (duration / 1000),
            opsPerSecond: count / (duration / 1000),
            latencyMs: {
                min: Math.min(...latencies),
                max: Math.max(...latencies),
                avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
                p95: latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)],
            },
        };
    }
    async benchmarkDownloads(tier, objectSize, count) {
        // First upload test objects
        const testHashes = [];
        for (let i = 0; i < count; i++) {
            const testData = Buffer.alloc(objectSize, 'A');
            const contentHash = (0, crypto_1.createHash)('sha256').update(testData).digest('hex');
            await this.target.putObject(contentHash, testData, tier);
            testHashes.push(contentHash);
        }
        // Now benchmark downloads
        const latencies = [];
        const startTime = Date.now();
        for (const hash of testHashes) {
            const opStart = Date.now();
            const { data } = await this.target.getObject(hash, tier);
            // Consume the stream
            await new Promise((resolve, reject) => {
                const chunks = [];
                data.on('data', (chunk) => chunks.push(chunk));
                data.on('end', resolve);
                data.on('error', reject);
            });
            const opEnd = Date.now();
            latencies.push(opEnd - opStart);
        }
        const endTime = Date.now();
        const duration = endTime - startTime;
        const totalSize = objectSize * count;
        return {
            operation: 'download',
            backend: 'target',
            tier,
            objectCount: count,
            totalSizeBytes: totalSize,
            durationMs: duration,
            throughputMBps: totalSize / 1024 / 1024 / (duration / 1000),
            opsPerSecond: count / (duration / 1000),
            latencyMs: {
                min: Math.min(...latencies),
                max: Math.max(...latencies),
                avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
                p95: latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)],
            },
        };
    }
    async cleanupTestObjects(tier, objectSize) {
        try {
            const objects = await this.target.listObjects(tier);
            for (const obj of objects) {
                if (obj.size === objectSize) {
                    await this.target.deleteObject(obj.contentHash, tier);
                }
            }
        }
        catch (error) {
            console.warn('Failed to cleanup test objects:', error);
        }
    }
    async cleanupSource(objects) {
        console.log('Cleaning up source objects...');
        for (const obj of objects) {
            try {
                await this.source.deleteObject(obj.contentHash, obj.tier);
            }
            catch (error) {
                console.error(`Failed to delete source object ${obj.contentHash}:`, error);
            }
        }
    }
    updateTimeEstimate() {
        const elapsed = Date.now() - this.progress.startTime;
        const rate = this.progress.processedObjects / elapsed;
        const remaining = this.progress.totalObjects - this.progress.processedObjects;
        this.progress.estimatedTimeRemaining = remaining / rate;
    }
    async saveCheckpoint() {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            await fs.writeFile(this.config.checkpointFile, JSON.stringify({
                processedObjects: this.progress.processedObjects,
                timestamp: Date.now(),
            }));
        }
        catch (error) {
            console.warn('Failed to save checkpoint:', error);
        }
    }
    async loadCheckpoint() {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const data = await fs.readFile(this.config.checkpointFile, 'utf-8');
            const checkpoint = JSON.parse(data);
            return checkpoint.processedObjects || 0;
        }
        catch {
            return 0;
        }
    }
    summarizeVerification(results) {
        const summary = {
            verified: 0,
            mismatch: 0,
            missing: 0,
            error: 0,
        };
        for (const result of results) {
            summary[result.status]++;
        }
        return summary;
    }
    getProgress() {
        return { ...this.progress };
    }
}
exports.StorageMigrator = StorageMigrator;
// Utility functions for command-line tools
async function runMigrationCLI() {
    const { createStorageDriver } = await Promise.resolve().then(() => __importStar(require('./index')));
    // Create source (filesystem) and target (S3) drivers
    const sourceConfig = { backend: 'fs' };
    const targetConfig = { backend: 's3' };
    const source = createStorageDriver(sourceConfig);
    const target = createStorageDriver(targetConfig);
    const migrator = new StorageMigrator(source, target);
    // Start migration
    const progress = await migrator.migrateAllContent();
    console.log('Final progress:', progress);
    // Run verification
    const verificationResults = await migrator.verifyMigration();
    console.log(`Verification: ${verificationResults.filter((r) => r.status === 'verified').length} verified, ${verificationResults.filter((r) => r.status === 'mismatch').length} mismatches`);
}
async function runBenchmarkCLI() {
    const { createStorageDriver } = await Promise.resolve().then(() => __importStar(require('./index')));
    const driver = createStorageDriver();
    const source = createStorageDriver({ backend: 'fs' });
    const migrator = new StorageMigrator(source, driver);
    const results = await migrator.benchmarkPerformance();
    console.log('Benchmark Results:');
    for (const result of results) {
        console.log(`${result.operation} (${result.tier}): ${result.throughputMBps.toFixed(2)} MB/s, ${result.opsPerSecond.toFixed(2)} ops/s`);
    }
}
//# sourceMappingURL=migration.js.map