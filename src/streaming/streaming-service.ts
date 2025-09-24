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

import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';

import type { DatabaseAdapter } from '../overlay/brc26-uhrp';

import { ChunkingEngine, type Chunk, type ChunkMetadata, CHUNK_SIZES } from './chunking-engine';
import {
  P2PDistributionNetwork,
  type P2PHost,
  type ContentAdvertisement,
} from './p2p-distribution';
import {
  HLSPlaylistGenerator,
  DASHManifestGenerator,
  type HLSPlaylist,
  type DASHManifest,
} from './playlist-generator';
import {
  TranscodingPipeline,
  type TranscodingJob,
  type TranscodingProfile,
  type VideoMetadata,
  STREAMING_PROFILES,
} from './transcoding-pipeline';

// ==================== Core Types ====================

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
      hls?: string; // Master playlist path
      dash?: string; // DASH manifest path
    };
  };
  p2p: {
    advertised: boolean;
    hosts: number;
    availability: number; // 0-1
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
  totalStorage: number; // bytes
  totalBandwidth: number; // bps
  p2pHosts: number;
  activeStreams: number;
}

// ==================== Main Streaming Service ====================

export class StreamingService extends EventEmitter {
  private chunker: ChunkingEngine;
  private transcoder: TranscodingPipeline;
  private hlsGenerator: HLSPlaylistGenerator;
  private dashGenerator: DASHManifestGenerator;
  private p2pNetwork: P2PDistributionNetwork;

  private streamingFiles = new Map<string, StreamingFile>();
  private activeStreams = new Map<string, { viewers: number; bandwidth: number }>();

  constructor(
    private database: DatabaseAdapter,
    private storageDir: string = '/tmp/streaming',
    private myHostId: string,
    private myEndpoint: string,
    private options: {
      maxConcurrentTranscodings?: number;
      chunkingOptions?: any;
      p2pEnabled?: boolean;
    } = {},
  ) {
    super();

    // Initialize components
    this.chunker = new ChunkingEngine(options.chunkingOptions);
    this.transcoder = new TranscodingPipeline(storageDir);
    this.hlsGenerator = new HLSPlaylistGenerator();
    this.dashGenerator = new DASHManifestGenerator();

    if (options.p2pEnabled !== false) {
      this.p2pNetwork = new P2PDistributionNetwork(database, myHostId, myEndpoint);
    }

    this.setupEventHandlers();
    this.startMaintenanceLoop();
  }

  // ==================== File Upload and Chunking ====================

  async initiateUpload(
    fileName: string,
    contentType: string,
    totalSize: number,
    options: StreamingOptions = {},
  ): Promise<{ fileId: string; uploadId: string; chunkSize: number }> {
    const fileId = this.generateFileId();
    const chunkSize = options.chunkSize || this.calculateOptimalChunkSize(totalSize);

    const streamingFile: StreamingFile = {
      fileId,
      originalFileName: fileName,
      contentType,
      totalSize,
      uploadId: '', // Will be set when chunking starts
      status: 'uploading',
      chunks: {
        total: Math.ceil(totalSize / chunkSize),
        uploaded: 0,
        chunkSize,
        metadata: {} as ChunkMetadata,
      },
      streaming: {
        formats: [],
        playlists: {},
      },
      p2p: {
        advertised: false,
        hosts: 0,
        availability: 0,
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (options.expiryHours || 168) * 60 * 60 * 1000), // Default 7 days
    };

    this.streamingFiles.set(fileId, streamingFile);

    this.emit('uploadInitiated', { fileId, fileName, totalSize });

    return { fileId, uploadId: fileId, chunkSize };
  }

