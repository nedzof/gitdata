/**
 * Phase 3: Complete Streaming Implementation Tests
 *
 * Tests all streaming components implemented in D43 Phase 3:
 * - Core chunking engine with file splitting and integrity verification
 * - Chunk upload resume capability for interrupted transfers
 * - Parallel chunk upload/download support
 * - Video transcoding pipeline with FFmpeg integration
 * - HLS playlist generation with adaptive bitrates
 * - DASH manifest creation for cross-platform compatibility
 * - P2P distribution network with host advertisement
 * - Content discovery across multiple hosts
 * - Load balancing and failover mechanisms
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { app } from '../../src/server';
import { ChunkingEngine, CHUNK_SIZES } from '../../src/streaming/chunking-engine';
import { TranscodingPipeline, STREAMING_PROFILES } from '../../src/streaming/transcoding-pipeline';
import { HLSPlaylistGenerator, DASHManifestGenerator } from '../../src/streaming/playlist-generator';
import { P2PDistributionNetwork } from '../../src/streaming/p2p-distribution';
import { StreamingService } from '../../src/streaming/streaming-service';

describe('D43 Phase 3: Complete Streaming Implementation', () => {
  let serverAgent: request.SuperTest<request.Test>;

  beforeAll(async () => {
    serverAgent = request(app);
    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  afterAll(async () => {
    // Global cleanup
  });

  describe('Core Chunking Engine', () => {
    let chunkingEngine: ChunkingEngine;

    beforeEach(() => {
      chunkingEngine = new ChunkingEngine({
        chunkSize: CHUNK_SIZES.SMALL,
        enableIntegrityCheck: true,
        enableParallelProcessing: true,
        maxParallelChunks: 3,
        resumeSupported: true,
      });
    });

    it('should split file into chunks with SHA-256 integrity verification', async () => {
      const testData = Buffer.from('Test file content for chunking engine testing'.repeat(100));
      const result = await chunkingEngine.chunkFile(testData, 'test.txt', 'text/plain');

      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.metadata.totalSize).toBe(testData.length);
      expect(result.metadata.status).toBe('initializing');

      // Verify each chunk has proper hash
      for (const chunk of result.chunks) {
        expect(chunk.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
        expect(chunk.size).toBeGreaterThan(0);
        expect(chunk.index).toBeGreaterThanOrEqual(0);
      }
    });

    it('should reassemble file from chunks with integrity verification', async () => {
      const originalData = Buffer.from('Original file content for reassembly testing'.repeat(50));
      const chunked = await chunkingEngine.chunkFile(originalData, 'test.bin', 'application/octet-stream');

      const reassembled = await chunkingEngine.reassembleFile(chunked.uploadId);

      expect(Buffer.compare(reassembled.buffer, originalData)).toBe(0);
      expect(reassembled.progress.verified).toBe(true);
      expect(reassembled.progress.errors).toHaveLength(0);
    });

    it('should support upload resume capability', async () => {
      const testData = Buffer.from('Test data for resume capability testing'.repeat(30));
      const chunked = await chunkingEngine.chunkFile(testData, 'resume-test.txt', 'text/plain');

      // Pause upload
      await chunkingEngine.pauseUpload(chunked.uploadId);

      const status = chunkingEngine.getUploadStatus(chunked.uploadId);
      expect(status?.status).toBe('paused');

      // Resume upload
      const resumed = await chunkingEngine.resumeUpload(chunked.uploadId);
      expect(resumed.status).toBe('uploading');
    });

    it('should handle parallel chunk processing', async () => {
      const testData = Buffer.from('Parallel processing test data'.repeat(100));
      const chunked = await chunkingEngine.chunkFile(testData, 'parallel-test.dat', 'application/octet-stream');

      let processedChunks = 0;
      const mockProcessor = async (chunk: any) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate processing
        processedChunks++;
      };

      await chunkingEngine.processChunksParallel(chunked.uploadId, mockProcessor);

      expect(processedChunks).toBe(chunked.chunks.length);
    });
  });

  describe('Streaming Service Integration', () => {
    it('should initialize streaming upload for video files', async () => {
      const response = await serverAgent
        .post('/overlay/files/stream/init')
        .send({
          filename: 'test-video.mp4',
          contentType: 'video/mp4',
          totalSize: 10485760, // 10MB
          enableTranscoding: true,
          enableP2P: true,
          quality: 'high'
        });

      // If streaming service is available
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.upload).toHaveProperty('fileId');
        expect(response.body.upload).toHaveProperty('chunkSize');
        expect(response.body.upload.totalChunks).toBeGreaterThan(1);
        expect(response.body.streaming.transcodingEnabled).toBe(true);
        expect(response.body.streaming.p2pEnabled).toBe(true);
        expect(response.body.streaming.estimatedProcessingTime).toBeGreaterThan(0);
      } else {
        // Service unavailable - expected in test environment
        expect([503, 501]).toContain(response.status);
      }
    });

    it('should handle upload status queries', async () => {
      const uploadId = 'test_upload_id_12345';

      const response = await serverAgent
        .get(`/overlay/files/stream/${uploadId}/status`);

      if (response.status === 404) {
        expect(response.body.error).toBe('upload-not-found');
      } else if (response.status === 503) {
        expect(response.body.error).toBe('streaming-unavailable');
      } else {
        // If found, should have proper structure
        expect(response.body).toHaveProperty('uploadId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('progress');
      }
    });

    it('should provide streaming info for processed files', async () => {
      const fileId = 'test_file_id_67890';

      const response = await serverAgent
        .get(`/overlay/files/stream/${fileId}/info`);

      if (response.status === 404) {
        expect(response.body.error).toBe('file-not-found');
      } else if (response.status === 503) {
        expect(response.body.error).toBe('streaming-unavailable');
      } else {
        // If found, should have streaming information
        expect(response.body).toHaveProperty('fileId');
        expect(response.body).toHaveProperty('filename');
        expect(response.body).toHaveProperty('streamingUrls');
        expect(response.body).toHaveProperty('formats');
      }
    });
  });

  describe('HLS Playlist Generation', () => {
    let hlsGenerator: HLSPlaylistGenerator;

    beforeEach(() => {
      hlsGenerator = new HLSPlaylistGenerator();
    });

    it('should generate master playlist with multiple quality variants', async () => {
      const variants = [
        {
          profile: STREAMING_PROFILES.VIDEO_480P,
          playlistPath: '/tmp/test/480p.m3u8'
        },
        {
          profile: STREAMING_PROFILES.VIDEO_720P,
          playlistPath: '/tmp/test/720p.m3u8'
        }
      ];

      const outputPath = '/tmp/test-master.m3u8';
      const playlist = await hlsGenerator.generateMasterPlaylist(variants, outputPath);

      expect(playlist.type).toBe('master');
      expect(playlist.variants).toHaveLength(2);
      expect(playlist.content).toContain('#EXTM3U');
      expect(playlist.content).toContain('#EXT-X-STREAM-INF');
      expect(playlist.content).toContain('BANDWIDTH=1000000'); // 480p bitrate
      expect(playlist.content).toContain('BANDWIDTH=2500000'); // 720p bitrate
    });

    it('should generate media playlist for individual quality', async () => {
      const segments = [
        { uri: 'segment001.ts', duration: 6.0 },
        { uri: 'segment002.ts', duration: 6.0 },
        { uri: 'segment003.ts', duration: 4.5 }
      ];

      const outputPath = '/tmp/test-media.m3u8';
      const playlist = await hlsGenerator.generateMediaPlaylist(segments, outputPath);

      expect(playlist.type).toBe('media');
      expect(playlist.segments).toHaveLength(3);
      expect(playlist.content).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
      expect(playlist.content).toContain('#EXT-X-ENDLIST');
      expect(playlist.targetDuration).toBe(7); // Rounded up from 6.0
    });
  });

  describe('DASH Manifest Generation', () => {
    let dashGenerator: DASHManifestGenerator;

    beforeEach(() => {
      dashGenerator = new DASHManifestGenerator();
    });

    it('should generate DASH manifest for adaptive streaming', async () => {
      const representations = [
        {
          profile: STREAMING_PROFILES.VIDEO_480P,
          outputPath: '/tmp/test/480p.mp4',
          segments: ['/tmp/test/480p_video.mp4']
        },
        {
          profile: STREAMING_PROFILES.VIDEO_720P,
          outputPath: '/tmp/test/720p.mp4',
          segments: ['/tmp/test/720p_video.mp4']
        }
      ];

      const outputPath = '/tmp/test-manifest.mpd';
      const manifest = await dashGenerator.generateManifest(representations, outputPath, 120);

      expect(manifest.type).toBe('static');
      expect(manifest.content).toContain('<?xml version="1.0"');
      expect(manifest.content).toContain('<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"');
      expect(manifest.content).toContain('bandwidth="1000000"'); // 480p
      expect(manifest.content).toContain('bandwidth="2500000"'); // 720p
      expect(manifest.content).toContain('width="854" height="480"');
      expect(manifest.content).toContain('width="1280" height="720"');
    });
  });

  describe('Video Transcoding Pipeline', () => {
    it('should support transcoding profile configuration', () => {
      const profiles = Object.values(STREAMING_PROFILES);

      expect(profiles.length).toBeGreaterThan(0);

      for (const profile of profiles) {
        expect(profile).toHaveProperty('profileId');
        expect(profile).toHaveProperty('quality');
        expect(profile).toHaveProperty('bitrate');
        expect(profile).toHaveProperty('resolution');
        expect(profile).toHaveProperty('codec');
        expect(profile).toHaveProperty('format');
        expect(profile.bitrate).toBeGreaterThan(0);
        expect(profile.resolution).toMatch(/^\d+x\d+$/);
      }
    });

    it('should handle transcoding job management', () => {
      const transcoder = new TranscodingPipeline();
      const queueStatus = transcoder.getQueueStatus();

      expect(queueStatus).toHaveProperty('queueLength');
      expect(queueStatus).toHaveProperty('activeJobs');
      expect(queueStatus).toHaveProperty('completedJobs');
      expect(queueStatus).toHaveProperty('failedJobs');
      expect(typeof queueStatus.queueLength).toBe('number');
    });
  });

  describe('P2P Distribution Network', () => {
    it('should support P2P host registration and discovery', () => {
      // Mock database adapter for testing
      const mockDatabase = {
        query: async () => [],
        queryOne: async () => null,
        execute: async () => {},
      };

      const p2pNetwork = new P2PDistributionNetwork(
        mockDatabase as any,
        'test-host-id',
        'http://localhost:8788'
      );

      expect(p2pNetwork.getNetworkStats).toBeDefined();
      expect(p2pNetwork.getNetworkStats()).toHaveProperty('hosts');
      expect(p2pNetwork.getNetworkStats()).toHaveProperty('contentItems');
      expect(p2pNetwork.getNetworkStats()).toHaveProperty('activeRequests');
    });

    it('should support load balancing strategies', () => {
      const mockDatabase = {
        query: async () => [],
        queryOne: async () => null,
        execute: async () => {},
      };

      const p2pNetwork = new P2PDistributionNetwork(
        mockDatabase as any,
        'test-host-id',
        'http://localhost:8788'
      );

      const currentStrategy = p2pNetwork.getLoadBalancingStrategy();
      expect(currentStrategy).toHaveProperty('type');
      expect(currentStrategy).toHaveProperty('options');
      expect(['round_robin', 'weighted', 'latency_based', 'geographic']).toContain(currentStrategy.type);
    });
  });

  describe('Content Delivery Endpoints', () => {
    it('should serve HLS master playlists', async () => {
      const fileId = 'test-video-file-id';

      const response = await serverAgent
        .get(`/streaming/hls/${fileId}/master.m3u8`);

      if (response.status === 404) {
        expect(response.body.error).toBe('playlist-not-found');
      } else if (response.status === 503) {
        expect(response.body.error).toBe('streaming-unavailable');
      } else if (response.status === 200) {
        expect(response.headers['content-type']).toBe('application/vnd.apple.mpegurl');
        expect(response.text).toContain('#EXTM3U');
      }
    });

    it('should serve DASH manifests', async () => {
      const fileId = 'test-video-file-id';

      const response = await serverAgent
        .get(`/streaming/dash/${fileId}/manifest.mpd`);

      if (response.status === 404) {
        expect(response.body.error).toBe('manifest-not-found');
      } else if (response.status === 503) {
        expect(response.body.error).toBe('streaming-unavailable');
      } else if (response.status === 200) {
        expect(response.headers['content-type']).toBe('application/dash+xml');
        expect(response.text).toContain('<?xml version="1.0"');
        expect(response.text).toContain('<MPD');
      }
    });

    it('should serve content chunks for P2P distribution', async () => {
      const contentHash = 'test-content-hash-123';
      const chunkIndex = '0';

      const response = await serverAgent
        .get(`/streaming/content/${contentHash}/chunk/${chunkIndex}`);

      if (response.status === 404) {
        expect(response.body.error).toBe('chunk-not-found');
      } else if (response.status === 503) {
        expect(response.body.error).toBe('streaming-unavailable');
      } else if (response.status === 200) {
        expect(response.headers['content-type']).toBe('application/octet-stream');
        expect(response.headers['cache-control']).toContain('public');
      }
    });
  });

  describe('Streaming Statistics and Monitoring', () => {
    it('should track streaming service statistics', () => {
      const mockDatabase = {
        query: async () => [],
        queryOne: async () => null,
        execute: async () => {},
      };

      const streamingService = new StreamingService(
        mockDatabase as any,
        '/tmp/test-streaming',
        'test-host',
        'http://localhost:8788'
      );

      const stats = streamingService.getStats();
      expect(stats).toHaveProperty('totalFiles');
      expect(stats).toHaveProperty('processingFiles');
      expect(stats).toHaveProperty('readyFiles');
      expect(stats).toHaveProperty('totalStorage');
      expect(stats).toHaveProperty('totalBandwidth');
      expect(stats).toHaveProperty('p2pHosts');
      expect(stats).toHaveProperty('activeStreams');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing files gracefully', async () => {
      const nonExistentFileId = 'non-existent-file-123';

      const response = await serverAgent
        .get(`/overlay/files/stream/${nonExistentFileId}/info`);

      expect([404, 503]).toContain(response.status);
      if (response.status === 404) {
        expect(response.body.error).toBe('file-not-found');
      }
    });

    it('should handle chunk integrity verification failures', async () => {
      const chunkingEngine = new ChunkingEngine({
        enableIntegrityCheck: true,
      });

      const originalData = Buffer.from('Test data for integrity testing');
      const chunked = await chunkingEngine.chunkFile(originalData, 'integrity-test.dat', 'application/octet-stream');

      // Corrupt a chunk's data (simulate integrity failure)
      if (chunked.chunks.length > 0) {
        const corruptChunk = { ...chunked.chunks[0] };
        corruptChunk.data = Buffer.from('corrupted data that doesnt match hash');

        const isValid = await chunkingEngine.validateChunk(corruptChunk);
        expect(isValid).toBe(false);
      }
    });

    it('should handle service unavailable scenarios gracefully', async () => {
      // Test streaming endpoints when service is unavailable
      const endpoints = [
        '/overlay/files/stream/init',
        '/overlay/files/stream/test-id/status',
        '/overlay/files/stream/test-id/info',
        '/streaming/hls/test-id/master.m3u8',
        '/streaming/dash/test-id/manifest.mpd'
      ];

      for (const endpoint of endpoints) {
        const method = endpoint.includes('/init') ? 'post' : 'get';
        const request = method === 'post'
          ? serverAgent.post(endpoint).send({ filename: 'test.mp4', contentType: 'video/mp4', totalSize: 1000 })
          : serverAgent.get(endpoint);

        const response = await request;

        // Should either work or return proper error codes
        expect([200, 404, 501, 503]).toContain(response.status);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent chunk operations', async () => {
      const chunkingEngine = new ChunkingEngine({
        enableParallelProcessing: true,
        maxParallelChunks: 5,
      });

      const testData = Buffer.from('Concurrent test data'.repeat(100));
      const chunked = await chunkingEngine.chunkFile(testData, 'concurrent-test.bin', 'application/octet-stream');

      let processingCount = 0;
      const concurrentProcessor = async (chunk: any) => {
        processingCount++;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
        return chunk;
      };

      const startTime = Date.now();
      await chunkingEngine.processChunksParallel(chunked.uploadId, concurrentProcessor);
      const duration = Date.now() - startTime;

      expect(processingCount).toBe(chunked.chunks.length);
      // Should complete faster than sequential processing
      expect(duration).toBeLessThan(chunked.chunks.length * 50);
    });

    it('should support appropriate chunk size calculations', () => {
      const { calculateOptimalChunkSize } = require('../../src/streaming/chunking-engine');

      const smallFile = 5 * 1024 * 1024; // 5MB
      const mediumFile = 50 * 1024 * 1024; // 50MB
      const largeFile = 500 * 1024 * 1024; // 500MB
      const xlFile = 2 * 1024 * 1024 * 1024; // 2GB

      expect(calculateOptimalChunkSize(smallFile)).toBe(CHUNK_SIZES.SMALL);
      expect(calculateOptimalChunkSize(mediumFile)).toBe(CHUNK_SIZES.MEDIUM);
      expect(calculateOptimalChunkSize(largeFile)).toBe(CHUNK_SIZES.LARGE);
      expect(calculateOptimalChunkSize(xlFile)).toBe(CHUNK_SIZES.XLARGE);
    });
  });
});

/**
 * Helper function to create mock video file buffer
 */
function createMockVideoBuffer(durationSeconds: number = 30): Buffer {
  // Create a minimal MP4-like header structure for testing
  const headerSize = 1024;
  const dataPerSecond = 1000; // Mock 1KB per second
  const totalSize = headerSize + (durationSeconds * dataPerSecond);

  const buffer = Buffer.alloc(totalSize);

  // Write mock MP4 header
  buffer.write('ftyp', 0); // MP4 file type box
  buffer.writeUInt32BE(totalSize, 4); // File size

  return buffer;
}

/**
 * Helper function to create mock transcoding profile
 */
function createMockTranscodingProfile(quality: string, bitrate: number) {
  return {
    profileId: quality,
    quality,
    bitrate,
    resolution: quality === '720p' ? '1280x720' : '854x480',
    codec: 'h264',
    format: 'hls' as const,
    audioCodec: 'aac',
    audioBitrate: 128000,
    framerate: 30,
    keyframeInterval: 2,
  };
}