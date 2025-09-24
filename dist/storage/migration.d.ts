import type { StorageDriver, StorageTier } from './index';
export interface MigrationConfig {
    batchSize: number;
    parallelTransfers: number;
    verifyChecksums: boolean;
    deleteSourceAfterCopy: boolean;
    resumeFromCheckpoint: boolean;
    checkpointFile: string;
}
export interface MigrationProgress {
    phase: 'discovery' | 'migration' | 'verification' | 'cleanup' | 'completed';
    totalObjects: number;
    processedObjects: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    bytesTransferred: number;
    startTime: number;
    estimatedTimeRemaining?: number;
    currentObject?: string;
    lastError?: string;
}
export interface VerificationResult {
    contentHash: string;
    tier: StorageTier;
    status: 'verified' | 'mismatch' | 'missing' | 'error';
    sourceChecksum?: string;
    targetChecksum?: string;
    error?: string;
}
export interface BenchmarkResult {
    operation: 'upload' | 'download' | 'delete' | 'list';
    backend: string;
    tier: StorageTier;
    objectCount: number;
    totalSizeBytes: number;
    durationMs: number;
    throughputMBps: number;
    opsPerSecond: number;
    latencyMs: {
        min: number;
        max: number;
        avg: number;
        p95: number;
    };
}
export declare class StorageMigrator {
    private source;
    private target;
    private config;
    private progress;
    constructor(source: StorageDriver, target: StorageDriver, config?: Partial<MigrationConfig>);
    migrateAllContent(): Promise<MigrationProgress>;
    verifyMigration(): Promise<VerificationResult[]>;
    benchmarkPerformance(objectSizes?: number[]): Promise<BenchmarkResult[]>;
    private discoverAllObjects;
    private migrateBatch;
    private migrateObject;
    private verifyObjectChecksum;
    private benchmarkUploads;
    private benchmarkDownloads;
    private cleanupTestObjects;
    private cleanupSource;
    private updateTimeEstimate;
    private saveCheckpoint;
    private loadCheckpoint;
    private summarizeVerification;
    getProgress(): MigrationProgress;
}
export declare function runMigrationCLI(): Promise<void>;
export declare function runBenchmarkCLI(): Promise<void>;
