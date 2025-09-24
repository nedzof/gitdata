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

import { createHash, randomBytes } from 'crypto';
import { EventEmitter } from 'events';

// ==================== Core Types ====================

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
  chunkSize?: number; // Default 1MB
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

// ==================== Core Chunking Engine ====================

export class ChunkingEngine extends EventEmitter {
  private readonly DEFAULT_CHUNK_SIZE = 1048576; // 1MB
  private readonly MAX_PARALLEL_CHUNKS = 5;
  private readonly MAX_RETRIES = 3;

  private activeUploads = new Map<string, ChunkMetadata>();
  private chunkStorage = new Map<string, Chunk[]>();

  constructor(private options: ChunkingOptions = {}) {
    super();
    this.options = {
      chunkSize: this.DEFAULT_CHUNK_SIZE,
      enableIntegrityCheck: true,
      enableParallelProcessing: true,
      maxParallelChunks: this.MAX_PARALLEL_CHUNKS,
      resumeSupported: true,
      ...options,
    };
  }

  // ==================== File Chunking ====================

  async chunkFile(
    file: Buffer,
    fileName: string,
    contentType: string,
    chunkSize: number = this.options.chunkSize!,
  ): Promise<{ uploadId: string; chunks: Chunk[]; metadata: ChunkMetadata }> {
    const uploadId = this.generateUploadId();
    const totalChunks = Math.ceil(file.length / chunkSize);

    this.emit('chunkingStarted', { uploadId, fileName, totalSize: file.length, totalChunks });

    const chunks: Chunk[] = [];
    const chunkInfos: ChunkInfo[] = [];

    // Create chunks with integrity hashes
    for (let i = 0; i < file.length; i += chunkSize) {
      const chunkIndex = Math.floor(i / chunkSize);
      const chunkData = file.slice(i, Math.min(i + chunkSize, file.length));

      // Calculate SHA-256 hash for integrity verification
      const chunkHash = this.options.enableIntegrityCheck
        ? createHash('sha256').update(chunkData).digest('hex')
        : '';

      const chunk: Chunk = {
        index: chunkIndex,
        data: chunkData,
        hash: chunkHash,
        size: chunkData.length,
        uploadId,
        totalChunks,
        originalFileName: fileName,
        contentType,
        created: new Date(),
        verified: this.options.enableIntegrityCheck ? false : true,
      };

      chunks.push(chunk);

      chunkInfos.push({
        index: chunkIndex,
        hash: chunkHash,
        size: chunkData.length,
        status: 'pending',
        retries: 0,
      });

      this.emit('chunkCreated', { uploadId, chunkIndex, totalChunks });
    }

    // Create metadata
    const metadata: ChunkMetadata = {
      uploadId,
      originalFileName: fileName,
      contentType,
      totalSize: file.length,
      chunkSize,
      totalChunks,
      chunks: chunkInfos,
      created: new Date(),
      status: 'initializing',
    };

    // Store in memory (in production, this would be persisted to database)
    this.activeUploads.set(uploadId, metadata);
    this.chunkStorage.set(uploadId, chunks);

    this.emit('chunkingCompleted', { uploadId, totalChunks: chunks.length });

    return { uploadId, chunks, metadata };
  }

  // ==================== File Reassembly ====================

  async reassembleFile(
    uploadId: string,
  ): Promise<{ buffer: Buffer; metadata: ChunkMetadata; progress: ReassemblyProgress }> {
    const metadata = this.activeUploads.get(uploadId);
    const chunks = this.chunkStorage.get(uploadId);

    if (!metadata || !chunks) {
      throw new Error(`Upload not found: ${uploadId}`);
    }

    this.emit('reassemblyStarted', { uploadId, totalChunks: chunks.length });

    const progress: ReassemblyProgress = {
      totalChunks: chunks.length,
      processedChunks: 0,
      percentage: 0,
      currentChunk: 0,
      verified: true,
      errors: [],
    };

    // Sort chunks by index to ensure correct reassembly
    const sortedChunks = chunks.sort((a, b) => a.index - b.index);

    // Verify all chunks are present
    for (let i = 0; i < sortedChunks.length; i++) {
      if (sortedChunks[i].index !== i) {
        throw new Error(`Missing chunk at index ${i} for upload ${uploadId}`);
      }
    }

    // Verify chunk integrity if enabled
    if (this.options.enableIntegrityCheck) {
      for (const chunk of sortedChunks) {
        const calculatedHash = createHash('sha256').update(chunk.data).digest('hex');
        if (calculatedHash !== chunk.hash) {
          progress.errors.push(`Integrity check failed for chunk ${chunk.index}`);
          progress.verified = false;
        }

        progress.processedChunks++;
        progress.currentChunk = chunk.index;
        progress.percentage = (progress.processedChunks / progress.totalChunks) * 100;

        this.emit('chunkVerified', {
          uploadId,
          chunkIndex: chunk.index,
          verified: calculatedHash === chunk.hash,
        });
      }

      if (!progress.verified) {
        throw new Error(`File integrity verification failed: ${progress.errors.join(', ')}`);
      }
    }

    // Reassemble file buffer
    const reassembledBuffer = Buffer.concat(sortedChunks.map((chunk) => chunk.data));

    // Update metadata
    metadata.status = 'completed';
    metadata.completed = new Date();

    this.emit('reassemblyCompleted', { uploadId, totalSize: reassembledBuffer.length });

    return {
      buffer: reassembledBuffer,
      metadata,
      progress,
    };
  }

