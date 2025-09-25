/**
 * Enhanced BSV Overlay API Routes with Full BRC-31 Authentication
 *
 * Updated overlay routes that use BRC-31 authentication for all endpoints,
 * with backward compatibility for existing clients.
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import multer from 'multer';

import type { BRC31Request } from '../brc31/middleware';
import { requireBRC31Identity, optionalBRC31Identity, getBRC31Identity, isBRC31Enabled } from '../brc31/middleware';
import type { GitdataOverlayServices } from '../overlay/index';
import { D01A_TOPICS, TopicGenerator } from '../overlay/overlay-config';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1,
  },
});

export interface EnhancedBRC31OverlayRouter {
  router: Router;
  setOverlayServices?: (services: GitdataOverlayServices) => void;
}

export function enhancedBRC31OverlayRouter(): EnhancedBRC31OverlayRouter {
  const router = Router();
  let overlayServices: GitdataOverlayServices | null = null;

  // Set overlay services (called after initialization)
  function setOverlayServices(services: GitdataOverlayServices): void {
    overlayServices = services;
  }

  // Middleware to check if overlay is available
  function requireOverlay(req: Request, res: Response, next: NextFunction): void {
    if (!overlayServices || !overlayServices.overlayManager.isConnected()) {
      return res.status(503).json({
        error: 'overlay-unavailable',
        message:
          'BSV overlay network is not available. Set OVERLAY_ENABLED=true and ensure wallet is connected.',
      });
    }
    next();
  }

  // Enhanced rate limiting with BRC-31 identity awareness
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  function intelligentRateLimit(maxRequests: number, windowMs: number, vipMultiplier: number = 2) {
    return (req: BRC31Request, res: Response, next: NextFunction) => {
      const identity = getBRC31Identity(req);
      const ip = req.ip || req.connection.remoteAddress || 'unknown';

      // Use identity key if available, otherwise fall back to IP
      const rateLimitKey = identity?.publicKey || `ip:${ip}`;
      const now = Date.now();

      // Apply multiplier for higher trust scores
      let effectiveMaxRequests = maxRequests;
      if (identity && identity.trustScore > 70) {
        effectiveMaxRequests = Math.floor(maxRequests * vipMultiplier);
      }

      const current = requestCounts.get(rateLimitKey);
      if (!current || now > current.resetTime) {
        requestCounts.set(rateLimitKey, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (current.count >= effectiveMaxRequests) {
        return res.status(429).json({
          error: 'rate-limit-exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((current.resetTime - now) / 1000),
          brc31: {
            identityLevel: identity?.level || 'anonymous',
            trustScore: identity?.trustScore || 0,
            rateLimit: {
              current: current.count,
              max: effectiveMaxRequests,
              window: Math.ceil(windowMs / 1000),
            },
          },
        });
      }

      current.count++;
      next();
    };
  }

  // ==================== Core Overlay Routes with BRC-31 ====================

  // Get comprehensive overlay network status with BRC-31 identity info
  router.get('/status', optionalBRC31Identity(), (req: BRC31Request, res: Response) => {
    if (!overlayServices) {
      return res.json({
        enabled: false,
        connected: false,
        message: 'BSV overlay integration is disabled',
      });
    }

    const manager = overlayServices.overlayManager;
    const stats = manager.getStats();
    const identity = getBRC31Identity(req);

    res.json({
      enabled: isBRC31Enabled(),
      connected: manager.isConnected(),
      stats,
      environment: process.env.OVERLAY_ENV || 'development',
      brc31: {
        authenticated: identity?.verified || false,
        identityLevel: identity?.level || 'anonymous',
        trustScore: identity?.trustScore || 0,
        version: '0.1',
      },
      services: {
        brc22: 'Transaction Submission (BRC-31 Required)',
        brc24: 'Lookup Services (BRC-31 Optional)',
        brc64: 'History Tracking',
        brc88: 'Service Discovery',
        brc26: 'File Storage (BRC-31 Required)',
        payments: 'Payment Processing',
      },
    });
  });

  // ==================== BRC-22: Transaction Submission with BRC-31 ====================

  router.post(
    '/submit',
    requireOverlay,
    requireBRC31Identity('verified'), // Require verified identity for submissions
    intelligentRateLimit(10, 60000),
    async (req: BRC31Request, res: Response) => {
      try {
        const { rawTx, inputs, topics, mapiResponses } = req.body;
        const identity = getBRC31Identity(req);

        if (!rawTx || !inputs || !topics) {
          return res.status(400).json({
            error: 'invalid-transaction',
            message: 'rawTx, inputs, and topics are required',
          });
        }

        // Enhance transaction with BRC-31 identity context
        const transaction = {
          rawTx,
          inputs,
          topics,
          mapiResponses,
          brc31Context: {
            submittedBy: identity!.publicKey,
            identityLevel: identity!.level,
            trustScore: identity!.trustScore,
            timestamp: Date.now(),
          },
        };

        const result = await overlayServices!.brc22Service!.processSubmission(transaction);

        res.json({
          success: true,
          result,
          message: 'Transaction submitted successfully',
          brc31: {
            identityLevel: identity!.level,
            trustScore: identity!.trustScore,
            submissionId: result.txid || 'unknown',
          },
        });
      } catch (error) {
        res.status(500).json({
          error: 'submission-failed',
          message: error.message,
          brc31: {
            authenticated: true,
            identityLevel: getBRC31Identity(req)?.level,
          },
        });
      }
    },
  );

  // ==================== BRC-24: Lookup Services with Optional BRC-31 ====================

  router.post(
    '/lookup',
    requireOverlay,
    optionalBRC31Identity(), // Optional authentication for lookups
    intelligentRateLimit(20, 60000, 3), // Higher limits for authenticated users
    async (req: BRC31Request, res: Response) => {
      try {
        const { provider, query } = req.body;
        const identity = getBRC31Identity(req);

        if (!provider || !query) {
          return res.status(400).json({
            error: 'invalid-lookup',
            message: 'provider and query are required',
          });
        }

        // Enhanced query with identity context
        const enhancedQuery = {
          ...query,
          brc31Context: identity
            ? {
                requestedBy: identity.publicKey,
                identityLevel: identity.level,
                trustScore: identity.trustScore,
              }
            : undefined,
        };

        const results = await overlayServices!.brc24Service!.processLookup(provider, enhancedQuery);

        res.json({
          success: true,
          provider,
          query: query, // Don't expose enhanced query
          results,
          count: results.length,
          brc31: {
            authenticated: identity?.verified || false,
            identityLevel: identity?.level || 'anonymous',
            enhancedResults: !!identity, // Authenticated users get enhanced results
          },
        });
      } catch (error) {
        res.status(500).json({
          error: 'lookup-failed',
          message: error.message,
          brc31: {
            authenticated: getBRC31Identity(req)?.verified || false,
          },
        });
      }
    },
  );

  // ==================== BRC-26: UHRP File Storage with BRC-31 ====================

  // Store a file with BRC-31 authentication
  router.post(
    '/files/store',
    requireOverlay,
    requireBRC31Identity('public-key'), // Require at least public key identity
    upload.single('file'),
    intelligentRateLimit(5, 60000, 2),
    async (req: BRC31Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            error: 'no-file',
            message: 'File is required',
          });
        }

        const identity = getBRC31Identity(req)!;
        const { expiryHours = 720, isPublic = true, title, description, tags, author } = req.body;

        // Set storage parameters based on identity level
        const maxExpiryHours =
          identity.level === 'certified'
            ? 8760 // 1 year for certified
            : identity.level === 'verified'
              ? 2160 // 90 days for verified
              : 720; // 30 days for public-key

        const actualExpiryHours = Math.min(parseInt(expiryHours), maxExpiryHours);

        const content = await overlayServices!.brc26Service.storeFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          {
            expiryHours: actualExpiryHours,
            isPublic: isPublic === 'true' || isPublic === true,
            metadata: {
              title,
              description,
              tags: tags ? tags.split(',').map((t: string) => t.trim()) : undefined,
              author,
              uploadedBy: identity.publicKey,
              identityLevel: identity.level,
              trustScore: identity.trustScore,
            },
          },
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
            downloadUrl: `/overlay/files/download/${content.hash}`,
          },
          brc31: {
            identityLevel: identity.level,
            trustScore: identity.trustScore,
            maxExpiryHours,
            actualExpiryHours,
          },
        });
      } catch (error) {
        res.status(500).json({
          error: 'store-failed',
          message: error.message,
          brc31: {
            authenticated: true,
            identityLevel: getBRC31Identity(req)?.level,
          },
        });
      }
    },
  );

  // Download a file with optional BRC-31 enhancement
  router.get(
    '/files/download/:hash',
    optionalBRC31Identity(),
    intelligentRateLimit(50, 60000, 5),
    async (req: BRC31Request, res: Response) => {
      try {
        const { hash } = req.params;
        const { remote = false } = req.query;
        const identity = getBRC31Identity(req);

        if (!overlayServices) {
          return res.status(503).json({
            error: 'service-unavailable',
            message: 'Overlay services not available',
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
            message: 'File not found or not available',
            brc31: {
              authenticated: identity?.verified || false,
              enhancedSearch: !!identity,
            },
          });
        }

        const content = result.content!;

        // Enhanced headers for authenticated users
        res.setHeader('Content-Type', content.contentType);
        res.setHeader('Content-Length', content.size);
        res.setHeader('Content-Disposition', `attachment; filename="${content.filename}"`);
        res.setHeader('Cache-Control', identity ? 'private, max-age=7200' : 'public, max-age=3600');

        if (identity) {
          res.setHeader('X-BRC31-Identity-Level', identity.level);
          res.setHeader('X-BRC31-Trust-Score', identity.trustScore.toString());
        }

        res.send(result.buffer);
      } catch (error) {
        res.status(500).json({
          error: 'download-failed',
          message: error.message,
          brc31: {
            authenticated: getBRC31Identity(req)?.verified || false,
          },
        });
      }
    },
  );

  // ==================== BRC-31 Specific Management Routes ====================

  // Get BRC-31 authentication status and statistics
  router.get('/brc31/status', optionalBRC31Identity(), async (req: BRC31Request, res: Response) => {
    try {
      const identity = getBRC31Identity(req);

      res.json({
        brc31: {
          version: '0.1',
          enabled: true,
          authenticated: !!identity,
          identity: identity
            ? {
                publicKey: identity.publicKey,
                level: identity.level,
                trustScore: identity.trustScore,
                certificateCount: identity.certificates.length,
              }
            : null,
          supportedFeatures: [
            'mutual-authentication',
            'certificate-chains',
            'nonce-management',
            'signature-verification',
            'identity-levels',
            'trust-scoring',
          ],
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'brc31-status-failed',
        message: error.message,
      });
    }
  });

  // Request server's BRC-31 initial response
  router.post('/brc31/handshake', async (req: Request, res: Response) => {
    try {
      const { identityKey, nonce, requestedCertificates } = req.body;

      if (!identityKey || !nonce) {
        return res.status(400).json({
          error: 'invalid-handshake',
          message: 'identityKey and nonce are required',
        });
      }

      // TODO: Implement proper BRC-31 handshake
      // This should return initialResponse with server nonce and certificates

      res.json({
        authrite: '0.1',
        messageType: 'initialResponse',
        identityKey: 'SERVER_PUBLIC_KEY', // TODO: Use actual server key
        nonce: Buffer.from(
          Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)),
        ).toString('base64'),
        signature: 'SERVER_SIGNATURE', // TODO: Implement proper signature
      });
    } catch (error) {
      res.status(500).json({
        error: 'handshake-failed',
        message: error.message,
      });
    }
  });

  return {
    router,
    setOverlayServices,
  };
}

// ==================== Utility Functions ====================

/**
 * Get human-readable description for a topic
 */
