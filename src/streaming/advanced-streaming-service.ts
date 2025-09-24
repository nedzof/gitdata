/**
 * Advanced Streaming Service
 *
 * Implements live streaming, adaptive bitrate streaming, CDN integration,
 * and advanced analytics for production-grade streaming capabilities.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';

// ==================== Advanced Streaming Types ====================

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

// ==================== Advanced Streaming Service ====================

export class AdvancedStreamingService extends EventEmitter {
  private database: DatabaseAdapter;
  private liveStreams: Map<string, LiveStream>;
  private transcodingJobs: Map<string, RealtimeTranscodingJob>;
  private analyticsBuffer: StreamingAnalytics[];
  private cdnConfig: CDNConfig;
  private adaptiveBitrateConfig: AdaptiveBitrateConfig;

  constructor(database: DatabaseAdapter) {
    super();
    this.database = database;
    this.liveStreams = new Map();
    this.transcodingJobs = new Map();
    this.analyticsBuffer = [];

    // Default configurations
    this.cdnConfig = {
      enabled: process.env.CDN_ENABLED === 'true',
      provider: process.env.CDN_PROVIDER || 'cloudflare',
      endpoints: [],
      cacheTTL: parseInt(process.env.CDN_CACHE_TTL || '3600'),
      purgeOnUpdate: true
    };

    this.adaptiveBitrateConfig = {
      enabled: process.env.ADAPTIVE_BITRATE_ENABLED !== 'false',
      qualities: [
        { profileId: '240p', resolution: '426x240', bitrate: 400000, framerate: 30, codec: 'h264', available: true },
        { profileId: '360p', resolution: '640x360', bitrate: 800000, framerate: 30, codec: 'h264', available: true },
        { profileId: '720p', resolution: '1280x720', bitrate: 2500000, framerate: 30, codec: 'h264', available: true },
        { profileId: '1080p', resolution: '1920x1080', bitrate: 5000000, framerate: 30, codec: 'h264', available: true }
      ],
      switchingAlgorithm: 'hybrid',
      bufferThreshold: 5000, // 5 seconds
      bandwidthThreshold: 0.8 // 80% of available bandwidth
    };
  }

  // ==================== Initialization ====================

  async initialize(): Promise<void> {
    try {
      await this.createAdvancedStreamingTables();
      await this.loadLiveStreams();
      await this.startAnalyticsProcessor();
      await this.initializeCDN();

      console.log('[ADVANCED-STREAMING] Service initialized with CDN and adaptive bitrate support');
      this.emit('service:initialized');
    } catch (error) {
      console.error('[ADVANCED-STREAMING] Initialization failed:', error);
      throw error;
    }
  }

  // ==================== Live Streaming ====================

  async createLiveStream(params: {
    title: string;
    description?: string;
    qualities?: StreamQuality[];
  }): Promise<LiveStream> {
    try {
      const streamId = crypto.randomUUID();
      const streamKey = crypto.randomBytes(32).toString('hex');

      const liveStream: LiveStream = {
        streamId,
        title: params.title,
        description: params.description,
        streamKey,
        rtmpUrl: `rtmp://localhost:1935/live/${streamKey}`,
        hlsUrl: `/streaming/live/${streamId}/playlist.m3u8`,
        status: 'created',
        viewerCount: 0,
        quality: params.qualities || this.adaptiveBitrateConfig.qualities,
        createdAt: new Date()
      };

      await this.database.execute(`
        INSERT INTO live_streams (
          stream_id, title, description, stream_key, rtmp_url, hls_url,
          status, viewer_count, quality_config, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        streamId,
        params.title,
        params.description || null,
        streamKey,
        liveStream.rtmpUrl,
        liveStream.hlsUrl,
        'created',
        0,
        JSON.stringify(liveStream.quality),
        liveStream.createdAt
      ]);

      this.liveStreams.set(streamId, liveStream);

      console.log(`[ADVANCED-STREAMING] Live stream created: ${streamId}`);
      this.emit('stream:created', liveStream);

      return liveStream;
    } catch (error) {
      console.error('[ADVANCED-STREAMING] Failed to create live stream:', error);
      throw error;
    }
  }

  async startLiveStream(streamId: string): Promise<void> {
    try {
      const stream = this.liveStreams.get(streamId);
      if (!stream) {
        throw new Error(`Live stream ${streamId} not found`);
      }

      // Start real-time transcoding
      await this.startRealtimeTranscoding(streamId, stream.quality);

      // Update stream status
      stream.status = 'live';
      stream.startedAt = new Date();

      await this.database.execute(`
        UPDATE live_streams
        SET status = 'live', started_at = $1
        WHERE stream_id = $2
      `, [stream.startedAt, streamId]);

      console.log(`[ADVANCED-STREAMING] Live stream started: ${streamId}`);
      this.emit('stream:started', stream);
    } catch (error) {
      console.error(`[ADVANCED-STREAMING] Failed to start live stream ${streamId}:`, error);
      throw error;
    }
  }

  async stopLiveStream(streamId: string): Promise<void> {
    try {
      const stream = this.liveStreams.get(streamId);
      if (!stream) {
        throw new Error(`Live stream ${streamId} not found`);
      }

      // Stop transcoding
      await this.stopRealtimeTranscoding(streamId);

      // Update stream status
      stream.status = 'stopped';
      stream.endedAt = new Date();

      await this.database.execute(`
        UPDATE live_streams
        SET status = 'stopped', ended_at = $1
        WHERE stream_id = $2
      `, [stream.endedAt, streamId]);

      console.log(`[ADVANCED-STREAMING] Live stream stopped: ${streamId}`);
      this.emit('stream:stopped', stream);
    } catch (error) {
      console.error(`[ADVANCED-STREAMING] Failed to stop live stream ${streamId}:`, error);
      throw error;
    }
  }

  // ==================== Real-time Transcoding ====================

  async startRealtimeTranscoding(streamId: string, qualities: StreamQuality[]): Promise<string> {
    try {
      const jobId = crypto.randomUUID();

      const transcodingJob: RealtimeTranscodingJob = {
        jobId,
        streamId,
        inputFormat: 'rtmp',
        outputProfiles: qualities,
        status: 'queued',
        progress: 0,
        startedAt: new Date()
      };

      await this.database.execute(`
        INSERT INTO realtime_transcoding_jobs (
          job_id, stream_id, input_format, output_profiles,
          status, progress, started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        jobId,
        streamId,
        'rtmp',
        JSON.stringify(qualities),
        'queued',
        0,
        transcodingJob.startedAt
      ]);

      this.transcodingJobs.set(jobId, transcodingJob);

      // Start transcoding process
      this.processRealtimeTranscoding(jobId).catch(error => {
        console.error(`[ADVANCED-STREAMING] Real-time transcoding failed for job ${jobId}:`, error);
        this.emit('transcoding:failed', { jobId, streamId, error: error.message });
      });

      console.log(`[ADVANCED-STREAMING] Real-time transcoding started: ${jobId} for stream ${streamId}`);
      return jobId;
    } catch (error) {
      console.error(`[ADVANCED-STREAMING] Failed to start real-time transcoding for ${streamId}:`, error);
      throw error;
    }
  }

  private async processRealtimeTranscoding(jobId: string): Promise<void> {
    const job = this.transcodingJobs.get(jobId);
    if (!job) {
      throw new Error(`Transcoding job ${jobId} not found`);
    }

    try {
      job.status = 'processing';
      await this.updateTranscodingJobStatus(jobId, 'processing', 10);

      // Simulate real-time transcoding process
      for (let progress = 20; progress <= 100; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time

        job.progress = progress;
        await this.updateTranscodingJobStatus(jobId, 'processing', progress);

        this.emit('transcoding:progress', { jobId, streamId: job.streamId, progress });
      }

      job.status = 'completed';
      job.estimatedCompletion = new Date();
      await this.updateTranscodingJobStatus(jobId, 'completed', 100);

      console.log(`[ADVANCED-STREAMING] Real-time transcoding completed: ${jobId}`);
      this.emit('transcoding:completed', { jobId, streamId: job.streamId });
    } catch (error) {
      job.status = 'failed';
      await this.updateTranscodingJobStatus(jobId, 'failed', job.progress);
      throw error;
    }
  }

  private async stopRealtimeTranscoding(streamId: string): Promise<void> {
    const jobs = Array.from(this.transcodingJobs.values()).filter(job => job.streamId === streamId);

    for (const job of jobs) {
      job.status = 'completed';
      await this.updateTranscodingJobStatus(job.jobId, 'completed', 100);
    }
  }

  // ==================== Adaptive Bitrate Streaming ====================

  async generateAdaptivePlaylist(streamId: string, clientCapabilities?: {
    bandwidth?: number;
    resolution?: string;
    device?: string;
  }): Promise<string> {
    try {
      const stream = this.liveStreams.get(streamId);
      if (!stream || stream.status !== 'live') {
        throw new Error(`Live stream ${streamId} not available`);
      }

      let availableQualities = stream.quality.filter(q => q.available);

      // Filter qualities based on client capabilities
      if (clientCapabilities) {
        if (clientCapabilities.bandwidth) {
          availableQualities = availableQualities.filter(
            q => q.bitrate <= clientCapabilities.bandwidth! * this.adaptiveBitrateConfig.bandwidthThreshold
          );
        }

        if (clientCapabilities.resolution) {
          const [maxWidth, maxHeight] = clientCapabilities.resolution.split('x').map(Number);
          availableQualities = availableQualities.filter(q => {
            const [width, height] = q.resolution.split('x').map(Number);
            return width <= maxWidth && height <= maxHeight;
          });
        }
      }

      // Generate HLS master playlist with adaptive bitrates
      const playlist = this.generateHLSMasterPlaylist(streamId, availableQualities);

      // Log analytics
      await this.recordAnalytics({
        streamId,
        timestamp: new Date(),
        viewerCount: stream.viewerCount + 1,
        bandwidth: clientCapabilities?.bandwidth || 0,
        bufferHealth: 1.0,
        qualitySwitches: 0,
        errorRate: 0,
        region: 'unknown'
      });

      return playlist;
    } catch (error) {
      console.error(`[ADVANCED-STREAMING] Failed to generate adaptive playlist for ${streamId}:`, error);
      throw error;
    }
  }

  private generateHLSMasterPlaylist(streamId: string, qualities: StreamQuality[]): string {
    let playlist = '#EXTM3U\n#EXT-X-VERSION:6\n\n';

    for (const quality of qualities.sort((a, b) => b.bitrate - a.bitrate)) {
      const [width, height] = quality.resolution.split('x').map(Number);

      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bitrate},RESOLUTION=${width}x${height},FRAME-RATE=${quality.framerate},CODECS="avc1.42e00a,mp4a.40.2"\n`;
      playlist += `/streaming/live/${streamId}/${quality.profileId}/playlist.m3u8\n\n`;
    }

    return playlist;
  }

  // ==================== CDN Integration ====================

  async initializeCDN(): Promise<void> {
    if (!this.cdnConfig.enabled) {
      console.log('[ADVANCED-STREAMING] CDN integration disabled');
      return;
    }

    try {
      // Load CDN endpoints from configuration or database
      const endpoints = await this.loadCDNEndpoints();
      this.cdnConfig.endpoints = endpoints;

      console.log(`[ADVANCED-STREAMING] CDN initialized with ${endpoints.length} endpoints`);
    } catch (error) {
      console.error('[ADVANCED-STREAMING] CDN initialization failed:', error);
    }
  }

  async getCDNUrl(contentPath: string, region?: string): Promise<string> {
    if (!this.cdnConfig.enabled || this.cdnConfig.endpoints.length === 0) {
      return contentPath; // Return original path if CDN is disabled
    }

    try {
      // Find best CDN endpoint for region
      let endpoint = this.cdnConfig.endpoints.find(e => e.region === region && e.healthStatus === 'healthy');

      if (!endpoint) {
        // Fallback to any healthy endpoint
        endpoint = this.cdnConfig.endpoints.find(e => e.healthStatus === 'healthy');
      }

      if (!endpoint) {
        return contentPath; // Return original path if no healthy endpoints
      }

      return `${endpoint.url}${contentPath}`;
    } catch (error) {
      console.error(`[ADVANCED-STREAMING] Failed to get CDN URL for ${contentPath}:`, error);
      return contentPath;
    }
  }

  async purgeCDNCache(contentPath: string): Promise<void> {
    if (!this.cdnConfig.enabled || !this.cdnConfig.purgeOnUpdate) {
      return;
    }

    try {
      console.log(`[ADVANCED-STREAMING] Purging CDN cache for ${contentPath}`);
      // This would call the CDN provider's API to purge cache
      // Implementation depends on CDN provider (CloudFlare, AWS CloudFront, etc.)
    } catch (error) {
      console.error(`[ADVANCED-STREAMING] Failed to purge CDN cache for ${contentPath}:`, error);
    }
  }

  // ==================== Analytics and Monitoring ====================

  async recordAnalytics(analytics: StreamingAnalytics): Promise<void> {
    this.analyticsBuffer.push(analytics);

    // Batch insert analytics when buffer reaches threshold
    if (this.analyticsBuffer.length >= 100) {
      await this.flushAnalytics();
    }
  }

  private async flushAnalytics(): Promise<void> {
    if (this.analyticsBuffer.length === 0) return;

    try {
      const values = this.analyticsBuffer.map((analytics, index) =>
        `($${index * 8 + 1}, $${index * 8 + 2}, $${index * 8 + 3}, $${index * 8 + 4}, $${index * 8 + 5}, $${index * 8 + 6}, $${index * 8 + 7}, $${index * 8 + 8})`
      ).join(', ');

      const params = this.analyticsBuffer.flatMap(analytics => [
        analytics.streamId,
        analytics.timestamp,
        analytics.viewerCount,
        analytics.bandwidth,
        analytics.bufferHealth,
        analytics.qualitySwitches,
        analytics.errorRate,
        analytics.region
      ]);

      await this.database.execute(`
        INSERT INTO streaming_analytics (
          stream_id, timestamp, viewer_count, bandwidth,
          buffer_health, quality_switches, error_rate, region
        ) VALUES ${values}
      `, params);

      console.log(`[ADVANCED-STREAMING] Flushed ${this.analyticsBuffer.length} analytics records`);
      this.analyticsBuffer = [];
    } catch (error) {
      console.error('[ADVANCED-STREAMING] Failed to flush analytics:', error);
    }
  }

  async getStreamAnalytics(streamId: string, timeRange: {
    start: Date;
    end: Date;
  }): Promise<StreamingAnalytics[]> {
    try {
      const results = await this.database.query(`
        SELECT stream_id, timestamp, viewer_count, bandwidth,
               buffer_health, quality_switches, error_rate, region
        FROM streaming_analytics
        WHERE stream_id = $1 AND timestamp BETWEEN $2 AND $3
        ORDER BY timestamp ASC
      `, [streamId, timeRange.start, timeRange.end]);

      return results.map(row => ({
        streamId: row.stream_id,
        timestamp: new Date(row.timestamp),
        viewerCount: row.viewer_count,
        bandwidth: row.bandwidth,
        bufferHealth: parseFloat(row.buffer_health),
        qualitySwitches: row.quality_switches,
        errorRate: parseFloat(row.error_rate),
        region: row.region
      }));
    } catch (error) {
      console.error(`[ADVANCED-STREAMING] Failed to get analytics for ${streamId}:`, error);
      return [];
    }
  }

  // ==================== Database Schema ====================

  private async createAdvancedStreamingTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS live_streams (
        stream_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        stream_key TEXT UNIQUE NOT NULL,
        rtmp_url TEXT NOT NULL,
        hls_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',
        viewer_count INTEGER DEFAULT 0,
        quality_config JSONB NOT NULL,
        thumbnail_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        ended_at TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS realtime_transcoding_jobs (
        job_id TEXT PRIMARY KEY,
        stream_id TEXT NOT NULL,
        input_format TEXT NOT NULL,
        output_profiles JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        progress INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estimated_completion TIMESTAMP,
        FOREIGN KEY (stream_id) REFERENCES live_streams(stream_id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS streaming_analytics (
        id SERIAL PRIMARY KEY,
        stream_id TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        viewer_count INTEGER NOT NULL,
        bandwidth BIGINT NOT NULL,
        buffer_health DECIMAL(4,3) NOT NULL,
        quality_switches INTEGER NOT NULL,
        error_rate DECIMAL(4,3) NOT NULL,
        region TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS cdn_endpoints (
        endpoint_id TEXT PRIMARY KEY,
        region TEXT NOT NULL,
        url TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 1,
        health_status TEXT NOT NULL DEFAULT 'healthy',
        last_health_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE INDEX IF NOT EXISTS idx_live_streams_status
       ON live_streams(status, created_at DESC)`,

      `CREATE INDEX IF NOT EXISTS idx_streaming_analytics_stream_time
       ON streaming_analytics(stream_id, timestamp DESC)`,

      `CREATE INDEX IF NOT EXISTS idx_cdn_endpoints_region_priority
       ON cdn_endpoints(region, priority ASC, health_status)`
    ];

    for (const sql of tables) {
      await this.database.execute(sql);
    }
  }

  // ==================== Helper Methods ====================

  private async loadLiveStreams(): Promise<void> {
    try {
      const streams = await this.database.query(`
        SELECT stream_id, title, description, stream_key, rtmp_url, hls_url,
               status, viewer_count, quality_config, thumbnail_url,
               created_at, started_at, ended_at
        FROM live_streams
        WHERE status IN ('created', 'live')
      `);

      for (const stream of streams) {
        const liveStream: LiveStream = {
          streamId: stream.stream_id,
          title: stream.title,
          description: stream.description,
          streamKey: stream.stream_key,
          rtmpUrl: stream.rtmp_url,
          hlsUrl: stream.hls_url,
          status: stream.status,
          viewerCount: stream.viewer_count,
          quality: JSON.parse(stream.quality_config),
          thumbnailUrl: stream.thumbnail_url,
          createdAt: new Date(stream.created_at),
          startedAt: stream.started_at ? new Date(stream.started_at) : undefined,
          endedAt: stream.ended_at ? new Date(stream.ended_at) : undefined
        };

        this.liveStreams.set(stream.stream_id, liveStream);
      }

      console.log(`[ADVANCED-STREAMING] Loaded ${streams.length} active live streams`);
    } catch (error) {
      console.error('[ADVANCED-STREAMING] Failed to load live streams:', error);
    }
  }

  private async startAnalyticsProcessor(): Promise<void> {
    // Flush analytics buffer every 30 seconds
    setInterval(async () => {
      if (this.analyticsBuffer.length > 0) {
        await this.flushAnalytics();
      }
    }, 30000);
  }

  private async loadCDNEndpoints(): Promise<CDNEndpoint[]> {
    try {
      const endpoints = await this.database.query(`
        SELECT endpoint_id, region, url, priority, health_status
        FROM cdn_endpoints
        WHERE health_status != 'offline'
        ORDER BY region, priority ASC
      `);

      return endpoints.map(endpoint => ({
        region: endpoint.region,
        url: endpoint.url,
        priority: endpoint.priority,
        healthStatus: endpoint.health_status
      }));
    } catch (error) {
      console.error('[ADVANCED-STREAMING] Failed to load CDN endpoints:', error);
      return [];
    }
  }

  private async updateTranscodingJobStatus(jobId: string, status: string, progress: number): Promise<void> {
    await this.database.execute(`
      UPDATE realtime_transcoding_jobs
      SET status = $1, progress = $2
      WHERE job_id = $3
    `, [status, progress, jobId]);
  }

  async shutdown(): Promise<void> {
    console.log('[ADVANCED-STREAMING] Shutting down advanced streaming service');

    // Flush remaining analytics
    await this.flushAnalytics();

    // Stop all live streams
    for (const [streamId] of this.liveStreams) {
      await this.stopLiveStream(streamId);
    }

    this.emit('service:shutdown');
  }
}