  // ==================== Resume Capability ====================

  async resumeUpload(uploadId: string): Promise<ChunkMetadata> {
    const metadata = this.activeUploads.get(uploadId);
    if (!metadata) {
      throw new Error(`Upload not found: ${uploadId}`);
    }

    if (!this.options.resumeSupported) {
      throw new Error('Resume capability is disabled');
    }

    // Reset failed chunks to pending for retry
    for (const chunkInfo of metadata.chunks) {
      if (chunkInfo.status === 'failed' && chunkInfo.retries < this.MAX_RETRIES) {
        chunkInfo.status = 'pending';
        chunkInfo.retries++;
      }
    }

    metadata.status = 'uploading';
    this.emit('uploadResumed', { uploadId });

    return metadata;
  }

  async pauseUpload(uploadId: string): Promise<void> {
    const metadata = this.activeUploads.get(uploadId);
    if (!metadata) {
      throw new Error(`Upload not found: ${uploadId}`);
    }

    metadata.status = 'paused';
    this.emit('uploadPaused', { uploadId });
  }

  // ==================== Parallel Processing ====================

  async processChunksParallel(
    uploadId: string,
    processor: (chunk: Chunk) => Promise<void>,
  ): Promise<void> {
    if (!this.options.enableParallelProcessing) {
      throw new Error('Parallel processing is disabled');
    }

    const chunks = this.chunkStorage.get(uploadId);
    const metadata = this.activeUploads.get(uploadId);

    if (!chunks || !metadata) {
      throw new Error(`Upload not found: ${uploadId}`);
    }

    const maxParallel = this.options.maxParallelChunks!;
    const pendingChunks = chunks.filter((chunk) => {
      const chunkInfo = metadata.chunks.find((c) => c.index === chunk.index);
      return chunkInfo && chunkInfo.status === 'pending';
    });

    this.emit('parallelProcessingStarted', {
      uploadId,
      totalChunks: pendingChunks.length,
      maxParallel,
    });

    // Process chunks in parallel batches
    for (let i = 0; i < pendingChunks.length; i += maxParallel) {
      const batch = pendingChunks.slice(i, i + maxParallel);

      const promises = batch.map(async (chunk) => {
        const chunkInfo = metadata.chunks.find((c) => c.index === chunk.index)!;

        try {
          chunkInfo.status = 'uploading';
          this.emit('chunkProcessingStarted', { uploadId, chunkIndex: chunk.index });

          await processor(chunk);

          chunkInfo.status = 'completed';
          chunkInfo.uploadedAt = new Date();
          chunk.uploaded = new Date();

          this.emit('chunkProcessingCompleted', { uploadId, chunkIndex: chunk.index });
        } catch (error) {
          chunkInfo.status = 'failed';
          this.emit('chunkProcessingFailed', { uploadId, chunkIndex: chunk.index, error });
          throw error;
        }
      });

      // Wait for current batch to complete before starting next
      await Promise.all(promises);

      this.emit('batchCompleted', {
        uploadId,
        batchSize: batch.length,
        progress: i + batch.length,
      });
    }

    this.emit('parallelProcessingCompleted', { uploadId });
  }

  // ==================== Upload Management ====================

  getUploadStatus(uploadId: string): ChunkMetadata | null {
    return this.activeUploads.get(uploadId) || null;
  }

  getUploadProgress(
    uploadId: string,
  ): { completed: number; total: number; percentage: number; status: string } | null {
    const metadata = this.activeUploads.get(uploadId);
    if (!metadata) return null;

    const completed = metadata.chunks.filter((c) => c.status === 'completed').length;
    const total = metadata.totalChunks;
    const percentage = (completed / total) * 100;

    return {
      completed,
      total,
      percentage,
      status: metadata.status,
    };
  }

  async deleteUpload(uploadId: string): Promise<void> {
    this.activeUploads.delete(uploadId);
    this.chunkStorage.delete(uploadId);
    this.emit('uploadDeleted', { uploadId });
  }

  listActiveUploads(): string[] {
    return Array.from(this.activeUploads.keys());
  }

  // ==================== Chunk Validation ====================