function getTopicDescription(topicKey: string): string {
  const descriptions: Record<string, string> = {
    DATA_MANIFEST: 'D01A manifest publishing and discovery',
    DATA_CONTENT: 'Data content distribution (restricted)',
    DATA_METADATA: 'Data metadata and descriptions',
    DATASET_PUBLIC: 'Public dataset announcements',
    DATASET_COMMERCIAL: 'Commercial dataset offerings',
    DATASET_RESEARCH: 'Research dataset sharing',
    DATASET_INTERNAL: 'Internal dataset management',
    MODEL_WEIGHTS: 'AI model weight distribution',
    MODEL_INFERENCE: 'AI model inference services',
    MODEL_TRAINING: 'AI model training coordination',
    AGENT_REGISTRY: 'Agent capability announcements',
    AGENT_CAPABILITIES: 'Agent capability descriptions',
    AGENT_JOBS: 'Agent job coordination',
    AGENT_RESULTS: 'Agent execution results',
    PAYMENT_QUOTES: 'Payment quote requests and responses',
    PAYMENT_RECEIPTS: 'Payment receipt confirmations',
    PAYMENT_DISPUTES: 'Payment dispute resolution',
    LINEAGE_GRAPH: 'Data lineage graph updates',
    LINEAGE_EVENTS: 'Lineage tracking events',
    PROVENANCE_CHAIN: 'Data provenance chain',
    SEARCH_QUERIES: 'Data discovery search queries',
    SEARCH_RESULTS: 'Search result responses',
    SEARCH_INDEX: 'Search index management',
    ALERT_POLICY: 'Policy violation alerts',
    ALERT_QUALITY: 'Data quality alerts',
    ALERT_SECURITY: 'Security incident alerts',
    POLICY_UPDATES: 'Policy governance updates',
    GOVERNANCE_VOTES: 'Governance voting activities',
    COMPLIANCE_REPORTS: 'Compliance status reports',
  };

  return descriptions[topicKey] || 'Custom overlay topic';
}

// Alias for server.ts compatibility
export const overlayBrc31Router = enhancedBRC31OverlayRouter;
