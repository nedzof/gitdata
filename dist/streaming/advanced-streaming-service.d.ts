/**
 * Advanced Streaming Service
 *
 * Implements live streaming, adaptive bitrate streaming, CDN integration,
 * and advanced analytics for production-grade streaming capabilities.
 */
import { EventEmitter } from 'events';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
export interface LiveStream {
    streamId: string;
    title: string;
    description?: string;
    streamKey: string;
    rtmpUrl: string;
    hlsUrl: string;
    status: 'created' | 'live' | 'stopped' | 'error';
    viewerCount: number;
    quality: StreamQuality[];
    thumbnailUrl?: string;
    createdAt: Date;
    startedAt?: Date;
    endedAt?: Date;
}
export interface StreamQuality {
    profileId: string;
    resolution: string;
    bitrate: number;
    framerate: number;
    codec: string;
    available: boolean;
}
export interface AdaptiveBitrateConfig {
    enabled: boolean;
    qualities: StreamQuality[];
    switchingAlgorithm: 'bandwidth' | 'buffer' | 'hybrid';
    bufferThreshold: number;
    bandwidthThreshold: number;
}
export interface CDNConfig {
    enabled: boolean;
    provider: string;
    endpoints: CDNEndpoint[];
    cacheTTL: number;
    purgeOnUpdate: boolean;
}
export interface CDNEndpoint {
    region: string;
    url: string;
    priority: number;
    healthStatus: 'healthy' | 'degraded' | 'offline';
}
export interface StreamingAnalytics {
    streamId: string;
    timestamp: Date;
    viewerCount: number;
    bandwidth: number;
    bufferHealth: number;
    qualitySwitches: number;
    errorRate: number;
    region: string;
}
export interface RealtimeTranscodingJob {
    jobId: string;
    streamId: string;
    inputFormat: string;
    outputProfiles: StreamQuality[];
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    startedAt: Date;
    estimatedCompletion?: Date;
}
export declare class AdvancedStreamingService extends EventEmitter {
    private database;
    private liveStreams;
    private transcodingJobs;
    private analyticsBuffer;
    private cdnConfig;
    private adaptiveBitrateConfig;
    constructor(database: DatabaseAdapter);
    initialize(): Promise<void>;
    createLiveStream(params: {
        title: string;
        description?: string;
        qualities?: StreamQuality[];
    }): Promise<LiveStream>;
    startLiveStream(streamId: string): Promise<void>;
    stopLiveStream(streamId: string): Promise<void>;
    startRealtimeTranscoding(streamId: string, qualities: StreamQuality[]): Promise<string>;
    private processRealtimeTranscoding;
    private stopRealtimeTranscoding;
    generateAdaptivePlaylist(streamId: string, clientCapabilities?: {
        bandwidth?: number;
        resolution?: string;
        device?: string;
    }): Promise<string>;
    private generateHLSMasterPlaylist;
    initializeCDN(): Promise<void>;
    getCDNUrl(contentPath: string, region?: string): Promise<string>;
    purgeCDNCache(contentPath: string): Promise<void>;
    recordAnalytics(analytics: StreamingAnalytics): Promise<void>;
    private flushAnalytics;
    getStreamAnalytics(streamId: string, timeRange: {
        start: Date;
        end: Date;
    }): Promise<StreamingAnalytics[]>;
    private createAdvancedStreamingTables;
    private loadLiveStreams;
    private startAnalyticsProcessor;
    private loadCDNEndpoints;
    private updateTranscodingJobStatus;
    shutdown(): Promise<void>;
}
