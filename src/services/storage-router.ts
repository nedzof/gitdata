/**
 * D22 - BSV Overlay Network Storage Backend
 * Intelligent Storage Routing and Adaptive Caching System
 * Optimizes content delivery through intelligent location selection and caching
 */

import { Pool } from 'pg';
import { StorageLocation, UHRPResolveOptions } from './uhrp-storage.js';
import { randomBytes } from 'crypto';

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
  accessFrequency: number; // accesses per hour
  averageResponseTime: number;
  geographicDistribution: Map<string, number>;
  timeOfDayPattern: number[]; // 24-hour pattern
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
  topContent: string[]; // Most accessed content hashes
}

export class StorageRouter {
  private pool: Pool;
  private routingHistory: Map<string, RoutingDecision[]> = new Map();
  private performanceMetrics: Map<string, LocationPerformance> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
    this.initializeRouter();
  }

  private async initializeRouter(): Promise<void> {
    console.log('🧭 Initializing intelligent storage router...');

    // Load historical performance data
    await this.loadPerformanceMetrics();

    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  async selectOptimalLocation(
    contentHash: string,
    availableLocations: StorageLocation[],
    clientContext: ClientContext,
    options: UHRPResolveOptions = {}
  ): Promise<RoutingDecision> {
    console.log(`🧭 Routing decision for ${contentHash.slice(0, 10)}... (${availableLocations.length} locations)`);

    try {
      // Score all available locations
      const scoredLocations = await Promise.all(
        availableLocations.map(location => this.scoreLocation(location, clientContext, options))
      );

      // Sort by score (highest first)
      scoredLocations.sort((a, b) => b.score - a.score);

      // Select the best location
      const selectedLocation = scoredLocations[0].location;
      const routingScore = scoredLocations[0].score;

      // Prepare alternatives (next best options)
      const alternativeLocations = scoredLocations
        .slice(1, 3)
        .map(scored => scored.location);

      // Generate routing reasons
      const routingReason = this.generateRoutingReasons(
        scoredLocations[0],
        clientContext,
        options
      );

      // Estimate performance
      const estimatedLatency = this.estimateLatency(selectedLocation, clientContext);
      const estimatedCost = this.estimateCost(selectedLocation, clientContext);

      // Generate cache recommendation
      const cacheRecommendation = await this.generateCacheRecommendation(
        contentHash,
        selectedLocation,
        clientContext
      );

      const decision: RoutingDecision = {
        selectedLocation,
        alternativeLocations,
        routingReason,
        estimatedLatency,
        estimatedCost,
        cacheRecommendation,
        routingScore
      };

      // Store routing decision for learning
      await this.recordRoutingDecision(contentHash, decision, clientContext);

      console.log(`✅ Selected ${selectedLocation.type} (score: ${routingScore.toFixed(2)})`);
      return decision;

    } catch (error) {
      console.error(`❌ Routing failed for ${contentHash}:`, error);

      // Fallback to first available location
      return {
        selectedLocation: availableLocations[0],
        alternativeLocations: availableLocations.slice(1),
        routingReason: ['fallback-selection'],
        estimatedLatency: availableLocations[0].latency,
        estimatedCost: availableLocations[0].cost,
        routingScore: 0
      };
    }
  }

  private async scoreLocation(
    location: StorageLocation,
    clientContext: ClientContext,
    options: UHRPResolveOptions
  ): Promise<{ location: StorageLocation; score: number; factors: Record<string, number> }> {
    const factors: Record<string, number> = {};
    let totalScore = 0;

    // 1. Latency score (30% weight)
    const latencyScore = this.calculateLatencyScore(location, clientContext, options);
    factors.latency = latencyScore;
    totalScore += latencyScore * 0.3;

    // 2. Availability score (25% weight)
    const availabilityScore = location.availability * 100;
    factors.availability = availabilityScore;
    totalScore += availabilityScore * 0.25;

    // 3. Geographic preference score (20% weight)
    const geoScore = this.calculateGeographicScore(location, clientContext);
    factors.geographic = geoScore;
    totalScore += geoScore * 0.2;

    // 4. Cost efficiency score (15% weight)
    const costScore = this.calculateCostScore(location, clientContext);
    factors.cost = costScore;
    totalScore += costScore * 0.15;

    // 5. Bandwidth capacity score (10% weight)
    const bandwidthScore = Math.min(location.bandwidth / 100, 100);
    factors.bandwidth = bandwidthScore;
    totalScore += bandwidthScore * 0.1;

    return { location, score: totalScore, factors };
  }

  private calculateLatencyScore(
    location: StorageLocation,
    clientContext: ClientContext,
    options: UHRPResolveOptions
  ): number {
    const maxAcceptableLatency = options.maxLatency || clientContext.latencyToleranceMs || 1000;

    if (location.latency > maxAcceptableLatency) {
      return 0; // Unacceptable latency
    }

    // Score inversely proportional to latency
    return Math.max(0, (maxAcceptableLatency - location.latency) / maxAcceptableLatency * 100);
  }

  private calculateGeographicScore(
    location: StorageLocation,
    clientContext: ClientContext
  ): number {
    const clientGeo = clientContext.geographicLocation;
    const preferences = clientContext.geographicPreference || [];

    let score = 50; // Base score

    // Boost for geographic preferences
    if (preferences.length > 0) {
      const hasPreferredRegion = location.geographicRegion.some(region =>
        preferences.includes(region)
      );
      if (hasPreferredRegion) {
        score += 30;
      }
    }

    // Boost for same region as client
    if (clientGeo && location.geographicRegion.includes(clientGeo)) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  private calculateCostScore(
    location: StorageLocation,
    clientContext: ClientContext
  ): number {
    const costSensitivity = clientContext.costSensitivity || 'medium';

    // Base score inversely related to cost
    let score = Math.max(0, (100 - location.cost) / 100 * 100);

    // Adjust based on cost sensitivity
    switch (costSensitivity) {
      case 'high':
        score *= 1.5; // Boost score for low-cost options
        break;
      case 'low':
        score *= 0.5; // Reduce importance of cost
        break;
      // 'medium' - no adjustment
    }

    return Math.min(score, 100);
  }

  private generateRoutingReasons(
    scored: { location: StorageLocation; score: number; factors: Record<string, number> },
    clientContext: ClientContext,
    options: UHRPResolveOptions
  ): string[] {
    const reasons: string[] = [];
    const { location, factors } = scored;

    // Primary reason (highest scoring factor)
    const topFactor = Object.entries(factors).reduce((a, b) =>
      factors[a[0]] > factors[b[0]] ? a : b
    );

    switch (topFactor[0]) {
      case 'latency':
        reasons.push(`optimal-latency-${location.latency}ms`);
        break;
      case 'availability':
        reasons.push(`high-availability-${(location.availability * 100).toFixed(1)}%`);
        break;
      case 'geographic':
        reasons.push(`geographic-preference-${location.geographicRegion[0]}`);
        break;
      case 'cost':
        reasons.push(`cost-efficient-${location.cost}-satoshis`);
        break;
      case 'bandwidth':
        reasons.push(`high-bandwidth-${location.bandwidth}mbps`);
        break;
    }

    // Additional contextual reasons
    if (options.preferredMethod && location.type === options.preferredMethod) {
      reasons.push(`user-preference-${options.preferredMethod}`);
    }

    if (clientContext.networkType === 'mobile' && location.latency < 200) {
      reasons.push('mobile-optimized');
    }

    return reasons;
  }

  private estimateLatency(location: StorageLocation, clientContext: ClientContext): number {
    let baseLatency = location.latency;

    // Adjust based on network type
    switch (clientContext.networkType) {
      case 'mobile':
        baseLatency *= 1.5;
        break;
      case 'wifi':
        baseLatency *= 1.1;
        break;
      case 'ethernet':
        baseLatency *= 0.9;
        break;
    }

    // Add random variation (±20%)
    const variation = (Math.random() - 0.5) * 0.4;
    return Math.round(baseLatency * (1 + variation));
  }

  private estimateCost(location: StorageLocation, clientContext: ClientContext): number {
    // Cost estimation based on expected data transfer
    const baseCost = location.cost;

    // Adjust based on client context
    if (clientContext.bandwidthMbps && clientContext.bandwidthMbps < 10) {
      return baseCost * 0.8; // Lower cost for low bandwidth
    }

    return baseCost;
  }

  private async generateCacheRecommendation(
    contentHash: string,
    selectedLocation: StorageLocation,
    clientContext: ClientContext
  ): Promise<CacheRecommendation> {
    // Get access pattern for this content
    const accessPattern = await this.getAccessPattern(contentHash);

    let shouldCache = false;
    let cacheLevel: 'memory' | 'disk' | 'overlay' = 'disk';
    let ttlSeconds = 3600; // 1 hour default
    let priority = 1;
    let reason = 'default-caching';

    // Decision factors
    if (accessPattern) {
      // High frequency access
      if (accessPattern.accessFrequency > 10) {
        shouldCache = true;
        cacheLevel = 'memory';
        ttlSeconds = 7200; // 2 hours
        priority = 3;
        reason = 'high-frequency-access';
      }
      // Medium frequency access
      else if (accessPattern.accessFrequency > 2) {
        shouldCache = true;
        cacheLevel = 'disk';
        ttlSeconds = 3600;
        priority = 2;
        reason = 'medium-frequency-access';
      }
    }

    // Remote location with high latency
    if (selectedLocation.type !== 'local' && selectedLocation.latency > 200) {
      shouldCache = true;
      priority = Math.max(priority, 2);
      reason = 'high-latency-location';
    }

    // Mobile client optimization
    if (clientContext.networkType === 'mobile') {
      shouldCache = true;
      ttlSeconds = Math.max(ttlSeconds, 1800); // At least 30 minutes
      reason = 'mobile-optimization';
    }

    return {
      shouldCache,
      cacheLevel,
      ttlSeconds,
      priority,
      reason
    };
  }

  private async getAccessPattern(contentHash: string): Promise<AccessPattern | null> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) as access_count,
        MAX(accessed_at) as last_access,
        AVG(response_time_ms) as avg_response_time,
        EXTRACT(EPOCH FROM (MAX(accessed_at) - MIN(accessed_at))) / 3600 as time_span_hours
      FROM storage_access_logs
      WHERE content_hash = $1
        AND accessed_at > NOW() - INTERVAL '7 days'
    `, [contentHash]);

    if (result.rows.length === 0 || result.rows[0].access_count === 0) {
      return null;
    }

    const row = result.rows[0];
    const accessFrequency = row.time_span_hours > 0 ?
      row.access_count / row.time_span_hours : 0;

    return {
      contentHash,
      accessCount: parseInt(row.access_count),
      lastAccess: row.last_access,
      accessFrequency,
      averageResponseTime: parseFloat(row.avg_response_time) || 0,
      geographicDistribution: new Map(), // Would be populated from detailed logs
      timeOfDayPattern: new Array(24).fill(0), // Would be calculated from logs
      sizeTrend: 'stable'
    };
  }

  private async recordRoutingDecision(
    contentHash: string,
    decision: RoutingDecision,
    clientContext: ClientContext
  ): Promise<void> {
    // Store routing decision for machine learning improvements
    const history = this.routingHistory.get(contentHash) || [];
    history.push(decision);

    // Keep only recent decisions (last 100)
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.routingHistory.set(contentHash, history);

    // Store performance metrics for the selected location
    await this.updatePerformanceMetrics(
      decision.selectedLocation,
      decision.estimatedLatency,
      clientContext
    );
  }

  private async loadPerformanceMetrics(): Promise<void> {
    const result = await this.pool.query(`
      SELECT
        storage_location,
        metric_type,
        AVG(metric_value) as avg_value,
        geographic_region
      FROM storage_performance_metrics
      WHERE measured_at > NOW() - INTERVAL '24 hours'
      GROUP BY storage_location, metric_type, geographic_region
    `);

    for (const row of result.rows) {
      const key = `${row.storage_location}-${row.geographic_region}`;
      const existing = this.performanceMetrics.get(key) || {
        location: row.storage_location,
        region: row.geographic_region,
        latency: 0,
        bandwidth: 0,
        availability: 1,
        cost: 0,
        samples: 0
      };

      switch (row.metric_type) {
        case 'latency':
          existing.latency = parseFloat(row.avg_value);
          break;
        case 'bandwidth':
          existing.bandwidth = parseFloat(row.avg_value);
          break;
        case 'availability':
          existing.availability = parseFloat(row.avg_value) / 100;
          break;
        case 'cost':
          existing.cost = parseFloat(row.avg_value);
          break;
      }

      this.performanceMetrics.set(key, existing);
    }

    console.log(`📊 Loaded performance metrics for ${this.performanceMetrics.size} locations`);
  }

  private async updatePerformanceMetrics(
    location: StorageLocation,
    actualLatency: number,
    clientContext: ClientContext
  ): Promise<void> {
    const region = clientContext.geographicLocation || 'unknown';

    await this.pool.query(`
      INSERT INTO storage_performance_metrics (
        content_hash, storage_location, metric_type, metric_value,
        measurement_unit, geographic_region, client_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      'routing-decision',
      location.type,
      'latency',
      actualLatency,
      'ms',
      region,
      JSON.stringify(clientContext)
    ]);
  }

  private startPerformanceMonitoring(): void {
    // Periodically refresh performance metrics
    setInterval(async () => {
      try {
        await this.loadPerformanceMetrics();
      } catch (error) {
        console.error('❌ Failed to refresh performance metrics:', error);
      }
    }, 300000); // 5 minutes

    console.log('📊 Started performance monitoring');
  }

  async getRoutingStats(): Promise<RoutingStats> {
    const result = await this.pool.query(`
      SELECT
        access_method,
        COUNT(*) as requests,
        AVG(response_time_ms) as avg_latency,
        COUNT(CASE WHEN success THEN 1 END) as successful_requests
      FROM storage_access_logs
      WHERE accessed_at > NOW() - INTERVAL '24 hours'
      GROUP BY access_method
    `);

    const totalRequests = result.rows.reduce((sum, row) => sum + parseInt(row.requests), 0);
    const locationStats = result.rows.map(row => ({
      locationType: row.access_method,
      requests: parseInt(row.requests),
      percentage: totalRequests > 0 ? (parseInt(row.requests) / totalRequests * 100) : 0,
      avgLatency: parseFloat(row.avg_latency) || 0,
      successRate: parseInt(row.successful_requests) / parseInt(row.requests)
    }));

    return {
      totalRequests,
      locationStats,
      routingDecisions: this.routingHistory.size,
      performanceMetrics: this.performanceMetrics.size
    };
  }
}

