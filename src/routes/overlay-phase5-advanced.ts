/**
 * Phase 5: Advanced Features API Routes
 *
 * Provides HTTP endpoints for federation management, live streaming,
 * and advanced overlay network capabilities.
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import multer from 'multer';

import type { FederationManager } from '../overlay/federation-manager';
import type { AdvancedStreamingService } from '../streaming/advanced-streaming-service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for thumbnail uploads
    files: 1,
  },
});

export interface Phase5Router {
  router: Router;
  setAdvancedServices?: (services: {
    federationManager?: FederationManager;
    advancedStreamingService?: AdvancedStreamingService;
  }) => void;
}

export function phase5AdvancedRouter(): Phase5Router {
  const router = Router();
  let federationManager: FederationManager | null = null;
  let advancedStreamingService: AdvancedStreamingService | null = null;

  // Set advanced services (called after initialization)
  function setAdvancedServices(services: {
    federationManager?: FederationManager;
    advancedStreamingService?: AdvancedStreamingService;
  }): void {
    federationManager = services.federationManager || null;
    advancedStreamingService = services.advancedStreamingService || null;
  }

  // Middleware to check if federation is available
  function requireFederation(req: Request, res: Response, next: NextFunction): void {
    if (!federationManager) {
      return res.status(503).json({
        error: 'federation-unavailable',
        message: 'Federation manager is not available. Set FEDERATION_ENABLED=true to enable cross-network features.',
      });
    }
    next();
  }

  // Middleware to check if advanced streaming is available
  function requireAdvancedStreaming(req: Request, res: Response, next: NextFunction): void {
    if (!advancedStreamingService) {
      return res.status(503).json({
        error: 'advanced-streaming-unavailable',
        message: 'Advanced streaming service is not available. Ensure proper configuration.',
      });
    }
    next();
  }

  // ==================== Federation Management ====================

  // Get federation status and metrics
  router.get('/federation/status', requireFederation, async (req: Request, res: Response) => {
    try {
      const metrics = await federationManager!.getFederationMetrics();

      res.json({
        success: true,
        federation: {
          enabled: true,
          connected: metrics.connectedNodes > 0,
          metrics,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: 'federation-status-failed',
        message: error.message,
      });
    }
  });

  // Discover federation nodes
  router.get('/federation/nodes', requireFederation, async (req: Request, res: Response) => {
    try {
      const { region } = req.query;
      const nodes = await federationManager!.discoverNodes(region as string);

      res.json({
        success: true,
        nodes: nodes.map(node => ({
          nodeId: node.nodeId,
          hostname: node.hostname,
          port: node.port,
          region: node.region,
          reputation: node.reputation,
          capabilities: node.capabilities,
          lastSeen: node.lastSeen,
        })),
        count: nodes.length,
      });
    } catch (error) {
      res.status(500).json({
        error: 'node-discovery-failed',
        message: error.message,
      });
    }
  });

  // Register a new federation node
  router.post('/federation/nodes/register', requireFederation, async (req: Request, res: Response) => {
    try {
      const { nodeId, hostname, port, publicKey, capabilities, region } = req.body;

      if (!nodeId || !hostname || !port || !publicKey) {
        return res.status(400).json({
          error: 'invalid-node-registration',
          message: 'nodeId, hostname, port, and publicKey are required',
        });
      }

      await federationManager!.registerNode({
        nodeId,
        hostname,
        port,
        publicKey,
        capabilities: capabilities || [],
        region: region || 'unknown',
      });

      res.json({
        success: true,
        message: `Node ${nodeId} registered successfully`,
        node: {
          nodeId,
          hostname,
          port,
          region,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'node-registration-failed',
        message: error.message,
      });
    }
  });

  // Initiate content synchronization
  router.post('/federation/content/sync', requireFederation, async (req: Request, res: Response) => {
    try {
      const { contentHash, targetNodes, priority } = req.body;

      if (!contentHash || !targetNodes || !Array.isArray(targetNodes)) {
        return res.status(400).json({
          error: 'invalid-sync-request',
          message: 'contentHash and targetNodes array are required',
        });
      }

      const syncId = await federationManager!.initiateContentSync(
        contentHash,
        targetNodes,
        priority || 'normal'
      );

      res.json({
        success: true,
        syncId,
        contentHash,
        targetNodes,
        priority: priority || 'normal',
        message: 'Content synchronization initiated',
      });
    } catch (error) {
      res.status(500).json({
        error: 'sync-initiation-failed',
        message: error.message,
      });
    }
  });

  // Discover global content
  router.get('/federation/content/discover/:contentHash', requireFederation, async (req: Request, res: Response) => {
    try {
      const { contentHash } = req.params;
      const globalContent = await federationManager!.discoverGlobalContent(contentHash);

      if (!globalContent) {
        return res.status(404).json({
          error: 'content-not-found',
          message: `Content ${contentHash} not found in global registry`,
        });
      }

      res.json({
        success: true,
        content: {
          contentHash: globalContent.contentHash,
          availableNodes: globalContent.availableNodes,
          primaryNode: globalContent.primaryNode,
          backupNodes: globalContent.backupNodes,
          contentType: globalContent.contentType,
          size: globalContent.size,
          lastVerified: globalContent.lastVerified,
          verificationStatus: globalContent.verificationStatus,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'content-discovery-failed',
        message: error.message,
      });
    }
  });

  // ==================== Live Streaming ====================

  // Create a new live stream
  router.post('/streaming/live/create', requireAdvancedStreaming, async (req: Request, res: Response) => {
    try {
      const { title, description, qualities } = req.body;

      if (!title || typeof title !== 'string') {
        return res.status(400).json({
          error: 'invalid-stream-title',
          message: 'Stream title is required',
        });
      }

      const liveStream = await advancedStreamingService!.createLiveStream({
        title,
        description,
        qualities,
      });

      res.json({
        success: true,
        stream: {
          streamId: liveStream.streamId,
          title: liveStream.title,
          description: liveStream.description,
          streamKey: liveStream.streamKey,
          rtmpUrl: liveStream.rtmpUrl,
          hlsUrl: liveStream.hlsUrl,
          status: liveStream.status,
          quality: liveStream.quality,
          createdAt: liveStream.createdAt,
        },
        instructions: {
          rtmp: `Use RTMP URL: ${liveStream.rtmpUrl}`,
          hls: `Watch at: ${liveStream.hlsUrl}`,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'stream-creation-failed',
        message: error.message,
      });
    }
  });

  // Start a live stream
  router.post('/streaming/live/:streamId/start', requireAdvancedStreaming, async (req: Request, res: Response) => {
    try {
      const { streamId } = req.params;

      await advancedStreamingService!.startLiveStream(streamId);

      res.json({
        success: true,
        streamId,
        status: 'live',
        message: 'Live stream started successfully',
      });
    } catch (error) {
      res.status(500).json({
        error: 'stream-start-failed',
        message: error.message,
      });
    }
  });

  // Stop a live stream
  router.post('/streaming/live/:streamId/stop', requireAdvancedStreaming, async (req: Request, res: Response) => {
    try {
      const { streamId } = req.params;

      await advancedStreamingService!.stopLiveStream(streamId);

      res.json({
        success: true,
        streamId,
        status: 'stopped',
        message: 'Live stream stopped successfully',
      });
    } catch (error) {
      res.status(500).json({
        error: 'stream-stop-failed',
        message: error.message,
      });
    }
  });

  // Get adaptive HLS playlist
  router.get('/streaming/live/:streamId/playlist.m3u8', requireAdvancedStreaming, async (req: Request, res: Response) => {
    try {
      const { streamId } = req.params;
      const { bandwidth, resolution, device } = req.query;

      const clientCapabilities = {
        bandwidth: bandwidth ? parseInt(bandwidth as string) : undefined,
        resolution: resolution as string,
        device: device as string,
      };

      const playlist = await advancedStreamingService!.generateAdaptivePlaylist(streamId, clientCapabilities);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(playlist);
    } catch (error) {
      res.status(404).json({
        error: 'playlist-generation-failed',
        message: error.message,
      });
    }
  });

  // Get streaming analytics
  router.get('/streaming/live/:streamId/analytics', requireAdvancedStreaming, async (req: Request, res: Response) => {
    try {
      const { streamId } = req.params;
      const { start, end } = req.query;

      const timeRange = {
        start: start ? new Date(start as string) : new Date(Date.now() - 3600000), // Default: last hour
        end: end ? new Date(end as string) : new Date(),
      };

      const analytics = await advancedStreamingService!.getStreamAnalytics(streamId, timeRange);

      res.json({
        success: true,
        streamId,
        timeRange,
        analytics: analytics.map(record => ({
          timestamp: record.timestamp,
          viewerCount: record.viewerCount,
          bandwidth: record.bandwidth,
          bufferHealth: record.bufferHealth,
          qualitySwitches: record.qualitySwitches,
          errorRate: record.errorRate,
          region: record.region,
        })),
        summary: {
          totalRecords: analytics.length,
          averageViewers: analytics.reduce((sum, a) => sum + a.viewerCount, 0) / analytics.length || 0,
          averageBandwidth: analytics.reduce((sum, a) => sum + a.bandwidth, 0) / analytics.length || 0,
          averageBufferHealth: analytics.reduce((sum, a) => sum + a.bufferHealth, 0) / analytics.length || 0,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'analytics-failed',
        message: error.message,
      });
    }
  });

  // ==================== CDN Management ====================

  // Get CDN URL for content
  router.get('/cdn/url/:contentPath(*)', requireAdvancedStreaming, async (req: Request, res: Response) => {
    try {
      const contentPath = '/' + req.params.contentPath;
      const { region } = req.query;

      const cdnUrl = await advancedStreamingService!.getCDNUrl(contentPath, region as string);

      res.json({
        success: true,
        originalPath: contentPath,
        cdnUrl,
        region: region || 'auto',
      });
    } catch (error) {
      res.status(500).json({
        error: 'cdn-url-failed',
        message: error.message,
      });
    }
  });

  // Purge CDN cache
  router.post('/cdn/purge', requireAdvancedStreaming, async (req: Request, res: Response) => {
    try {
      const { contentPath } = req.body;

      if (!contentPath) {
        return res.status(400).json({
          error: 'invalid-purge-request',
          message: 'contentPath is required',
        });
      }

      await advancedStreamingService!.purgeCDNCache(contentPath);

      res.json({
        success: true,
        contentPath,
        message: 'CDN cache purged successfully',
      });
    } catch (error) {
      res.status(500).json({
        error: 'cdn-purge-failed',
        message: error.message,
      });
    }
  });

  // ==================== System Information ====================

  // Get Phase 5 features status
  router.get('/status', (req: Request, res: Response) => {
    const federationStatus = federationManager ? 'available' : 'unavailable';
    const advancedStreamingStatus = advancedStreamingService ? 'available' : 'unavailable';

    res.json({
      success: true,
      phase5: {
        enabled: true,
        features: {
          federation: {
            status: federationStatus,
            description: 'Cross-overlay network federation and content synchronization',
          },
          liveStreaming: {
            status: advancedStreamingStatus,
            description: 'Live streaming with real-time transcoding and adaptive bitrates',
          },
          cdnIntegration: {
            status: advancedStreamingStatus,
            description: 'Content delivery network integration for global distribution',
          },
          analytics: {
            status: advancedStreamingStatus,
            description: 'Advanced streaming analytics and performance monitoring',
          },
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  return {
    router,
    setAdvancedServices,
  };
}