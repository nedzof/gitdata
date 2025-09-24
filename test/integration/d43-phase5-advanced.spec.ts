import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { phase5AdvancedRouter } from '../../src/routes/overlay-phase5-advanced';
import { FederationManager } from '../../src/overlay/federation-manager';
import { AdvancedStreamingService } from '../../src/streaming/advanced-streaming-service';

// Create a test app for Phase 5 advanced features testing
function createPhase5TestApp() {
  console.log('Test environment configured for Phase 5 advanced features testing');

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.raw({ limit: '10mb', type: 'application/octet-stream' }));

  // Mount the Phase 5 advanced router
  const { router, setAdvancedServices } = phase5AdvancedRouter();

  // Mock advanced services for testing
  const mockFederationManager = {
    getFederationMetrics: async () => ({
      connectedNodes: 5,
      totalContent: 150,
      syncedContent: 140,
      pendingSyncs: 3,
      averageLatency: 45,
      totalThroughput: 125.5
    }),
    discoverNodes: async (region?: string) => [
      {
        nodeId: 'node-us-east-1',
        hostname: 'node1.example.com',
        port: 8788,
        publicKey: 'mock-public-key-1',
        capabilities: [
          {
            service: 'streaming',
            version: '1.0',
            endpoints: ['/streaming'],
            maxThroughput: 1000000,
            costPerRequest: 100
          }
        ],
        lastSeen: new Date(),
        reputation: 0.95,
        region: 'us-east-1'
      }
    ],
    registerNode: async (node: any) => {
      console.log(`Mock: Registered node ${node.nodeId}`);
    },
    initiateContentSync: async (contentHash: string, targetNodes: string[], priority: string) => {
      return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },
    discoverGlobalContent: async (contentHash: string) => {
      if (contentHash === 'existing-content-hash') {
        return {
          contentHash,
          availableNodes: ['node-us-east-1', 'node-eu-west-1'],
          primaryNode: 'node-us-east-1',
          backupNodes: ['node-eu-west-1'],
          contentType: 'video/mp4',
          size: 1048576,
          createdAt: new Date(),
          lastVerified: new Date(),
          verificationStatus: 'verified' as const
        };
      }
      return null;
    }
  };

  const mockAdvancedStreamingService = {
    createLiveStream: async (params: any) => ({
      streamId: `stream-${Date.now()}`,
      title: params.title,
      description: params.description,
      streamKey: `key-${Math.random().toString(36).substr(2, 16)}`,
      rtmpUrl: `rtmp://localhost:1935/live/key-${Math.random().toString(36).substr(2, 16)}`,
      hlsUrl: `/streaming/live/stream-${Date.now()}/playlist.m3u8`,
      status: 'created' as const,
      viewerCount: 0,
      quality: params.qualities || [
        { profileId: '720p', resolution: '1280x720', bitrate: 2500000, framerate: 30, codec: 'h264', available: true }
      ],
      createdAt: new Date()
    }),
    startLiveStream: async (streamId: string) => {
      console.log(`Mock: Started live stream ${streamId}`);
    },
    stopLiveStream: async (streamId: string) => {
      console.log(`Mock: Stopped live stream ${streamId}`);
    },
    generateAdaptivePlaylist: async (streamId: string, clientCapabilities?: any) => {
      return `#EXTM3U
#EXT-X-VERSION:6

#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,FRAME-RATE=30,CODECS="avc1.42e00a,mp4a.40.2"
/streaming/live/${streamId}/720p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,FRAME-RATE=30,CODECS="avc1.42e00a,mp4a.40.2"
/streaming/live/${streamId}/1080p/playlist.m3u8`;
    },
    getStreamAnalytics: async (streamId: string, timeRange: any) => [
      {
        streamId,
        timestamp: new Date(),
        viewerCount: 150,
        bandwidth: 2500000,
        bufferHealth: 0.95,
        qualitySwitches: 5,
        errorRate: 0.01,
        region: 'us-east-1'
      },
      {
        streamId,
        timestamp: new Date(Date.now() - 300000),
        viewerCount: 120,
        bandwidth: 2200000,
        bufferHealth: 0.92,
        qualitySwitches: 3,
        errorRate: 0.005,
        region: 'us-east-1'
      }
    ],
    getCDNUrl: async (contentPath: string, region?: string) => {
      return region === 'eu-west-1'
        ? `https://eu-cdn.example.com${contentPath}`
        : `https://cdn.example.com${contentPath}`;
    },
    purgeCDNCache: async (contentPath: string) => {
      console.log(`Mock: Purged CDN cache for ${contentPath}`);
    }
  };

  setAdvancedServices?.({
    federationManager: mockFederationManager as any,
    advancedStreamingService: mockAdvancedStreamingService as any
  });

  app.use('/overlay/phase5', router);

  return { app };
}