export class AdaptiveStorageCache {
  private pool: Pool;
  private memoryCache: Map<string, CachedContent> = new Map();
  private cacheStats: CacheStats;
  private maxMemorySizeMB: number;
  private currentMemorySizeMB: number = 0;

  constructor(pool: Pool, maxMemorySizeMB: number = 1024) {
    this.pool = pool;
    this.maxMemorySizeMB = maxMemorySizeMB;
    this.cacheStats = this.initializeCacheStats();

    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    console.log(`💾 Initializing adaptive cache (${this.maxMemorySizeMB}MB memory limit)`);

    // Load cache statistics
    await this.loadCacheStatistics();

    // Start cache maintenance
    this.startCacheMaintenance();
  }

  async getCachedContent(
    contentHash: string,
    accessPattern?: AccessPattern
  ): Promise<CachedContent | null> {
    // Check memory cache first
    const memoryCached = this.memoryCache.get(contentHash);
    if (memoryCached && !this.isCacheExpired(memoryCached)) {
      await this.updateCacheHit(contentHash, 'memory');
      memoryCached.lastAccessed = new Date();
      memoryCached.accessCount++;
      return memoryCached;
    }

    // Check disk cache
    const diskCached = await this.getDiskCachedContent(contentHash);
    if (diskCached) {
      await this.updateCacheHit(contentHash, 'disk');

      // Promote to memory cache if frequently accessed
      if (accessPattern && accessPattern.accessFrequency > 5) {
        await this.promoteToMemoryCache(diskCached);
      }

      return diskCached;
    }

    // Cache miss
    await this.updateCacheMiss(contentHash);
    return null;
  }

