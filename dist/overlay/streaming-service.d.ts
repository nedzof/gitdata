import { EventEmitter } from 'events';
import type { DatabaseAdapter } from './brc26-uhrp';
export interface StreamableContent {
    hash: string;
    filename: string;
    contentType: string;
    totalSize: number;
    chunkSize: number;
    totalChunks: number;
    isStreamable: boolean;
    streamingProfiles?: StreamingProfile[];
    transcoded: boolean;
    uploadedAt: number;
    metadata?: {
        duration?: number;
        width?: number;
        height?: number;
        bitrate?: number;
    };
}
export interface StreamingProfile {
    profileId: string;
    quality: '240p' | '480p' | '720p' | '1080p' | '4k';
    bitrate: number;
    codec: string;
    format: 'hls' | 'dash' | 'mp4';
    playlistUrl?: string;
    filePath?: string;
}
export interface ContentChunk {
    contentHash: string;
    chunkIndex: number;
    chunkHash: string;
    size: number;
    localPath: string;
    uploadedAt: number;
}
export interface ChunkedUploadSession {
    uploadId: string;
    contentHash: string;
    filename: string;
    contentType: string;
    totalSize: number;
    chunkSize: number;
    totalChunks: number;
    uploadedChunks: Set<number>;
    enableStreaming: boolean;
    streamingProfiles: string[];
    createdAt: number;
    expiresAt: number;
    status: 'pending' | 'uploading' | 'completed' | 'failed';
}
export interface TranscodingJob {
    jobId: string;
    contentHash: string;
    sourceFile: string;
    targetProfiles: StreamingProfile[];
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    startedAt?: number;
    completedAt?: number;
    error?: string;
}
/**
 * Streaming Service for BRC-26 UHRP
 * Handles chunked uploads, video transcoding, and streaming delivery
 *
 * TODO: This is a placeholder implementation for future development
 * Implementation phases:
 * 1. Chunked upload/download
 * 2. Video transcoding with FFmpeg
 * 3. HLS/DASH streaming
 * 4. P2P distribution
 */
export declare class StreamingService extends EventEmitter {
    private database;
    private storageBasePath;
    private baseUrl;
    private uploadSessions;
    private transcodingJobs;
    constructor(database: DatabaseAdapter, storageBasePath: string, baseUrl: string);
    /**
     * Initialize database tables for streaming support
     */
    private initializeDatabase;
    /**
     * Initialize chunked upload session
     */
    initializeChunkedUpload(params: {
        filename: string;
        contentType: string;
        totalSize: number;
        chunkSize?: number;
        enableStreaming?: boolean;
        streamingProfiles?: string[];
    }): Promise<ChunkedUploadSession>;
    /**
     * Upload a chunk (placeholder implementation)
     */
    uploadChunk(uploadId: string, chunkIndex: number, chunkData: Buffer): Promise<{
        success: boolean;
        chunkHash: string;
        message: string;
    }>;
    /**
     * Complete chunked upload
     */
    completeChunkedUpload(uploadId: string, chunkHashes: string[]): Promise<StreamableContent>;
    /**
     * Get streaming information for content
     */
    getStreamingInfo(contentHash: string): Promise<{
        content: StreamableContent;
        profiles: StreamingProfile[];
    } | null>;
    /**
     * Get chunk by index (for streaming/download)
     */
    getChunk(contentHash: string, chunkIndex: number): Promise<Buffer | null>;
    /**
     * Start transcoding job (placeholder)
     */
    private startTranscoding;
    /**
     * Get upload session status
     */
    getUploadStatus(uploadId: string): Promise<ChunkedUploadSession | null>;
    /**
     * Get streaming statistics
     */
    getStreamingStats(): Promise<{
        activeSessions: number;
        transcodingJobs: number;
        totalStreamableContent: number;
        totalChunks: number;
    }>;
    private generateUploadId;
    private generateJobId;
    private generateContentHash;
    private calculateChunkHash;
    private getChunkPath;
    private getContentPath;
    private isVideoContent;
    private updateUploadSession;
    private startCleanupTimer;
    private cleanupExpiredSessions;
}
export default StreamingService;
