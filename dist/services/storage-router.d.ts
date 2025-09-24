/**
 * D22 - BSV Overlay Network Storage Backend
 * Intelligent Storage Routing and Adaptive Caching System
 * Optimizes content delivery through intelligent location selection and caching
 */
import type { Pool } from 'pg';
import type { StorageLocation, UHRPResolveOptions } from './uhrp-storage.js';
export interface ClientContext {
    clientId?: string;
    geographicLocation?: string;
    geographicPreference?: string[];
    networkType?: 'mobile' | 'wifi' | 'ethernet';
    bandwidthMbps?: number;
    latencyToleranceMs?: number;
    costSensitivity?: 'low' | 'medium' | 'high';
    requestTime: Date;
}
export interface RoutingDecision {
    selectedLocation: StorageLocation;
    alternativeLocations: StorageLocation[];
    routingReason: string[];
    estimatedLatency: number;
    estimatedCost: number;
    cacheRecommendation?: CacheRecommendation;
    routingScore: number;
}
export interface CacheRecommendation {
    shouldCache: boolean;
    cacheLevel: 'memory' | 'disk' | 'overlay';
    ttlSeconds: number;
    priority: number;
    reason: string;
}
export interface AccessPattern {
    contentHash: string;
    accessCount: number;
    lastAccess: Date;
    accessFrequency: number;
    averageResponseTime: number;
    geographicDistribution: Map<string, number>;
    timeOfDayPattern: number[];
    sizeTrend: 'increasing' | 'decreasing' | 'stable';
}
export interface CachedContent {
    contentHash: string;
    content: Buffer;
    metadata: CacheMetadata;
    lastAccessed: Date;
    accessCount: number;
    hitRate: number;
}
export interface CacheMetadata {
    originalLocation: StorageLocation;
    cacheLevel: 'memory' | 'disk' | 'overlay';
    ttlSeconds: number;
    priority: number;
    cachedAt: Date;
    expiresAt: Date;
    sizeBytes: number;
    compressionRatio?: number;
}
export interface CacheStats {
    totalEntries: number;
    totalSizeBytes: number;
    hitRate: number;
    missRate: number;
    evictionRate: number;
    averageLatency: number;
    topContent: string[];
}
export declare class StorageRouter {
    private pool;
    private routingHistory;
    private performanceMetrics;
    constructor(pool: Pool);
    private initializeRouter;
    selectOptimalLocation(contentHash: string, availableLocations: StorageLocation[], clientContext: ClientContext, options?: UHRPResolveOptions): Promise<RoutingDecision>;
    private scoreLocation;
    private calculateLatencyScore;
    private calculateGeographicScore;
    private calculateCostScore;
    private generateRoutingReasons;
    private estimateLatency;
    private estimateCost;
    private generateCacheRecommendation;
    private getAccessPattern;
    private recordRoutingDecision;
    private loadPerformanceMetrics;
    private updatePerformanceMetrics;
    private startPerformanceMonitoring;
    getRoutingStats(): Promise<RoutingStats>;
}
export declare class AdaptiveStorageCache {
    private pool;
    private memoryCache;
    private cacheStats;
    private maxMemorySizeMB;
    private currentMemorySizeMB;
    constructor(pool: Pool, maxMemorySizeMB?: number);
    private initializeCache;
    getCachedContent(contentHash: string, accessPattern?: AccessPattern): Promise<CachedContent | null>;
    cacheContent(contentHash: string, content: Buffer, metadata: CacheMetadata): Promise<void>;
    private cacheInMemory;
    private cacheToDisk;
    private cacheToOverlay;
    private evictFromMemoryCache;
    private getDiskCachedContent;
    private promoteToMemoryCache;
    private isCacheExpired;
    private updateCacheHit;
    private updateCacheMiss;
    private recordCacheEntry;
    private recordCacheEviction;
    private loadCacheStatistics;
    private startCacheMaintenance;
    private cleanExpiredCache;
    private initializeCacheStats;
    getCacheStats(): Promise<CacheStats>;
}
interface RoutingStats {
    totalRequests: number;
    locationStats: Array<{
        locationType: string;
        requests: number;
        percentage: number;
        avgLatency: number;
        successRate: number;
    }>;
    routingDecisions: number;
    performanceMetrics: number;
}
export default StorageRouter;
