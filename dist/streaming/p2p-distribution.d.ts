/**
 * P2P Distribution Network for Streaming Content
 *
 * Implements decentralized content distribution as specified in D43 Phase 3:
 * - Host availability advertisement via BRC-26 UHRP
 * - Content discovery across multiple hosts
 * - Load balancing and failover mechanisms
 * - Bandwidth optimization and intelligent caching
 * - Network topology management and peer scoring
 */
import { EventEmitter } from 'events';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
export interface P2PHost {
    hostId: string;
    publicKey: string;
    endpoint: string;
    geolocation: {
        country: string;
        region: string;
        city: string;
        latitude: number;
        longitude: number;
    };
    capabilities: {
        maxBandwidth: number;
        storageCapacity: number;
        concurrentConnections: number;
        protocols: string[];
    };
    metrics: {
        uptime: number;
        averageLatency: number;
        reliability: number;
        totalServed: number;
        lastSeen: Date;
    };
    reputation: {
        score: number;
        reviews: number;
        successfulTransfers: number;
        failedTransfers: number;
    };
    status: 'online' | 'offline' | 'maintenance';
    announcedAt: Date;
    expiresAt: Date;
}
export interface ContentAdvertisement {
    contentHash: string;
    hostId: string;
    availability: {
        chunks: number[];
        totalChunks: number;
        completeness: number;
    };
    access: {
        endpoint: string;
        requiresAuth: boolean;
        requiresPayment: boolean;
        price?: number;
    };
    metadata: {
        contentType: string;
        totalSize: number;
        chunkSize: number;
        checksums: string[];
    };
    quality: {
        bandwidth: number;
        latency: number;
        priority: 'low' | 'normal' | 'high';
    };
    advertisedAt: Date;
    expiresAt: Date;
}
export interface P2PRequest {
    requestId: string;
    contentHash: string;
    chunkIndices: number[];
    requesterHost: string;
    priority: 'low' | 'normal' | 'high';
    timeout: number;
    createdAt: Date;
    status: 'pending' | 'assigned' | 'downloading' | 'completed' | 'failed';
    assignedHosts: string[];
    completedChunks: number[];
    failedChunks: number[];
}
export interface LoadBalancingStrategy {
    type: 'round_robin' | 'weighted' | 'latency_based' | 'geographic';
    options: {
        weights?: Record<string, number>;
        maxLatency?: number;
        preferredRegions?: string[];
        fallbackStrategy?: string;
    };
}
export interface BandwidthAllocation {
    hostId: string;
    allocatedBandwidth: number;
    currentUsage: number;
    requestQueue: string[];
    priority: number;
}
export declare class P2PDistributionNetwork extends EventEmitter {
    private database;
    private myHostId;
    private myEndpoint;
    private readonly ADVERTISEMENT_TTL;
    private readonly HOST_HEARTBEAT_INTERVAL;
    private readonly REQUEST_TIMEOUT;
    private readonly MAX_CONCURRENT_REQUESTS;
    private hosts;
    private contentAdvertisements;
    private activeRequests;
    private bandwidthAllocations;
    private loadBalancer;
    constructor(database: DatabaseAdapter, myHostId: string, myEndpoint: string, options?: {
        loadBalancingStrategy?: LoadBalancingStrategy;
        maxConcurrentRequests?: number;
    });
    registerHost(host: Omit<P2PHost, 'hostId' | 'announcedAt' | 'expiresAt'>): Promise<string>;
    updateHostMetrics(hostId: string, metrics: Partial<P2PHost['metrics']>): Promise<void>;
    removeHost(hostId: string): Promise<void>;
    private updateHostReputation;
    advertiseContent(contentHash: string, chunks: number[], totalChunks: number, metadata: {
        contentType: string;
        totalSize: number;
        chunkSize: number;
        checksums: string[];
    }, options?: {
        requiresAuth?: boolean;
        requiresPayment?: boolean;
        price?: number;
        bandwidth?: number;
        priority?: 'low' | 'normal' | 'high';
    }): Promise<void>;
    discoverContent(contentHash: string, chunkIndices?: number[]): Promise<ContentAdvertisement[]>;
    requestContent(contentHash: string, chunkIndices: number[], options?: {
        priority?: 'low' | 'normal' | 'high';
        timeout?: number;
        preferredHosts?: string[];
        fallbackEnabled?: boolean;
    }): Promise<P2PRequest>;
    private selectOptimalHosts;
    private selectRoundRobin;
    private selectWeighted;
    private selectLatencyBased;
    private selectGeographic;
    private assignChunksToHosts;
    private downloadChunksFromHost;
    private reassignFailedChunks;
    private advertiseHostToBRC26;
    private advertiseContentToBRC26;
    private queryBRC26ForContent;
    private removeHostFromBRC26;
    private startMaintenanceLoop;
    private cleanupExpiredAdvertisements;
    private cleanupExpiredRequests;
    private updateNetworkTopology;
    private sendHeartbeat;
    private generateHostId;
    private generateRequestId;
    getNetworkStats(): {
        hosts: number;
        onlineHosts: number;
        contentItems: number;
        activeRequests: number;
        totalBandwidth: number;
    };
    getHostById(hostId: string): P2PHost | null;
    getRequestById(requestId: string): P2PRequest | null;
    setLoadBalancingStrategy(strategy: LoadBalancingStrategy): Promise<void>;
    getLoadBalancingStrategy(): LoadBalancingStrategy;
}
export declare const P2P_EVENTS: {
    readonly HOST_REGISTERED: "hostRegistered";
    readonly HOST_REMOVED: "hostRemoved";
    readonly HOST_METRICS_UPDATED: "hostMetricsUpdated";
    readonly CONTENT_ADVERTISED: "contentAdvertised";
    readonly REQUEST_CREATED: "requestCreated";
    readonly REQUEST_COMPLETED: "requestCompleted";
    readonly REQUEST_FAILED: "requestFailed";
    readonly CHUNK_DOWNLOADED: "chunkDownloaded";
    readonly CHUNK_DOWNLOAD_FAILED: "chunkDownloadFailed";
    readonly CHUNKS_REASSIGNED: "chunksReassigned";
    readonly REASSIGNMENT_FAILED: "reassignmentFailed";
    readonly NETWORK_TOPOLOGY_UPDATED: "networkTopologyUpdated";
    readonly MAINTENANCE_CLEANUP: "maintenanceCleanup";
    readonly HEARTBEAT_SENT: "heartbeatSent";
    readonly LOAD_BALANCING_STRATEGY_CHANGED: "loadBalancingStrategyChanged";
};
