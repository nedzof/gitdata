// Enhanced BSV Overlay API Routes with Full BRC Standards Support
// Provides HTTP endpoints for all BRC overlay services including file storage

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { GitdataOverlayServices } from '../overlay/index';
import { D01A_TOPICS, TopicGenerator } from '../overlay/overlay-config';
import { requireIdentity } from '../middleware/identity';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1
  }
});

export interface EnhancedOverlayRouter {
  router: Router;
  setOverlayServices?: (services: GitdataOverlayServices) => void;
}

export function enhancedOverlayRouter(): EnhancedOverlayRouter {
  const router = Router();
  let overlayServices: GitdataOverlayServices | null = null;

  // Set overlay services (called after initialization)
  function setOverlayServices(services: GitdataOverlayServices): void {
    overlayServices = services;
  }

  // Middleware to check if overlay is available
  function requireOverlay(req: Request, res: Response, next: Function): void {
    if (!overlayServices || !overlayServices.overlayManager.isConnected()) {
      return res.status(503).json({
        error: 'overlay-unavailable',
        message: 'BSV overlay network is not available. Set OVERLAY_ENABLED=true and ensure wallet is connected.'
      });
    }
    next();
  }

  // Rate limiting middleware (simple implementation)
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  function rateLimit(maxRequests: number, windowMs: number) {
    return (req: Request, res: Response, next: Function) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      const key = `${ip}:${req.path}`;

      const current = requestCounts.get(key);
      if (!current || now > current.resetTime) {
        requestCounts.set(key, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (current.count >= maxRequests) {
        return res.status(429).json({
          error: 'rate-limit-exceeded',
          message: 'Too many requests. Please try again later.'
        });
      }

      current.count++;
      next();
    };
  }

  // ==================== Core Overlay Routes ====================

  // Get comprehensive overlay network status
  router.get('/status', (req: Request, res: Response) => {
    if (!overlayServices) {
      return res.json({
        enabled: false,
        connected: false,
        message: 'BSV overlay integration is disabled'
      });
    }

    const manager = overlayServices.overlayManager;
    const stats = manager.getStats();

    res.json({
      enabled: true,
      connected: manager.isConnected(),
      stats,
      environment: process.env.OVERLAY_ENV || 'development',
      services: {
        brc22: 'Transaction Submission',
        brc24: 'Lookup Services',
        brc64: 'History Tracking',
        brc88: 'Service Discovery',
        brc26: 'File Storage (UHRP)',
        payments: 'Payment Processing'
      }
    });
  });

  // Get comprehensive BRC service statistics
  router.get('/brc-stats', requireOverlay, async (req: Request, res: Response) => {
    try {
      const [brc64Stats, brc26Stats] = await Promise.all([
        overlayServices!.brc64Service.getStats(),
        overlayServices!.brc26Service.getStats()
      ]);

      res.json({
        brc22: {
          description: 'Transaction submission with topic-based UTXO tracking',
          // BRC-22 stats would be added when service provides getStats method
        },
        brc24: {
          description: 'Lookup services for overlay state querying',
          // BRC-24 stats would be added when service provides getStats method
        },
        brc64: {
          description: 'Transaction history tracking and lineage graphs',
          ...brc64Stats
        },
        brc88: {
          description: 'SHIP/SLAP service discovery and synchronization',
          // BRC-88 stats would be added when service provides getStats method
        },
        brc26: {
          description: 'Universal Hash Resolution Protocol for file storage',
          ...brc26Stats
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'stats-failed',
        message: error.message
      });
    }
  });

  // ==================== BRC-22: Transaction Submission ====================

  router.post('/submit', requireOverlay, requireIdentity(true), rateLimit(10, 60000), async (req: Request & { identityKey?: string }, res: Response) => {
    try {
      const { rawTx, inputs, topics, mapiResponses } = req.body;

      if (!rawTx || !inputs || !topics) {
        return res.status(400).json({
          error: 'invalid-transaction',
          message: 'rawTx, inputs, and topics are required'
        });
      }

      const transaction = { rawTx, inputs, topics, mapiResponses };
      const result = await overlayServices!.brc22Service!.processSubmission(transaction);

      res.json({
        success: true,
        result,
        message: 'Transaction submitted successfully'
      });

    } catch (error) {
      res.status(500).json({
        error: 'submission-failed',
        message: error.message
      });
    }
  });

  // ==================== BRC-24: Lookup Services ====================

  router.post('/lookup', requireOverlay, rateLimit(20, 60000), async (req: Request, res: Response) => {
    try {
      const { provider, query } = req.body;

      if (!provider || !query) {
        return res.status(400).json({
          error: 'invalid-lookup',
          message: 'provider and query are required'
        });
      }

      const results = await overlayServices!.brc24Service!.processLookup(provider, query);

      res.json({
        success: true,
        provider,
        query,
        results,
        count: results.length
      });

    } catch (error) {
      res.status(500).json({
        error: 'lookup-failed',
        message: error.message
      });
    }
  });

  // Get available lookup providers
  router.get('/lookup/providers', requireOverlay, (req: Request, res: Response) => {
    try {
      const providers = overlayServices!.brc24Service!.getAvailableProviders();
      res.json({
        success: true,
        providers
      });
    } catch (error) {
      res.status(500).json({
        error: 'providers-failed',
        message: error.message
      });
    }
  });

  // ==================== BRC-64: History Tracking ====================

  router.get('/history/:utxoId', requireOverlay, async (req: Request, res: Response) => {
    try {
      const { utxoId } = req.params;
      const { topic, depth = 5, direction = 'both' } = req.query;

      const history = await overlayServices!.brc64Service!.queryHistory({
        utxoId,
        topic: topic as string,
        depth: parseInt(depth as string),
        direction: direction as 'backward' | 'forward' | 'both'
      });

      res.json({
        success: true,
        utxoId,
        history
      });

    } catch (error) {
      res.status(500).json({
        error: 'history-query-failed',
        message: error.message
      });
    }
  });

  // Generate lineage graph
  router.get('/lineage/:utxoId', requireOverlay, async (req: Request, res: Response) => {
    try {
      const { utxoId } = req.params;
      const { topic, depth = 5 } = req.query;

      const graph = await overlayServices!.brc64Service!.generateLineageGraph(
        utxoId,
        topic as string,
        parseInt(depth as string)
      );

      res.json({
        success: true,
        utxoId,
        graph
      });

    } catch (error) {
      res.status(500).json({
        error: 'lineage-failed',
        message: error.message
      });
    }
  });

  // ==================== BRC-88: Service Discovery ====================

  router.get('/services/ship', requireOverlay, async (req: Request, res: Response) => {
    try {
      const advertisements = await overlayServices!.brc88Service!.getSHIPAdvertisements();
      res.json({
        success: true,
        advertisements
      });
    } catch (error) {
      res.status(500).json({
        error: 'ship-query-failed',
        message: error.message
      });
    }
  });

  router.get('/services/slap', requireOverlay, async (req: Request, res: Response) => {
    try {
      const advertisements = await overlayServices!.brc88Service!.getSLAPAdvertisements();
      res.json({
        success: true,
        advertisements
      });
    } catch (error) {
      res.status(500).json({
        error: 'slap-query-failed',
        message: error.message
      });
    }
  });

  router.post('/services/advertise', requireOverlay, requireIdentity(true), async (req: Request & { identityKey?: string }, res: Response) => {
    try {
      const { type, topicName, serviceId } = req.body;

      if (type === 'SHIP' && topicName) {
        const ad = await overlayServices!.brc88Service!.createSHIPAdvertisement(topicName);
        res.json({ success: true, type: 'SHIP', advertisement: ad });
      } else if (type === 'SLAP' && serviceId) {
        const ad = await overlayServices!.brc88Service!.createSLAPAdvertisement(serviceId);
        res.json({ success: true, type: 'SLAP', advertisement: ad });
      } else {
        res.status(400).json({
          error: 'invalid-advertisement',
          message: 'type must be SHIP (with topicName) or SLAP (with serviceId)'
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'advertise-failed',
        message: error.message
      });
    }
  });

  // ==================== BRC-26: UHRP File Storage & Streaming ====================

  // Store a file (upload endpoint)
  router.post('/files/store', requireOverlay, requireIdentity(true), upload.single('file'), rateLimit(5, 60000), async (req: Request & { identityKey?: string }, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'no-file',
          message: 'File is required'
        });
      }

      const { expiryHours = 720, isPublic = true, title, description, tags, author } = req.body; // Default 30 days

      const content = await overlayServices!.brc26Service.storeFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        {
          expiryHours: parseInt(expiryHours),
          isPublic: isPublic === 'true' || isPublic === true,
          metadata: {
            title,
            description,
            tags: tags ? tags.split(',').map((t: string) => t.trim()) : undefined,
            author
          }
        }
      );

      res.json({
        success: true,
        content: {
          hash: content.hash,
          filename: content.filename,
          contentType: content.contentType,
          size: content.size,
          uploadedAt: content.uploadedAt,
          expiresAt: content.expiresAt,
          isPublic: content.isPublic,
          metadata: content.metadata,
          downloadUrl: `/overlay/files/download/${content.hash}`
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'store-failed',
        message: error.message
      });
    }
  });

  // Download a file by hash
  router.get('/files/download/:hash', rateLimit(50, 60000), async (req: Request, res: Response) => {
    try {
      const { hash } = req.params;
      const { remote = false } = req.query;

      if (!overlayServices) {
        return res.status(503).json({
          error: 'service-unavailable',
          message: 'Overlay services not available'
        });
      }

      let result;
      if (remote === 'true') {
        // Try to download from remote hosts
        result = await overlayServices.brc26Service.downloadContent(hash);
      } else {
        // Get local file
        const buffer = await overlayServices.brc26Service.getFileBuffer(hash);
        if (buffer) {
          const content = await overlayServices.brc26Service.queryContent({ hash });
          if (content.length > 0) {
            result = { success: true, buffer, content: content[0] };
          }
        }
      }

      if (!result || !result.success || !result.buffer) {
        return res.status(404).json({
          error: 'file-not-found',
          message: 'File not found or not available'
        });
      }

      const content = result.content!;
      res.setHeader('Content-Type', content.contentType);
      res.setHeader('Content-Length', content.size);
      res.setHeader('Content-Disposition', `attachment; filename="${content.filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      res.send(result.buffer);

    } catch (error) {
      res.status(500).json({
        error: 'download-failed',
        message: error.message
      });
    }
  });

  // Query files by criteria
  router.post('/files/search', requireOverlay, rateLimit(20, 60000), async (req: Request, res: Response) => {
    try {
      const query = req.body;
      const results = await overlayServices!.brc26Service.queryContent(query);

      const files = results.map(content => ({
        hash: content.hash,
        filename: content.filename,
        contentType: content.contentType,
        size: content.size,
        uploadedAt: content.uploadedAt,
        expiresAt: content.expiresAt,
        downloadCount: content.downloadCount,
        isPublic: content.isPublic,
        metadata: content.metadata,
        downloadUrl: `/overlay/files/download/${content.hash}`
      }));

      res.json({
        success: true,
        query,
        results: files,
        count: files.length
      });

    } catch (error) {
      res.status(500).json({
        error: 'search-failed',
        message: error.message
      });
    }
  });

  // Resolve content from overlay network
  router.get('/files/resolve/:hash', requireOverlay, async (req: Request, res: Response) => {
    try {
      const { hash } = req.params;
      const resolution = await overlayServices!.brc26Service.resolveContent(hash);

      res.json({
        success: true,
        hash,
        resolution: {
          localContent: resolution.content ? {
            filename: resolution.content.filename,
            contentType: resolution.content.contentType,
            size: resolution.content.size,
            uploadedAt: resolution.content.uploadedAt,
            expiresAt: resolution.content.expiresAt,
            isPublic: resolution.content.isPublic,
            metadata: resolution.content.metadata
          } : null,
          advertisements: resolution.advertisements,
          availableHosts: resolution.availableHosts
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'resolve-failed',
        message: error.message
      });
    }
  });

  // Get file storage statistics
  router.get('/files/stats', requireOverlay, async (req: Request, res: Response) => {
    try {
      const stats = await overlayServices!.brc26Service.getStats();
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json({
        error: 'stats-failed',
        message: error.message
      });
    }
  });

  // ==================== Streaming File Support (Future Implementation) ====================

  // Initialize chunked upload for large files
  router.post('/files/stream/init', requireOverlay, rateLimit(3, 60000), async (req: Request, res: Response) => {
    try {
      const { filename, contentType, totalSize, chunkSize, enableStreaming, streamingProfiles } = req.body;

      if (!filename || !contentType || !totalSize) {
        return res.status(400).json({
          error: 'invalid-request',
          message: 'filename, contentType, and totalSize are required'
        });
      }

      // TODO: Implement streaming service integration
      res.status(501).json({
        error: 'not-implemented',
        message: 'Streaming file support is planned for future implementation',
        documentation: '/docs/STREAMING-FILE-SUPPORT-DESIGN.md',
        plannedFeatures: [
          'Chunked upload/download with resume capability',
          'Video transcoding and HLS/DASH streaming',
          'P2P distribution across overlay nodes',
          'Live streaming support'
        ]
      });

    } catch (error) {
      res.status(500).json({
        error: 'init-failed',
        message: error.message
      });
    }
  });

  // Upload a chunk (placeholder)
  router.put('/files/stream/:uploadId/chunk/:chunkIndex', requireOverlay, rateLimit(20, 60000), async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'not-implemented',
      message: 'Chunk upload will be implemented in streaming support phase',
      expectedUsage: {
        method: 'PUT',
        contentType: 'application/octet-stream',
        body: 'Binary chunk data',
        headers: {
          'Content-Length': 'Chunk size in bytes',
          'Content-Range': 'bytes start-end/total'
        }
      }
    });
  });

  // Complete chunked upload (placeholder)
  router.post('/files/stream/:uploadId/complete', requireOverlay, async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'not-implemented',
      message: 'Upload completion will be implemented in streaming support phase'
    });
  });

  // Get upload status (placeholder)
  router.get('/files/stream/:uploadId/status', requireOverlay, async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'not-implemented',
      message: 'Upload status tracking will be implemented in streaming support phase'
    });
  });

  // Get streaming info for video content (placeholder)
  router.get('/files/stream/:hash/info', rateLimit(10, 60000), async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'not-implemented',
      message: 'Video streaming info will be implemented in streaming support phase',
      plannedResponse: {
        hash: 'Content hash',
        filename: 'Original filename',
        duration: 'Video duration in seconds',
        profiles: [
          {
            profileId: '720p',
            quality: '720p',
            bitrate: 2500000,
            format: 'hls',
            playlistUrl: '/overlay/files/stream/hash/720p/playlist.m3u8'
          }
        ]
      }
    });
  });

  // HLS playlist (placeholder)
  router.get('/files/stream/:hash/:profile/playlist.m3u8', rateLimit(50, 60000), async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'not-implemented',
      message: 'HLS streaming will be implemented in streaming support phase'
    });
  });

  // HLS segments (placeholder)
  router.get('/files/stream/:hash/:profile/segment_:index.ts', rateLimit(100, 60000), async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'not-implemented',
      message: 'HLS segment serving will be implemented in streaming support phase'
    });
  });

  // DASH manifest (placeholder)
  router.get('/files/stream/:hash/manifest.mpd', rateLimit(50, 60000), async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'not-implemented',
      message: 'DASH streaming will be implemented in streaming support phase'
    });
  });

  // Direct chunk access with range support (placeholder)
  router.get('/files/stream/:hash/chunk/:index', rateLimit(100, 60000), async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'not-implemented',
      message: 'Chunk-based streaming will be implemented in streaming support phase',
      plannedFeatures: [
        'HTTP Range request support (206 responses)',
        'Parallel chunk downloads',
        'Resume capability for interrupted downloads',
        'P2P chunk distribution'
      ]
    });
  });

  // ==================== Legacy Overlay Routes (for backward compatibility) ====================

  // Subscribe to a topic
  router.post('/subscribe', requireOverlay, requireIdentity(true), async (req: Request & { identityKey?: string }, res: Response) => {
    try {
      const { topic } = req.body;
      if (!topic || typeof topic !== 'string') {
        return res.status(400).json({
          error: 'invalid-topic',
          message: 'Topic must be a non-empty string'
        });
      }

      await overlayServices!.overlayManager.subscribeToTopic(topic);
      res.json({
        success: true,
        topic,
        message: `Subscribed to topic: ${topic}`
      });
    } catch (error) {
      res.status(500).json({
        error: 'subscription-failed',
        message: error.message
      });
    }
  });

  // Publish a D01A manifest
  router.post('/publish', requireOverlay, requireIdentity(true), async (req: Request & { identityKey?: string }, res: Response) => {
    try {
      const { manifest } = req.body;
      if (!manifest || !manifest.datasetId) {
        return res.status(400).json({
          error: 'invalid-manifest',
          message: 'Valid D01A manifest with datasetId is required'
        });
      }

      const messageId = await overlayServices!.overlayManager.publishManifest(manifest);
      res.json({
        success: true,
        messageId,
        manifest: {
          datasetId: manifest.datasetId,
          description: manifest.description
        },
        message: 'Manifest published to overlay network'
      });
    } catch (error) {
      res.status(500).json({
        error: 'publish-failed',
        message: error.message
      });
    }
  });

  // Search overlay network
  router.post('/search', requireOverlay, async (req: Request, res: Response) => {
    try {
      const query = req.body;
      if (!query || typeof query !== 'object') {
        return res.status(400).json({
          error: 'invalid-query',
          message: 'Search query object is required'
        });
      }

      await overlayServices!.overlayManager.searchData(query);
      res.json({
        success: true,
        query,
        message: 'Search request sent to overlay network. Results will be available via events or cached responses.'
      });
    } catch (error) {
      res.status(500).json({
        error: 'search-failed',
        message: error.message
      });
    }
  });

  // Get available topics
  router.get('/topics', (req: Request, res: Response) => {
    const standardTopics = Object.entries(D01A_TOPICS).map(([key, value]) => ({
      name: key,
      topic: value,
      description: getTopicDescription(key)
    }));

    res.json({
      standardTopics,
      subscribedTopics: overlayServices ? overlayServices.overlayManager.getStats().subscriptions : {},
      dynamicTopics: {
        dataset: 'Use TopicGenerator.datasetTopic(datasetId, classification)',
        model: 'Use TopicGenerator.modelTopic(modelId, purpose)',
        agent: 'Use TopicGenerator.agentTopic(agentId, purpose)',
        payment: 'Use TopicGenerator.paymentTopic(receiptId)'
      }
    });
  });

  // Health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    const isHealthy = overlayServices ? overlayServices.overlayManager.isConnected() : false;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      enabled: !!overlayServices,
      connected: isHealthy,
      timestamp: Date.now()
    });
  });

  return {
    router,
    setOverlayServices
  };
}

/**
 * Get human-readable description for a topic
 */
function getTopicDescription(topicKey: string): string {
  const descriptions: Record<string, string> = {
    'DATA_MANIFEST': 'D01A manifest publishing and discovery',
    'DATA_CONTENT': 'Data content distribution (restricted)',
    'DATA_METADATA': 'Data metadata and descriptions',
    'DATASET_PUBLIC': 'Public dataset announcements',
    'DATASET_COMMERCIAL': 'Commercial dataset offerings',
    'DATASET_RESEARCH': 'Research dataset sharing',
    'DATASET_INTERNAL': 'Internal dataset management',
    'MODEL_WEIGHTS': 'AI model weight distribution',
    'MODEL_INFERENCE': 'AI model inference services',
    'MODEL_TRAINING': 'AI model training coordination',
    'AGENT_REGISTRY': 'Agent capability announcements',
    'AGENT_CAPABILITIES': 'Agent capability descriptions',
    'AGENT_JOBS': 'Agent job coordination',
    'AGENT_RESULTS': 'Agent execution results',
    'PAYMENT_QUOTES': 'Payment quote requests and responses',
    'PAYMENT_RECEIPTS': 'Payment receipt confirmations',
    'PAYMENT_DISPUTES': 'Payment dispute resolution',
    'LINEAGE_GRAPH': 'Data lineage graph updates',
    'LINEAGE_EVENTS': 'Lineage tracking events',
    'PROVENANCE_CHAIN': 'Data provenance chain',
    'SEARCH_QUERIES': 'Data discovery search queries',
    'SEARCH_RESULTS': 'Search result responses',
    'SEARCH_INDEX': 'Search index management',
    'ALERT_POLICY': 'Policy violation alerts',
    'ALERT_QUALITY': 'Data quality alerts',
    'ALERT_SECURITY': 'Security incident alerts',
    'POLICY_UPDATES': 'Policy governance updates',
    'GOVERNANCE_VOTES': 'Governance voting activities',
    'COMPLIANCE_REPORTS': 'Compliance status reports'
  };

  return descriptions[topicKey] || 'Custom overlay topic';
}

// Alias for server.ts compatibility
export const overlayBrcRouter = enhancedOverlayRouter;