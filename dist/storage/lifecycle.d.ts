export interface LifecycleConfig {
    hotToWarmAfterDays: number;
    warmToColdAfterDays: number;
    hotMinAccessesPerDay: number;
    warmMinAccessesPerWeek: number;
    deleteAfterDays: number;
    orphanCleanupEnabled: boolean;
    maxObjectsPerBatch: number;
    tieringIntervalHours: number;
}
export interface AccessMetrics {
    contentHash: string;
    currentTier: StorageTier;
    lastAccessed: Date;
    accessCount24h: number;
    accessCount7d: number;
    accessCount30d: number;
    totalSize: number;
    createdAt: Date;
}
export interface TieringDecision {
    contentHash: string;
    fromTier: StorageTier;
    toTier: StorageTier;
    reason: string;
    priority: number;
    estimatedSavings?: number;
}
export declare class StorageLifecycleManager {
    private storage;
    private db;
    private config;
    constructor(storage: StorageDriver, db: Database.Database, config?: Partial<LifecycleConfig>);
    runTieringJob(): Promise<{
        moved: number;
        skipped: number;
        errors: number;
    }>;
    cleanupExpiredContent(): Promise<{
        deleted: number;
        errors: number;
    }>;
    private collectAccessMetrics;
    private analyzeTieringDecisions;
    private executeTieringDecision;
    private findExpiredObjects;
    private isOrphanedObject;
    private logTieringEvent;
    private logDeletionEvent;
    getStorageStats(): Promise<{
        tierBreakdown: Record<StorageTier, {
            objectCount: number;
            totalSize: number;
        }>;
        recentMoves: number;
        estimatedMonthlySavings: number;
    }>;
}
export declare function createStorageEventsMigration(db?: Database.Database): Promise<void>;
