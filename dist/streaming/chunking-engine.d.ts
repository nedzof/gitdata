/**
 * Core Chunking Engine for Large File Streaming
 *
 * Implements the complete file chunking system as specified in D43 Phase 3:
 * - Configurable chunk sizes with optimal defaults
 * - SHA-256 integrity verification for each chunk
 * - Upload resume capability for interrupted transfers
 * - Parallel chunk processing support
 * - Metadata tracking for reassembly
 */
import { EventEmitter } from 'events';
export interface Chunk {
    index: number;
    data: Buffer;
    hash: string;
    size: number;
    uploadId: string;
    totalChunks: number;
    originalFileName: string;
    contentType: string;
    created: Date;
    uploaded?: Date;
    verified?: boolean;
}
export interface ChunkMetadata {
    uploadId: string;
    originalFileName: string;
    contentType: string;
    totalSize: number;
    chunkSize: number;
    totalChunks: number;
    chunks: ChunkInfo[];
    created: Date;
    completed?: Date;
    status: 'initializing' | 'uploading' | 'completed' | 'failed' | 'paused';
}
export interface ChunkInfo {
    index: number;
    hash: string;
    size: number;
    status: 'pending' | 'uploading' | 'completed' | 'failed';
    uploadedAt?: Date;
    retries: number;
}
export interface ChunkingOptions {
    chunkSize?: number;
    enableIntegrityCheck?: boolean;
    enableParallelProcessing?: boolean;
    maxParallelChunks?: number;
    resumeSupported?: boolean;
}
export interface ReassemblyProgress {
    totalChunks: number;
    processedChunks: number;
    percentage: number;
    currentChunk: number;
    verified: boolean;
    errors: string[];
}
export declare class ChunkingEngine extends EventEmitter {
    private options;
    private readonly DEFAULT_CHUNK_SIZE;
    private readonly MAX_PARALLEL_CHUNKS;
    private readonly MAX_RETRIES;
    private activeUploads;
    private chunkStorage;
    constructor(options?: ChunkingOptions);
    chunkFile(file: Buffer, fileName: string, contentType: string, chunkSize?: number): Promise<{
        uploadId: string;
        chunks: Chunk[];
        metadata: ChunkMetadata;
    }>;
    reassembleFile(uploadId: string): Promise<{
        buffer: Buffer;
        metadata: ChunkMetadata;
        progress: ReassemblyProgress;
    }>;
    resumeUpload(uploadId: string): Promise<ChunkMetadata>;
    pauseUpload(uploadId: string): Promise<void>;
    processChunksParallel(uploadId: string, processor: (chunk: Chunk) => Promise<void>): Promise<void>;
    getUploadStatus(uploadId: string): ChunkMetadata | null;
    getUploadProgress(uploadId: string): {
        completed: number;
        total: number;
        percentage: number;
        status: string;
    } | null;
    deleteUpload(uploadId: string): Promise<void>;
    listActiveUploads(): string[];
    validateChunk(chunk: Chunk): Promise<boolean>;
    validateAllChunks(uploadId: string): Promise<{
        valid: boolean;
        invalidChunks: number[];
    }>;
    private generateUploadId;
    getChunkingStats(): {
        activeUploads: number;
        totalChunks: number;
        completedUploads: number;
        failedUploads: number;
    };
    updateOptions(newOptions: Partial<ChunkingOptions>): void;
    getOptions(): ChunkingOptions;
}
/**
 * Calculate optimal chunk size based on file size and connection speed
 */
export declare function calculateOptimalChunkSize(fileSize: number, connectionSpeed?: number): number;
/**
 * Estimate upload time based on file size, chunk size, and connection speed
 */
export declare function estimateUploadTime(fileSize: number, chunkSize: number, connectionSpeedBps: number, parallelChunks?: number): {
    totalTime: number;
    chunks: number;
    timePerChunk: number;
};
export declare const CHUNK_SIZES: {
    readonly SMALL: 65536;
    readonly MEDIUM: 1048576;
    readonly LARGE: 5242880;
    readonly XLARGE: 10485760;
};
export declare const CHUNK_EVENTS: {
    readonly CHUNKING_STARTED: "chunkingStarted";
    readonly CHUNK_CREATED: "chunkCreated";
    readonly CHUNKING_COMPLETED: "chunkingCompleted";
    readonly REASSEMBLY_STARTED: "reassemblyStarted";
    readonly CHUNK_VERIFIED: "chunkVerified";
    readonly REASSEMBLY_COMPLETED: "reassemblyCompleted";
    readonly UPLOAD_RESUMED: "uploadResumed";
    readonly UPLOAD_PAUSED: "uploadPaused";
    readonly PARALLEL_PROCESSING_STARTED: "parallelProcessingStarted";
    readonly CHUNK_PROCESSING_STARTED: "chunkProcessingStarted";
    readonly CHUNK_PROCESSING_COMPLETED: "chunkProcessingCompleted";
    readonly CHUNK_PROCESSING_FAILED: "chunkProcessingFailed";
    readonly BATCH_COMPLETED: "batchCompleted";
    readonly PARALLEL_PROCESSING_COMPLETED: "parallelProcessingCompleted";
    readonly UPLOAD_DELETED: "uploadDeleted";
    readonly CHUNK_VALIDATED: "chunkValidated";
    readonly ALL_CHUNKS_VALIDATED: "allChunksValidated";
    readonly OPTIONS_UPDATED: "optionsUpdated";
};
