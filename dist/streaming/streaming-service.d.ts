/**
 * Complete Streaming Service Integration
 *
 * Integrates all streaming components into a unified service:
 * - ChunkingEngine for file processing
 * - TranscodingPipeline for video processing
 * - HLS/DASH playlist generation
 * - P2P distribution network
 * - Content delivery and load balancing
 */
import { EventEmitter } from 'events';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
import { type ChunkMetadata } from './chunking-engine';
import { type TranscodingProfile } from './transcoding-pipeline';
export interface StreamingFile {
    fileId: string;
    originalFileName: string;
    contentType: string;
    totalSize: number;
    uploadId: string;
    status: 'uploading' | 'processing' | 'transcoding' | 'ready' | 'failed';
    chunks: {
        total: number;
        uploaded: number;
        chunkSize: number;
        metadata: ChunkMetadata;
    };
    transcoding?: {
        jobId: string;
        profiles: string[];
        status: 'queued' | 'processing' | 'completed' | 'failed';
    };
    streaming: {
        formats: StreamingFormat[];
        playlists: {
            hls?: string;
            dash?: string;
        };
    };
    p2p: {
        advertised: boolean;
        hosts: number;
        availability: number;
    };
    createdAt: Date;
    processedAt?: Date;
    expiresAt: Date;
}
export interface StreamingFormat {
    profileId: string;
    quality: string;
    format: 'hls' | 'dash' | 'mp4' | 'webm';
    bitrate: number;
    resolution: string;
    path: string;
    playlistPath?: string;
    manifestPath?: string;
    segments?: string[];
    ready: boolean;
}
export interface StreamingOptions {
    enableTranscoding?: boolean;
    transcodingProfiles?: TranscodingProfile[];
    enableHLS?: boolean;
    enableDASH?: boolean;
    enableP2P?: boolean;
    chunkSize?: number;
    expiryHours?: number;
    quality?: 'low' | 'medium' | 'high' | 'ultra';
}
export interface StreamingStats {
    totalFiles: number;
    processingFiles: number;
    readyFiles: number;
    totalStorage: number;
    totalBandwidth: number;
    p2pHosts: number;
    activeStreams: number;
}
export declare class StreamingService extends EventEmitter {
    private database;
    private storageDir;
    private myHostId;
    private myEndpoint;
    private options;
    private chunker;
    private transcoder;
    private hlsGenerator;
    private dashGenerator;
    private p2pNetwork;
    private streamingFiles;
    private activeStreams;
    constructor(database: DatabaseAdapter, storageDir: string | undefined, myHostId: string, myEndpoint: string, options?: {
        maxConcurrentTranscodings?: number;
        chunkingOptions?: any;
        p2pEnabled?: boolean;
    });
    initiateUpload(fileName: string, contentType: string, totalSize: number, options?: StreamingOptions): Promise<{
        fileId: string;
        uploadId: string;
        chunkSize: number;
    }>;
    uploadChunk(fileId: string, chunkIndex: number, chunkData: Buffer): Promise<{
        success: boolean;
        uploadProgress: number;
    }>;
    completeUpload(fileId: string): Promise<void>;
    private startVideoProcessing;
    private onTranscodingCompleted;
    private generateMasterPlaylists;
    private setupP2PDistribution;
    getStreamingInfo(fileId: string): Promise<{
        file: StreamingFile;
        streamingUrls: {
            hls?: string;
            dash?: string;
            mp4?: string[];
            webm?: string[];
        };
    }>;
    getFileChunk(fileId: string, chunkIndex: number): Promise<Buffer>;
    getHLSPlaylist(fileId: string, playlistType: 'master' | string): Promise<string>;
    getDASHManifest(fileId: string): Promise<string>;
    private reassembleFile;
    private startFileProcessing;
    private isVideoFile;
    private calculateOptimalChunkSize;
    private getTranscodingProfiles;
    private getProfileById;
    private generateFileId;
    private setupEventHandlers;
    private startMaintenanceLoop;
    private cleanupExpiredFiles;
    private updateStreamingStats;
    getFile(fileId: string): StreamingFile | null;
    deleteFile(fileId: string): Promise<boolean>;
    listFiles(status?: StreamingFile['status']): StreamingFile[];
    getStats(): StreamingStats;
    getUploadStatus(fileId: string): Promise<{
        status: string;
        progress: number;
        chunksUploaded: number;
        totalChunks: number;
    } | null>;
}
export declare const STREAMING_EVENTS: {
    readonly UPLOAD_INITIATED: "uploadInitiated";
    readonly CHUNK_UPLOADED: "chunkUploaded";
    readonly UPLOAD_COMPLETED: "uploadCompleted";
    readonly TRANSCODING_STARTED: "transcodingStarted";
    readonly PROCESSING_COMPLETED: "processingCompleted";
    readonly PROCESSING_FAILED: "processingFailed";
    readonly P2P_ADVERTISED: "p2pAdvertised";
    readonly P2P_CONTENT_ADVERTISED: "p2pContentAdvertised";
    readonly FILE_DELETED: "fileDeleted";
    readonly FILE_DELETION_FAILED: "fileDeletionFailed";
    readonly STATS_UPDATED: "statsUpdated";
    readonly CHUNKING_COMPLETED: "chunkingCompleted";
};