  async validateChunk(chunk: Chunk): Promise<boolean> {
    if (!this.options.enableIntegrityCheck || !chunk.hash) {
      return true;
    }

    const calculatedHash = createHash('sha256').update(chunk.data).digest('hex');
    const isValid = calculatedHash === chunk.hash;

    if (isValid) {
      chunk.verified = true;
    }

    this.emit('chunkValidated', {
      uploadId: chunk.uploadId,
      chunkIndex: chunk.index,
      valid: isValid,
    });

    return isValid;
  }

  async validateAllChunks(uploadId: string): Promise<{ valid: boolean; invalidChunks: number[] }> {
    const chunks = this.chunkStorage.get(uploadId);
    if (!chunks) {
      throw new Error(`Upload not found: ${uploadId}`);
    }

    const invalidChunks: number[] = [];

    for (const chunk of chunks) {
      const isValid = await this.validateChunk(chunk);
      if (!isValid) {
        invalidChunks.push(chunk.index);
      }
    }

    const valid = invalidChunks.length === 0;

    this.emit('allChunksValidated', { uploadId, valid, invalidChunks });

    return { valid, invalidChunks };
  }

  // ==================== Utility Methods ====================

  private generateUploadId(): string {
    return randomBytes(16).toString('hex');
  }

  getChunkingStats(): {
    activeUploads: number;
    totalChunks: number;
    completedUploads: number;
    failedUploads: number;
  } {
    const uploads = Array.from(this.activeUploads.values());

    return {
      activeUploads: uploads.length,
      totalChunks: uploads.reduce((sum, upload) => sum + upload.totalChunks, 0),
      completedUploads: uploads.filter((u) => u.status === 'completed').length,
      failedUploads: uploads.filter((u) => u.status === 'failed').length,
    };
  }

  // ==================== Configuration ====================

  updateOptions(newOptions: Partial<ChunkingOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.emit('optionsUpdated', this.options);
  }

  getOptions(): ChunkingOptions {
    return { ...this.options };
  }
}

// ==================== Helper Functions ====================

/**
 * Calculate optimal chunk size based on file size and connection speed
 */
export function calculateOptimalChunkSize(fileSize: number, connectionSpeed?: number): number {
  const DEFAULT_CHUNK_SIZE = 1048576; // 1MB
  const MIN_CHUNK_SIZE = 65536; // 64KB
  const MAX_CHUNK_SIZE = 10485760; // 10MB

  // For small files, use smaller chunks
  if (fileSize < 10485760) {
    // < 10MB
    return MIN_CHUNK_SIZE;
  }

  // For large files, use larger chunks
  if (fileSize > 1073741824) {
    // > 1GB
    return MAX_CHUNK_SIZE;
  }

  // Default for medium files
  return DEFAULT_CHUNK_SIZE;
}

/**
 * Estimate upload time based on file size, chunk size, and connection speed
 */
export function estimateUploadTime(
  fileSize: number,
  chunkSize: number,
  connectionSpeedBps: number,
  parallelChunks: number = 1,
): { totalTime: number; chunks: number; timePerChunk: number } {
  const chunks = Math.ceil(fileSize / chunkSize);
  const timePerChunk = chunkSize / connectionSpeedBps;
  const totalTime = Math.ceil(chunks / parallelChunks) * timePerChunk;

  return {
    totalTime,
    chunks,
    timePerChunk,
  };
}

// ==================== Export Types and Constants ====================

export const CHUNK_SIZES = {
  SMALL: 65536, // 64KB - for slow connections
  MEDIUM: 1048576, // 1MB - default/optimal
  LARGE: 5242880, // 5MB - for fast connections
  XLARGE: 10485760, // 10MB - for very fast connections
} as const;

export const CHUNK_EVENTS = {
  CHUNKING_STARTED: 'chunkingStarted',
  CHUNK_CREATED: 'chunkCreated',
  CHUNKING_COMPLETED: 'chunkingCompleted',
  REASSEMBLY_STARTED: 'reassemblyStarted',
  CHUNK_VERIFIED: 'chunkVerified',
  REASSEMBLY_COMPLETED: 'reassemblyCompleted',
  UPLOAD_RESUMED: 'uploadResumed',
  UPLOAD_PAUSED: 'uploadPaused',
  PARALLEL_PROCESSING_STARTED: 'parallelProcessingStarted',
  CHUNK_PROCESSING_STARTED: 'chunkProcessingStarted',
  CHUNK_PROCESSING_COMPLETED: 'chunkProcessingCompleted',
  CHUNK_PROCESSING_FAILED: 'chunkProcessingFailed',
  BATCH_COMPLETED: 'batchCompleted',
  PARALLEL_PROCESSING_COMPLETED: 'parallelProcessingCompleted',
  UPLOAD_DELETED: 'uploadDeleted',
  CHUNK_VALIDATED: 'chunkValidated',
  ALL_CHUNKS_VALIDATED: 'allChunksValidated',
  OPTIONS_UPDATED: 'optionsUpdated',
} as const;