describe('D43 Phase 5: Advanced Features Integration', () => {
  let app: express.Application;

  beforeEach(async () => {
    const testApp = createPhase5TestApp();
    app = testApp.app;
  });

  afterEach(async () => {
    // Cleanup if needed
  });

  describe('Federation Management', () => {
    it('should get federation status and metrics', async () => {
      const response = await request(app)
        .get('/overlay/phase5/federation/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.federation.enabled).toBe(true);
      expect(response.body.federation.connected).toBe(true);
      expect(response.body.federation.metrics).toMatchObject({
        connectedNodes: 5,
        totalContent: 150,
        syncedContent: 140,
        pendingSyncs: 3,
        averageLatency: 45,
        totalThroughput: 125.5
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should discover federation nodes', async () => {
      const response = await request(app)
        .get('/overlay/phase5/federation/nodes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.nodes).toHaveLength(1);
      expect(response.body.nodes[0]).toMatchObject({
        nodeId: 'node-us-east-1',
        hostname: 'node1.example.com',
        port: 8788,
        region: 'us-east-1',
        reputation: 0.95
      });
      expect(response.body.nodes[0].capabilities).toHaveLength(1);
      expect(response.body.count).toBe(1);
    });

    it('should register a new federation node', async () => {
      const newNode = {
        nodeId: 'node-test-1',
        hostname: 'test.example.com',
        port: 8789,
        publicKey: 'test-public-key',
        capabilities: [{
          service: 'storage',
          version: '1.0',
          endpoints: ['/storage'],
          maxThroughput: 500000,
          costPerRequest: 50
        }],
        region: 'us-west-1'
      };

      const response = await request(app)
        .post('/overlay/phase5/federation/nodes/register')
        .send(newNode)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('registered successfully');
      expect(response.body.node.nodeId).toBe('node-test-1');
    });

    it('should initiate content synchronization', async () => {
      const syncRequest = {
        contentHash: 'test-content-hash-123',
        targetNodes: ['node-us-east-1', 'node-eu-west-1'],
        priority: 'high'
      };

      const response = await request(app)
        .post('/overlay/phase5/federation/content/sync')
        .send(syncRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.syncId).toBeDefined();
      expect(response.body.contentHash).toBe('test-content-hash-123');
      expect(response.body.targetNodes).toEqual(['node-us-east-1', 'node-eu-west-1']);
      expect(response.body.priority).toBe('high');
    });

    it('should discover global content', async () => {
      const response = await request(app)
        .get('/overlay/phase5/federation/content/discover/existing-content-hash')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.content).toMatchObject({
        contentHash: 'existing-content-hash',
        availableNodes: ['node-us-east-1', 'node-eu-west-1'],
        primaryNode: 'node-us-east-1',
        contentType: 'video/mp4',
        size: 1048576,
        verificationStatus: 'verified'
      });
    });

    it('should handle content not found', async () => {
      const response = await request(app)
        .get('/overlay/phase5/federation/content/discover/nonexistent-content-hash')
        .expect(404);

      expect(response.body.error).toBe('content-not-found');
    });
  });

  describe('Live Streaming', () => {
    it('should create a new live stream', async () => {
      const streamRequest = {
        title: 'Test Live Stream',
        description: 'A test live stream for Phase 5',
        qualities: [
          { profileId: '720p', resolution: '1280x720', bitrate: 2500000, framerate: 30, codec: 'h264', available: true },
          { profileId: '1080p', resolution: '1920x1080', bitrate: 5000000, framerate: 30, codec: 'h264', available: true }
        ]
      };

      const response = await request(app)
        .post('/overlay/phase5/streaming/live/create')
        .send(streamRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stream.title).toBe('Test Live Stream');
      expect(response.body.stream.description).toBe('A test live stream for Phase 5');
      expect(response.body.stream.streamId).toBeDefined();
      expect(response.body.stream.streamKey).toBeDefined();
      expect(response.body.stream.rtmpUrl).toContain('rtmp://');
      expect(response.body.stream.hlsUrl).toContain('playlist.m3u8');
      expect(response.body.stream.status).toBe('created');
      expect(response.body.instructions).toBeDefined();
    });

    it('should start a live stream', async () => {
      const streamId = 'test-stream-123';

      const response = await request(app)
        .post(`/overlay/phase5/streaming/live/${streamId}/start`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.streamId).toBe(streamId);
      expect(response.body.status).toBe('live');
    });

    it('should stop a live stream', async () => {
      const streamId = 'test-stream-123';

      const response = await request(app)
        .post(`/overlay/phase5/streaming/live/${streamId}/stop`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.streamId).toBe(streamId);
      expect(response.body.status).toBe('stopped');
    });

    it('should generate adaptive HLS playlist', async () => {
      const streamId = 'test-stream-123';

      const response = await request(app)
        .get(`/overlay/phase5/streaming/live/${streamId}/playlist.m3u8`)
        .query({
          bandwidth: '3000000',
          resolution: '1920x1080',
          device: 'desktop'
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/vnd.apple.mpegurl');
      expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
      expect(response.text).toContain('#EXTM3U');
      expect(response.text).toContain('EXT-X-STREAM-INF');
      expect(response.text).toContain(streamId);
    });

    it('should get streaming analytics', async () => {
      const streamId = 'test-stream-123';

      const response = await request(app)
        .get(`/overlay/phase5/streaming/live/${streamId}/analytics`)
        .query({
          start: new Date(Date.now() - 3600000).toISOString(),
          end: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.streamId).toBe(streamId);
      expect(response.body.analytics).toHaveLength(2);
      expect(response.body.analytics[0]).toMatchObject({
        viewerCount: 150,
        bandwidth: 2500000,
        bufferHealth: 0.95,
        qualitySwitches: 5,
        errorRate: 0.01,
        region: 'us-east-1'
      });
      expect(response.body.summary.totalRecords).toBe(2);
      expect(response.body.summary.averageViewers).toBe(135);
    });
  });

  describe('CDN Integration', () => {
    it('should get CDN URL for content', async () => {
      const contentPath = '/streaming/live/test-stream/playlist.m3u8';

      const response = await request(app)
        .get(`/overlay/phase5/cdn/url${contentPath}`)
        .query({ region: 'eu-west-1' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.originalPath).toBe(contentPath);
      expect(response.body.cdnUrl).toBe(`https://eu-cdn.example.com${contentPath}`);
      expect(response.body.region).toBe('eu-west-1');
    });

    it('should purge CDN cache', async () => {
      const purgeRequest = {
        contentPath: '/streaming/live/test-stream/playlist.m3u8'
      };

      const response = await request(app)
        .post('/overlay/phase5/cdn/purge')
        .send(purgeRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.contentPath).toBe(purgeRequest.contentPath);
      expect(response.body.message).toContain('purged successfully');
    });
  });

  describe('Error Handling and Validation', () => {
    it('should validate live stream creation input', async () => {
      const invalidRequest = {
        title: '', // Empty title should fail
        description: 'Test stream'
      };

      const response = await request(app)
        .post('/overlay/phase5/streaming/live/create')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('invalid-stream-title');
    });

    it('should validate node registration input', async () => {
      const invalidNode = {
        nodeId: 'test-node',
        hostname: 'test.example.com',
        // Missing port and publicKey
      };

      const response = await request(app)
        .post('/overlay/phase5/federation/nodes/register')
        .send(invalidNode)
        .expect(400);

      expect(response.body.error).toBe('invalid-node-registration');
    });

    it('should validate content sync input', async () => {
      const invalidSync = {
        contentHash: 'test-hash',
        // Missing targetNodes
      };

      const response = await request(app)
        .post('/overlay/phase5/federation/content/sync')
        .send(invalidSync)
        .expect(400);

      expect(response.body.error).toBe('invalid-sync-request');
    });

    it('should validate CDN purge input', async () => {
      const invalidPurge = {
        // Missing contentPath
      };

      const response = await request(app)
        .post('/overlay/phase5/cdn/purge')
        .send(invalidPurge)
        .expect(400);

      expect(response.body.error).toBe('invalid-purge-request');
    });
  });

  describe('System Status and Information', () => {
    it('should provide Phase 5 features status', async () => {
      const response = await request(app)
        .get('/overlay/phase5/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.phase5.enabled).toBe(true);
      expect(response.body.phase5.features).toMatchObject({
        federation: {
          status: 'available',
          description: 'Cross-overlay network federation and content synchronization'
        },
        liveStreaming: {
          status: 'available',
          description: 'Live streaming with real-time transcoding and adaptive bitrates'
        },
        cdnIntegration: {
          status: 'available',
          description: 'Content delivery network integration for global distribution'
        },
        analytics: {
          status: 'available',
          description: 'Advanced streaming analytics and performance monitoring'
        }
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent federation requests', async () => {
      const concurrentRequests = 5;
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/overlay/phase5/federation/status')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(responses.length).toBe(concurrentRequests);
    });

    it('should handle concurrent streaming analytics requests', async () => {
      const streamIds = ['stream-1', 'stream-2', 'stream-3'];
      const requests = streamIds.map(streamId =>
        request(app).get(`/overlay/phase5/streaming/live/${streamId}/analytics`)
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.streamId).toBe(streamIds[index]);
      });
    });
  });
});