  async uploadChunk(
    fileId: string,
    chunkIndex: number,
    chunkData: Buffer,
  ): Promise<{ success: boolean; uploadProgress: number }> {
    const file = this.streamingFiles.get(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    if (file.status !== 'uploading') {
      throw new Error(`Cannot upload chunk to file in status: ${file.status}`);
    }

    // Store chunk
    const chunkPath = join(this.storageDir, fileId, 'chunks', `chunk_${chunkIndex}`);
    await fs.mkdir(dirname(chunkPath), { recursive: true });
    await fs.writeFile(chunkPath, chunkData);

    // Update progress
    file.chunks.uploaded++;
    const uploadProgress = (file.chunks.uploaded / file.chunks.total) * 100;

    this.emit('chunkUploaded', { fileId, chunkIndex, progress: uploadProgress });

    // Check if upload is complete
    if (file.chunks.uploaded >= file.chunks.total) {
      await this.completeUpload(fileId);
    }

    return { success: true, uploadProgress };
  }

  async completeUpload(fileId: string): Promise<void> {
    const file = this.streamingFiles.get(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    file.status = 'processing';

    // Reassemble file from chunks
    await this.reassembleFile(fileId);

    // Start processing pipeline
    if (this.isVideoFile(file.contentType)) {
      await this.startVideoProcessing(fileId);
    } else {
      await this.startFileProcessing(fileId);
    }

    this.emit('uploadCompleted', { fileId });
  }

  // ==================== Video Processing Pipeline ====================

  private async startVideoProcessing(fileId: string): Promise<void> {
    const file = this.streamingFiles.get(fileId);
    if (!file) return;

    file.status = 'transcoding';

    const inputPath = join(this.storageDir, fileId, 'original', file.originalFileName);
    const profiles = this.getTranscodingProfiles(file.totalSize);

    try {
      const transcodingJob = await this.transcoder.transcodeVideo(inputPath, profiles, {
        customOutputDir: join(this.storageDir, fileId, 'transcoded'),
      });

      file.transcoding = {
        jobId: transcodingJob.jobId,
        profiles: profiles.map((p) => p.profileId),
        status: 'processing',
      };

      this.emit('transcodingStarted', { fileId, jobId: transcodingJob.jobId });
    } catch (error) {
      file.status = 'failed';
      this.emit('processingFailed', { fileId, error });
    }
  }

  private async onTranscodingCompleted(jobId: string): Promise<void> {
    const file = Array.from(this.streamingFiles.values()).find(
      (f) => f.transcoding?.jobId === jobId,
    );
    if (!file) return;

    const job = this.transcoder.getJob(jobId);
    if (!job || job.status !== 'completed') return;

    file.transcoding!.status = 'completed';

    // Generate streaming formats
    for (const output of job.outputs) {
      if (output.status !== 'completed') continue;

      const profile = job.profiles.find((p) => p.profileId === output.profileId);
      if (!profile) continue;

      const format: StreamingFormat = {
        profileId: output.profileId,
        quality: profile.quality,
        format: profile.format,
        bitrate: profile.bitrate,
        resolution: profile.resolution,
        path: output.outputPath,
        playlistPath: output.playlistPath,
        manifestPath: output.manifestPath,
        segments: output.segments,
        ready: true,
      };

      file.streaming.formats.push(format);
    }

    // Generate master playlists
    await this.generateMasterPlaylists(file.fileId);

    // Setup P2P distribution
    if (this.p2pNetwork) {
      await this.setupP2PDistribution(file.fileId);
    }

    file.status = 'ready';
    file.processedAt = new Date();

    this.emit('processingCompleted', { fileId: file.fileId });
  }

  // ==================== Playlist Generation ====================

  private async generateMasterPlaylists(fileId: string): Promise<void> {
    const file = this.streamingFiles.get(fileId);
    if (!file) return;

    const outputDir = join(this.storageDir, fileId, 'playlists');
    await fs.mkdir(outputDir, { recursive: true });

    // Generate HLS master playlist
    const hlsVariants = file.streaming.formats
      .filter((f) => f.format === 'hls')
      .map((format) => ({
        profile: this.getProfileById(format.profileId),
        playlistPath: format.playlistPath!,
      }));

    if (hlsVariants.length > 0) {
      const hlsMasterPath = join(outputDir, 'master.m3u8');
      await this.hlsGenerator.generateMasterPlaylist(hlsVariants, hlsMasterPath);
      file.streaming.playlists.hls = hlsMasterPath;
    }

    // Generate DASH manifest
    const dashRepresentations = file.streaming.formats
      .filter((f) => f.format === 'dash')
      .map((format) => ({
        profile: this.getProfileById(format.profileId),
        outputPath: format.path,
        segments: format.segments,
      }));

    if (dashRepresentations.length > 0) {
      const dashManifestPath = join(outputDir, 'manifest.mpd');
      await this.dashGenerator.generateManifest(dashRepresentations, dashManifestPath);
      file.streaming.playlists.dash = dashManifestPath;
    }
  }

  // ==================== P2P Distribution ====================

  private async setupP2PDistribution(fileId: string): Promise<void> {
    if (!this.p2pNetwork) return;

    const file = this.streamingFiles.get(fileId);
    if (!file) return;

    // Chunk ready formats for P2P distribution
    for (const format of file.streaming.formats) {
      if (!format.ready) continue;

      // Create chunks for this format
      const formatBuffer = await fs.readFile(format.path);
      const chunking = await this.chunker.chunkFile(
        formatBuffer,
        `${file.originalFileName}_${format.profileId}`,
        file.contentType,
      );

      // Calculate checksums
      const checksums = chunking.chunks.map((chunk) => chunk.hash);

      // Advertise content
      await this.p2pNetwork.advertiseContent(
        formatBuffer.toString('hex'), // Content hash
        chunking.chunks.map((c) => c.index), // Available chunks
        chunking.chunks.length,
        {
          contentType: file.contentType,
          totalSize: formatBuffer.length,
          chunkSize: chunking.chunks[0]?.size || 0,
          checksums,
        },
        {
          requiresAuth: false,
          requiresPayment: false,
          bandwidth: format.bitrate,
          priority: 'normal',
        },
      );
    }

    file.p2p.advertised = true;

    this.emit('p2pAdvertised', { fileId });
  }

  // ==================== Content Delivery ====================

  async getStreamingInfo(fileId: string): Promise<{
    file: StreamingFile;
    streamingUrls: {
      hls?: string;
      dash?: string;
      mp4?: string[];
      webm?: string[];
    };
  }> {
    const file = this.streamingFiles.get(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    const streamingUrls: any = {};

    // HLS streaming URL
    if (file.streaming.playlists.hls) {
      streamingUrls.hls = `${this.myEndpoint}/streaming/hls/${fileId}/master.m3u8`;
    }

    // DASH streaming URL
    if (file.streaming.playlists.dash) {
      streamingUrls.dash = `${this.myEndpoint}/streaming/dash/${fileId}/manifest.mpd`;
    }

    // Direct file URLs
    const mp4Formats = file.streaming.formats.filter((f) => f.format === 'mp4');
    if (mp4Formats.length > 0) {
      streamingUrls.mp4 = mp4Formats.map(
        (f) => `${this.myEndpoint}/streaming/mp4/${fileId}/${f.profileId}.mp4`,
      );
    }

    const webmFormats = file.streaming.formats.filter((f) => f.format === 'webm');
    if (webmFormats.length > 0) {
      streamingUrls.webm = webmFormats.map(
        (f) => `${this.myEndpoint}/streaming/webm/${fileId}/${f.profileId}.webm`,
      );
    }

    return { file, streamingUrls };
  }

  async getFileChunk(fileId: string, chunkIndex: number): Promise<Buffer> {
    const chunkPath = join(this.storageDir, fileId, 'chunks', `chunk_${chunkIndex}`);
    return await fs.readFile(chunkPath);
  }

  async getHLSPlaylist(fileId: string, playlistType: 'master' | string): Promise<string> {
    const file = this.streamingFiles.get(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    if (playlistType === 'master') {
      if (!file.streaming.playlists.hls) {
        throw new Error(`HLS master playlist not available for file: ${fileId}`);
      }
      return await fs.readFile(file.streaming.playlists.hls, 'utf8');
    }

    // Individual quality playlist
    const format = file.streaming.formats.find(
      (f) => f.profileId === playlistType && f.format === 'hls',
    );
    if (!format?.playlistPath) {
      throw new Error(`HLS playlist not found for profile: ${playlistType}`);
    }

    return await fs.readFile(format.playlistPath, 'utf8');
  }

  async getDASHManifest(fileId: string): Promise<string> {
    const file = this.streamingFiles.get(fileId);
    if (!file?.streaming.playlists.dash) {
      throw new Error(`DASH manifest not available for file: ${fileId}`);
    }

    return await fs.readFile(file.streaming.playlists.dash, 'utf8');
  }

  // ==================== Helper Methods ====================

  private async reassembleFile(fileId: string): Promise<void> {
    const file = this.streamingFiles.get(fileId);
    if (!file) return;

    const chunks: Buffer[] = [];

    for (let i = 0; i < file.chunks.total; i++) {
      const chunkPath = join(this.storageDir, fileId, 'chunks', `chunk_${i}`);
      const chunkData = await fs.readFile(chunkPath);
      chunks.push(chunkData);
    }

    const reassembledBuffer = Buffer.concat(chunks);
    const originalPath = join(this.storageDir, fileId, 'original');
    await fs.mkdir(originalPath, { recursive: true });
    await fs.writeFile(join(originalPath, file.originalFileName), reassembledBuffer);
  }

  private async startFileProcessing(fileId: string): Promise<void> {
    const file = this.streamingFiles.get(fileId);
    if (!file) return;

    // For non-video files, just setup direct serving
    file.status = 'ready';
    file.processedAt = new Date();

    this.emit('processingCompleted', { fileId });
  }

  private isVideoFile(contentType: string): boolean {
    return contentType.startsWith('video/');
  }

  private calculateOptimalChunkSize(fileSize: number): number {
    if (fileSize < 10 * 1024 * 1024) {
      // < 10MB
      return CHUNK_SIZES.SMALL;
    } else if (fileSize < 100 * 1024 * 1024) {
      // < 100MB
      return CHUNK_SIZES.MEDIUM;
    } else if (fileSize < 1024 * 1024 * 1024) {
      // < 1GB
      return CHUNK_SIZES.LARGE;
    } else {
      return CHUNK_SIZES.XLARGE;
    }
  }

  private getTranscodingProfiles(fileSize: number): TranscodingProfile[] {
    // Return appropriate profiles based on file size
    if (fileSize < 100 * 1024 * 1024) {
      // < 100MB
      return [STREAMING_PROFILES.VIDEO_480P, STREAMING_PROFILES.VIDEO_720P];
    } else if (fileSize < 500 * 1024 * 1024) {
      // < 500MB
      return [
        STREAMING_PROFILES.VIDEO_240P,
        STREAMING_PROFILES.VIDEO_480P,
        STREAMING_PROFILES.VIDEO_720P,
      ];
    } else {
      return [
        STREAMING_PROFILES.VIDEO_240P,
        STREAMING_PROFILES.VIDEO_480P,
        STREAMING_PROFILES.VIDEO_720P,
        STREAMING_PROFILES.VIDEO_1080P,
      ];
    }
  }

  private getProfileById(profileId: string): TranscodingProfile {
    const profiles = Object.values(STREAMING_PROFILES);
    return profiles.find((p) => p.profileId === profileId) || STREAMING_PROFILES.VIDEO_720P;
  }

  private generateFileId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventHandlers(): void {
    this.transcoder.on('jobCompleted', (event) => {
      this.onTranscodingCompleted(event.jobId);
    });

    this.chunker.on('chunkingCompleted', (event) => {
      this.emit('chunkingCompleted', event);
    });

    if (this.p2pNetwork) {
      this.p2pNetwork.on('contentAdvertised', (event) => {
        this.emit('p2pContentAdvertised', event);
      });
    }
  }

  private startMaintenanceLoop(): void {
    setInterval(() => {
      this.cleanupExpiredFiles();
      this.updateStreamingStats();
    }, 60000); // Every minute
  }

  private async cleanupExpiredFiles(): Promise<void> {
    const now = new Date();
    const expiredFiles: string[] = [];

    for (const [fileId, file] of this.streamingFiles) {
      if (file.expiresAt < now) {
        expiredFiles.push(fileId);
      }
    }

    for (const fileId of expiredFiles) {
      await this.deleteFile(fileId);
    }
  }

  private updateStreamingStats(): void {
    const stats = this.getStats();
    this.emit('statsUpdated', stats);
  }

  // ==================== Public API ====================

  getFile(fileId: string): StreamingFile | null {
    return this.streamingFiles.get(fileId) || null;
  }

  async deleteFile(fileId: string): Promise<boolean> {
    const file = this.streamingFiles.get(fileId);
    if (!file) return false;

    try {
      // Cancel transcoding if running
      if (file.transcoding && file.transcoding.status === 'processing') {
        await this.transcoder.cancelJob(file.transcoding.jobId);
      }

      // Remove file directory
      const filePath = join(this.storageDir, fileId);
      await fs.rm(filePath, { recursive: true, force: true });

      // Remove from memory
      this.streamingFiles.delete(fileId);

      this.emit('fileDeleted', { fileId });
      return true;
    } catch (error) {
      this.emit('fileDeletionFailed', { fileId, error });
      return false;
    }
  }

  listFiles(status?: StreamingFile['status']): StreamingFile[] {
    const files = Array.from(this.streamingFiles.values());
    return status ? files.filter((f) => f.status === status) : files;
  }

  getStats(): StreamingStats {
    const files = Array.from(this.streamingFiles.values());
    const totalStorage = files.reduce((sum, f) => sum + f.totalSize, 0);
    const totalBandwidth = files
      .filter((f) => f.status === 'ready')
      .reduce((sum, f) => sum + f.streaming.formats.reduce((s, fmt) => s + fmt.bitrate, 0), 0);

    return {
      totalFiles: this.streamingFiles.size,
      processingFiles: files.filter((f) => f.status === 'processing' || f.status === 'transcoding')
        .length,
      readyFiles: files.filter((f) => f.status === 'ready').length,
      totalStorage,
      totalBandwidth,
      p2pHosts: this.p2pNetwork ? this.p2pNetwork.getNetworkStats().hosts : 0,
      activeStreams: this.activeStreams.size,
    };
  }

  async getUploadStatus(fileId: string): Promise<{
    status: string;
    progress: number;
    chunksUploaded: number;
    totalChunks: number;
  } | null> {
    const file = this.streamingFiles.get(fileId);
    if (!file) return null;

    const progress = file.chunks.total > 0 ? (file.chunks.uploaded / file.chunks.total) * 100 : 0;

    return {
      status: file.status,
      progress,
      chunksUploaded: file.chunks.uploaded,
      totalChunks: file.chunks.total,
    };
  }
}

// ==================== Export Types and Events ====================

export const STREAMING_EVENTS = {
  UPLOAD_INITIATED: 'uploadInitiated',
  CHUNK_UPLOADED: 'chunkUploaded',
  UPLOAD_COMPLETED: 'uploadCompleted',
  TRANSCODING_STARTED: 'transcodingStarted',
  PROCESSING_COMPLETED: 'processingCompleted',
  PROCESSING_FAILED: 'processingFailed',
  P2P_ADVERTISED: 'p2pAdvertised',
  P2P_CONTENT_ADVERTISED: 'p2pContentAdvertised',
  FILE_DELETED: 'fileDeleted',
  FILE_DELETION_FAILED: 'fileDeletionFailed',
  STATS_UPDATED: 'statsUpdated',
  CHUNKING_COMPLETED: 'chunkingCompleted',
} as const;
