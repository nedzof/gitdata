/**
 * D21 BSV Native Payment Extensions Routes
 *
 * Express routes that extend BRC-41 with native BSV infrastructure:
 * - Payment templates with deterministic revenue splits
 * - ARC broadcasting with comprehensive lifecycle tracking
 * - Cross-network settlement coordination
 * - AI agent payment workflows
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

import { getBRC31Identity, type BRC31Request } from '../brc31/middleware.js';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp.js';

import D21PaymentTemplateServiceImpl from './template-service.js';
import D21ARCBroadcastServiceImpl from './arc-service.js';
import type {
  D21PaymentTemplate,
  D21ARCBroadcastRequest,
  D21ARCBroadcastResult,
  PaymentSplitRules,
} from './types.js';
import { D21Error, D21TemplateError, D21ARCError } from './types.js';

// ==================== Extended Request Interface ====================

export interface D21Request extends BRC31Request {
  d21?: {
    templateService: D21PaymentTemplateServiceImpl;
    arcService: D21ARCBroadcastServiceImpl;
  };
}

// ==================== Route Factory ====================

export default function createD21Routes(
  database: DatabaseAdapter,
  callbackBaseUrl?: string
): Router {
  const router = Router();

  // Initialize D21 services
  const templateService = new D21PaymentTemplateServiceImpl(database);
  const arcService = new D21ARCBroadcastServiceImpl(database, callbackBaseUrl);

  // Middleware to add D21 services to request
  router.use((req: D21Request, res: Response, next: NextFunction) => {
    req.d21 = {
      templateService,
      arcService,
    };
    next();
  });

  // ==================== Payment Template Routes ====================

  /**
   * Generate deterministic payment template
   * POST /d21/templates/generate
   */
  router.post('/templates/generate',
    // Validation
    body('splitRules').isObject().withMessage('Split rules must be an object'),
    body('totalSatoshis').isInt({ min: 1 }).withMessage('Total satoshis must be positive'),
    body('createdBy').isString().isLength({ min: 66, max: 66 }).withMessage('Invalid BRC-31 identity key'),
    body('brc41PaymentId').optional().isString().withMessage('BRC-41 payment ID must be string'),

    async (req: D21Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { splitRules, totalSatoshis, createdBy, brc41PaymentId, metadata } = req.body;

        // Validate BRC-31 identity if available
        if (req.brc31Identity && req.brc31Identity.identityKey !== createdBy) {
          return res.status(403).json({
            error: 'Identity mismatch',
            message: 'createdBy must match authenticated BRC-31 identity'
          });
        }

        console.log(`🎯 Generating payment template for ${totalSatoshis} satoshis`);

        const template = await req.d21!.templateService.generateTemplate({
          brc41PaymentId,
          splitRules: splitRules as PaymentSplitRules,
          totalSatoshis,
          createdBy,
          metadata,
        });

        res.json({
          success: true,
          template: {
            templateId: template.templateId,
            templateHash: template.templateHash,
            brc41PaymentId: template.brc41PaymentId,
            splitRules: template.splitRules,
            outputScripts: template.outputScripts,
            totalAmountSatoshis: template.totalAmountSatoshis,
            expiresAt: template.expiresAt,
          }
        });

      } catch (error) {
        console.error('Template generation failed:', error);
        if (error instanceof D21TemplateError) {
          return res.status(400).json({ error: error.message, code: error.code });
        }
        next(error);
      }
    }
  );

  /**
   * Get payment template by hash
   * GET /d21/templates/:templateHash
   */
  router.get('/templates/:templateHash',
    param('templateHash').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid template hash'),

    async (req: D21Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { templateHash } = req.params;

        const template = await req.d21!.templateService.getTemplate(templateHash);
        if (!template) {
          return res.status(404).json({
            error: 'Template not found',
            templateHash
          });
        }

        // Verify template integrity
        const isValid = await req.d21!.templateService.verifyTemplate(templateHash);

        // Get usage analytics
        const usage = await req.d21!.templateService.getTemplateUsage(templateHash);

        res.json({
          success: true,
          template,
          verification: {
            isValid,
            verified: isValid
          },
          usage
        });

      } catch (error) {
        console.error('Template retrieval failed:', error);
        next(error);
      }
    }
  );

  // ==================== ARC Broadcasting Routes ====================

  /**
   * Broadcast transaction via ARC with lifecycle tracking
   * POST /d21/arc/broadcast
   */
  router.post('/arc/broadcast',
    // Validation
    body('rawTx').isHexadecimal().withMessage('Raw transaction must be valid hex'),
    body('templateId').optional().isString().withMessage('Template ID must be string'),
    body('preferredProvider').optional().isString().withMessage('Preferred provider must be string'),
    body('waitForStatus').optional().isIn([
      'RECEIVED', 'STORED', 'ANNOUNCED_TO_NETWORK', 'SENT_TO_NETWORK', 'SEEN_ON_NETWORK', 'MINED'
    ]).withMessage('Invalid wait status'),
    body('callbackUrl').optional().isURL().withMessage('Callback URL must be valid'),

    async (req: D21Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const broadcastRequest: D21ARCBroadcastRequest = {
          rawTx: req.body.rawTx,
          templateId: req.body.templateId,
          preferredProvider: req.body.preferredProvider,
          enableCallbacks: !!req.body.callbackUrl,
          callbackUrl: req.body.callbackUrl,
          waitForStatus: req.body.waitForStatus,
          maxTimeout: req.body.maxTimeout,
        };

        console.log(`🚀 Broadcasting transaction via ARC${broadcastRequest.preferredProvider ? ` (${broadcastRequest.preferredProvider})` : ''}`);

        const result = await req.d21!.arcService.broadcastTransaction(broadcastRequest);

        res.json({
          success: true,
          txid: result.txid,
          status: result.status,
          provider: result.broadcastProvider,
          timestamp: result.timestamp,
          lifecycle: {
            announceTime: result.announceTime,
            seenOnNetworkTime: result.seenOnNetworkTime,
            minedTime: result.minedTime,
          },
          arcResponse: result.broadcastResponse
        });

      } catch (error) {
        console.error('ARC broadcast failed:', error);
        if (error instanceof D21ARCError) {
          return res.status(502).json({ error: error.message, code: error.code, provider: error.provider });
        }
        next(error);
      }
    }
  );

  /**
   * Get transaction status with full lifecycle
   * GET /d21/arc/tx/:txid/status
   */
  router.get('/arc/tx/:txid/status',
    param('txid').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid transaction ID'),
    query('providerId').optional().isString().withMessage('Provider ID must be string'),

    async (req: D21Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { txid } = req.params;
        const { providerId } = req.query;

        const status = await req.d21!.arcService.getTransactionStatus(txid, providerId as string);

        res.json({
          success: true,
          txid,
          status: status.status,
          blockHash: status.blockHash,
          blockHeight: status.blockHeight,
          timestamp: status.timestamp,
          txStatus: status.txStatus,
          extraInfo: status.extraInfo
        });

      } catch (error) {
        console.error('Transaction status check failed:', error);
        if (error instanceof D21ARCError) {
          return res.status(502).json({ error: error.message, code: error.code });
        }
        next(error);
      }
    }
  );

  /**
   * Get ARC provider health and capabilities
   * GET /d21/arc/providers
   */
  router.get('/arc/providers',
    async (req: D21Request, res: Response, next: NextFunction) => {
      try {
        const providers = await req.d21!.arcService.getProviders();

        // Get health status for each provider
        const providersWithHealth = await Promise.all(
          providers.map(async (provider) => {
            try {
              const health = await req.d21!.arcService.getProviderHealth(provider.providerId);
              return {
                ...provider,
                health: {
                  isHealthy: health.isHealthy,
                  responseTime: health.responseTime,
                  lastChecked: health.lastChecked,
                  currentFeeQuote: health.currentFeeQuote
                }
              };
            } catch (error) {
              return {
                ...provider,
                health: {
                  isHealthy: false,
                  responseTime: 0,
                  lastChecked: new Date(),
                  error: error.message
                }
              };
            }
          })
        );

        res.json({
          success: true,
          providers: providersWithHealth
        });

      } catch (error) {
        console.error('Provider listing failed:', error);
        next(error);
      }
    }
  );

  /**
   * ARC callback endpoint for merkle proofs
   * POST /d21/arc/callback/:providerId
   */
  router.post('/arc/callback/:providerId',
    param('providerId').isString().withMessage('Provider ID is required'),
    body('txid').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid transaction ID'),
    body('merklePath').isHexadecimal().withMessage('Merkle path must be hex'),
    body('blockHeight').isInt({ min: 0 }).withMessage('Block height must be positive integer'),

    async (req: D21Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { providerId } = req.params;
        const { txid, merklePath, blockHeight } = req.body;

        console.log(`📨 Received ARC callback from ${providerId} for ${txid.slice(0, 10)}...`);

        await req.d21!.arcService.handleARCCallback(providerId, {
          txid,
          merklePath,
          blockHeight
        });

        res.json({ status: 'success' });

      } catch (error) {
        console.error('ARC callback processing failed:', error);
        if (error instanceof D21ARCError) {
          return res.status(400).json({ error: error.message, code: error.code });
        }
        next(error);
      }
    }
  );

  // ==================== Error Handler ====================

  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('D21 route error:', error);

    if (error instanceof D21Error) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  });

  return router;
}

// ==================== Route Integration Helpers ====================

/**
 * Integration with BRC-41 payment system
 */
export function integrateBRC41Payments(
  d21Router: Router,
  brc41PaymentService: any
): void {
  // Add middleware to cross-reference BRC-41 payments with D21 templates
  d21Router.use('/templates', async (req: any, res, next) => {
    if (req.body.brc41PaymentId && brc41PaymentService) {
      try {
        // Verify BRC-41 payment exists
        const payment = await brc41PaymentService.getPaymentRecord(req.body.brc41PaymentId);
        if (!payment) {
          return res.status(400).json({
            error: 'BRC-41 payment not found',
            brc41PaymentId: req.body.brc41PaymentId
          });
        }

        req.brc41Payment = payment;
      } catch (error) {
        console.warn('BRC-41 payment verification failed:', error);
      }
    }
    next();
  });
}