  async cacheContent(
    contentHash: string,
    content: Buffer,
    metadata: CacheMetadata
  ): Promise<void> {
    const sizeBytes = content.length;
    const sizeMB = sizeBytes / (1024 * 1024);

    console.log(`💾 Caching content: ${contentHash.slice(0, 10)}... (${sizeMB.toFixed(2)}MB, ${metadata.cacheLevel})`);

    const cachedContent: CachedContent = {
      contentHash,
      content,
      metadata: {
        ...metadata,
        sizeBytes,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + metadata.ttlSeconds * 1000)
      },
      lastAccessed: new Date(),
      accessCount: 1,
      hitRate: 0
    };

    switch (metadata.cacheLevel) {
      case 'memory':
        await this.cacheInMemory(cachedContent);
        break;
      case 'disk':
        await this.cacheToDisk(cachedContent);
        break;
      case 'overlay':
        await this.cacheToOverlay(cachedContent);
        break;
    }

    // Update cache statistics
    await this.recordCacheEntry(contentHash, metadata.cacheLevel, sizeBytes);
  }

  private async cacheInMemory(cached: CachedContent): Promise<void> {
    const sizeMB = cached.metadata.sizeBytes / (1024 * 1024);

    // Check if we have space
    if (this.currentMemorySizeMB + sizeMB > this.maxMemorySizeMB) {
      await this.evictFromMemoryCache(sizeMB);
    }

    this.memoryCache.set(cached.contentHash, cached);
    this.currentMemorySizeMB += sizeMB;
  }

  private async cacheToDisk(cached: CachedContent): Promise<void> {
    // Simulate disk caching
    // In real implementation, this would write to disk cache directory
    console.log(`💿 Cached to disk: ${cached.contentHash.slice(0, 10)}...`);
  }

  private async cacheToOverlay(cached: CachedContent): Promise<void> {
    // Simulate overlay network caching
    console.log(`🌐 Cached to overlay: ${cached.contentHash.slice(0, 10)}...`);
  }

  private async evictFromMemoryCache(requiredSizeMB: number): Promise<void> {
    // Evict least recently used content until we have enough space
    const entries = Array.from(this.memoryCache.entries());

    // Sort by priority (low priority first) and last accessed (old first)
    entries.sort((a, b) => {
      const priorityDiff = a[1].metadata.priority - b[1].metadata.priority;
      if (priorityDiff !== 0) return priorityDiff;

      return a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime();
    });

    let freedSizeMB = 0;
    for (const [hash, cached] of entries) {
      if (freedSizeMB >= requiredSizeMB) break;

      const sizeMB = cached.metadata.sizeBytes / (1024 * 1024);
      this.memoryCache.delete(hash);
      this.currentMemorySizeMB -= sizeMB;
      freedSizeMB += sizeMB;

      await this.recordCacheEviction(hash, 'memory');
      console.log(`🗑️ Evicted from memory: ${hash.slice(0, 10)}... (${sizeMB.toFixed(2)}MB)`);
    }
  }

  private async getDiskCachedContent(contentHash: string): Promise<CachedContent | null> {
    // Simulate disk cache lookup
    // In real implementation, this would check disk cache directory
    return null;
  }

  private async promoteToMemoryCache(cached: CachedContent): Promise<void> {
    cached.metadata.cacheLevel = 'memory';
    await this.cacheInMemory(cached);
    console.log(`⬆️ Promoted to memory: ${cached.contentHash.slice(0, 10)}...`);
  }

  private isCacheExpired(cached: CachedContent): boolean {
    return new Date() > cached.metadata.expiresAt;
  }

  private async updateCacheHit(contentHash: string, cacheLevel: string): Promise<void> {
    this.cacheStats.hitRate = (this.cacheStats.hitRate * 0.9) + (1 * 0.1); // Exponential moving average

    await this.pool.query(`
      INSERT INTO storage_cache_stats (
        content_hash, cache_level, cache_status, last_access_at
      ) VALUES ($1, $2, $3, NOW())
    `, [contentHash, cacheLevel, 'hit']);
  }

  private async updateCacheMiss(contentHash: string): Promise<void> {
    this.cacheStats.missRate = (this.cacheStats.missRate * 0.9) + (1 * 0.1);

    await this.pool.query(`
      INSERT INTO storage_cache_stats (
        content_hash, cache_level, cache_status
      ) VALUES ($1, $2, $3)
    `, [contentHash, 'memory', 'miss']);
  }

  private async recordCacheEntry(
    contentHash: string,
    cacheLevel: string,
    sizeBytes: number
  ): Promise<void> {
    await this.pool.query(`
      INSERT INTO storage_cache_stats (
        content_hash, cache_level, cache_status, cache_size_bytes, priority_score
      ) VALUES ($1, $2, $3, $4, $5)
    `, [contentHash, cacheLevel, 'cached', sizeBytes, 1.0]);
  }

  private async recordCacheEviction(contentHash: string, cacheLevel: string): Promise<void> {
    await this.pool.query(`
      UPDATE storage_cache_stats
      SET cache_status = 'evicted', recorded_at = NOW()
      WHERE content_hash = $1 AND cache_level = $2
    `, [contentHash, cacheLevel]);
  }

  private async loadCacheStatistics(): Promise<void> {
    const result = await this.pool.query(`
      SELECT
        cache_level,
        cache_status,
        COUNT(*) as count,
        AVG(access_frequency) as avg_frequency
      FROM storage_cache_stats
      WHERE recorded_at > NOW() - INTERVAL '24 hours'
      GROUP BY cache_level, cache_status
    `);

    // Calculate hit rates and other metrics
    let totalHits = 0;
    let totalMisses = 0;

    for (const row of result.rows) {
      if (row.cache_status === 'hit') {
        totalHits += parseInt(row.count);
      } else if (row.cache_status === 'miss') {
        totalMisses += parseInt(row.count);
      }
    }

    const totalRequests = totalHits + totalMisses;
    this.cacheStats.hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    this.cacheStats.missRate = totalRequests > 0 ? totalMisses / totalRequests : 0;
  }

  private startCacheMaintenance(): void {
    // Periodically clean expired cache entries
    setInterval(async () => {
      try {
        await this.cleanExpiredCache();
        await this.loadCacheStatistics();
      } catch (error) {
        console.error('❌ Cache maintenance error:', error);
      }
    }, 600000); // 10 minutes

    console.log('🧹 Started cache maintenance');
  }

  private async cleanExpiredCache(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;

    // Clean memory cache
    for (const [hash, cached] of this.memoryCache.entries()) {
      if (this.isCacheExpired(cached)) {
        const sizeMB = cached.metadata.sizeBytes / (1024 * 1024);
        this.memoryCache.delete(hash);
        this.currentMemorySizeMB -= sizeMB;
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} expired cache entries`);
    }
  }

  private initializeCacheStats(): CacheStats {
    return {
      totalEntries: 0,
      totalSizeBytes: 0,
      hitRate: 0,
      missRate: 0,
      evictionRate: 0,
      averageLatency: 0,
      topContent: []
    };
  }

  async getCacheStats(): Promise<CacheStats> {
    return {
      ...this.cacheStats,
      totalEntries: this.memoryCache.size,
      totalSizeBytes: this.currentMemorySizeMB * 1024 * 1024
    };
  }
}

interface LocationPerformance {
  location: string;
  region: string;
  latency: number;
  bandwidth: number;
  availability: number;
  cost: number;
  samples: number;
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