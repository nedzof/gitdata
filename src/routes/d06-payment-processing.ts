/**
 * D06 - Enhanced BSV Overlay Network Payment Processing API
 * Enterprise Payment Platform with BRC Standards Integration
 */

import crypto from 'crypto';

import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { Pool } from 'pg';

import { getPostgreSQLClient } from '../db/postgresql';
import { requireIdentity } from '../middleware/identity';
import {
  BRCPaymentIntegrationService,
  ensureBRC22Tables,
} from '../services/brc-payment-integration';
import { BSVPaymentProcessor } from '../services/bsv-payment-processor';

interface PaymentRequest {
  versionId: string;
  quantity?: number;
  paymentMethod?: string;
  agentId?: string;
  identityProof?: {
    identityKey: string;
    certificate?: string;
  };
}

interface PaymentResponse {
  receiptId: string;
  versionId: string;
  contentHash: string;
  paymentDetails: {
    quantity: number;
    unitPriceSatoshis: number;
    totalSatoshis: number;
    pricingTier: string;
    currency: string;
  };
  paymentTransaction?: {
    txid: string;
    vout: number;
    requiredConfirmations: number;
    currentConfirmations: number;
  };
  identity?: {
    identityKey: string;
    verificationLevel: string;
    trustScore: number;
  };
  usage: {
    downloadAllowance: number;
    bytesAllowance?: number;
    expiresAt: string;
  };
  revenueAllocation: {
    producerShareSatoshis: number;
    platformFeeSatoshis: number;
    agentCommissionSatoshis: number;
  };
  overlayNetwork: {
    topics: string[];
    settlementNetwork: string;
    notificationSent: boolean;
  };
  status: string;
  createdAt: string;
  expiresAt: string;
}

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

function isValidVersionId(versionId: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(versionId);
}

export function d06PaymentProcessingRouter(): Router {
  const router = makeRouter();

  // Initialize database connection
  const database = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'overlay',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password',
  });

  // Initialize services
  const brcIntegration = new BRCPaymentIntegrationService(database, {
    overlayTopics: ['payments', 'settlements', 'agent-payments', 'marketplace'],
    minTrustScore: parseFloat(process.env.BRC31_MIN_TRUST_SCORE || '0.7'),
  });

  const bsvProcessor = new BSVPaymentProcessor(database, {
    minConfirmations: parseInt(process.env.BSV_MIN_CONFIRMATIONS || '6'),
    network: process.env.BSV_NETWORK || 'mainnet',
  });

  // Ensure BRC-22 tables exist
  ensureBRC22Tables(database).catch(console.error);

  // Start BSV confirmation monitoring
  bsvProcessor.startConfirmationMonitoring().catch(console.error);

  /**
   * POST /pay - Enhanced payment processing
   */
  router.post('/pay', requireIdentity(true), async (req: Request, res: Response) => {
    try {
      const {
        versionId,
        quantity = 1,
        paymentMethod = 'bsv',
        agentId,
        identityProof,
      } = req.body as PaymentRequest;

      // Validation
      if (!isValidVersionId(versionId)) {
        return json(res, 400, {
          error: 'invalid-version-id',
          hint: 'versionId must be 64-character hex',
        });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return json(res, 400, {
          error: 'invalid-quantity',
          hint: 'quantity must be positive integer',
        });
      }

      // Get manifest and pricing
      const manifestResult = await database.query(
        'SELECT version_id, content_hash, producer_id, title FROM assets WHERE version_id = $1',
        [versionId],
      );

      if (manifestResult.rows.length === 0) {
        return json(res, 404, { error: 'manifest-not-found' });
      }

      const manifest = manifestResult.rows[0];

      // Get pricing (using existing price system)
      const { getBestUnitPrice } = await import('../db');
      const defaultPrice = parseInt(process.env.PRICE_DEFAULT_SATS || '5000');
      const pricing = await getBestUnitPrice(versionId, quantity, defaultPrice);

      const unitPrice = pricing.satoshis;
      const totalSatoshis = unitPrice * quantity;

      // Revenue allocation calculation
      const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '0.05');
      const agentCommissionPercent = parseFloat(process.env.AGENT_COMMISSION_PERCENTAGE || '0.02');

      const platformFeeSatoshis = Math.floor(totalSatoshis * platformFeePercent);
      const agentCommissionSatoshis = agentId
        ? Math.floor(totalSatoshis * agentCommissionPercent)
        : 0;
      const producerShareSatoshis = totalSatoshis - platformFeeSatoshis - agentCommissionSatoshis;

      // Create receipt in overlay_receipts table
      const receiptId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      let identityData = null;
      if (identityProof) {
        const verification = await brcIntegration.identity.verifyIdentity(
          identityProof.identityKey,
          identityProof.certificate,
        );

        if (!verification.success) {
          return json(res, 403, {
            error: 'identity-verification-failed',
            reason: verification.reason,
            trustScore: verification.trustScore,
          });
        }

        identityData = verification.identity;
      }

      // Insert payment record
      await database.query(
        `
        INSERT INTO overlay_receipts (
          receipt_id, version_id, content_hash, payer_identity_key, payer_address,
          producer_id, agent_id, quantity, unit_price_satoshis, total_satoshis,
          pricing_tier, currency_code, overlay_topics, settlement_network,
          status, expires_at, download_allowance, bytes_allowance,
          producer_share_satoshis, platform_fee_satoshis, agent_commission_satoshis,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW()
        )
      `,
        [
          receiptId,
          versionId,
          manifest.content_hash,
          identityProof?.identityKey || null,
          req.ip || 'unknown',
          manifest.producer_id,
          agentId || null,
          quantity,
          unitPrice,
          totalSatoshis,
          pricing.source || 'standard',
          'BSV',
          ['payments', 'marketplace'],
          'bsv-main',
          'pending',
          expiresAt,
          quantity,
          totalSatoshis > 10000000 ? null : 104857600, // 100MB for small payments
          producerShareSatoshis,
          platformFeeSatoshis,
          agentCommissionSatoshis,
        ],
      );

      // Broadcast payment creation event via BRC-22
      await brcIntegration.notifications.broadcastPaymentEvent({
        eventType: 'payment-created',
        receiptId,
        agentId: agentId || undefined,
        topics: ['payments', 'marketplace'],
        timestamp: new Date(),
        details: {
          versionId,
          totalSatoshis,
          quantity,
          producerId: manifest.producer_id,
          identityVerified: !!identityProof,
        },
      });

      // Prepare response
      const response: PaymentResponse = {
        receiptId,
        versionId,
        contentHash: manifest.content_hash,
        paymentDetails: {
          quantity,
          unitPriceSatoshis: unitPrice,
          totalSatoshis,
          pricingTier: pricing.source || 'standard',
          currency: 'BSV',
        },
        identity: identityData
          ? {
              identityKey: identityData.identityKey,
              verificationLevel: identityData.verificationLevel,
              trustScore: identityData.trustScore,
            }
          : undefined,
        usage: {
          downloadAllowance: quantity,
          bytesAllowance: totalSatoshis > 10000000 ? undefined : 104857600,
          expiresAt: expiresAt.toISOString(),
        },
        revenueAllocation: {
          producerShareSatoshis,
          platformFeeSatoshis,
          agentCommissionSatoshis,
        },
        overlayNetwork: {
          topics: ['payments', 'marketplace'],
          settlementNetwork: 'bsv-main',
          notificationSent: true,
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      return json(res, 200, response);
    } catch (error) {
      console.error('Payment processing error:', error);
      return json(res, 500, { error: 'payment-processing-failed', message: error.message });
    }
  });

  /**
   * GET /receipts/:receiptId - Comprehensive receipt details
   */
  router.get('/receipts/:receiptId', async (req: Request, res: Response) => {
    try {
      const { receiptId } = req.params;

      const receiptResult = await database.query(
        `
        SELECT r.*, m.title, m.producer_id
        FROM overlay_receipts r
        LEFT JOIN manifests m ON r.version_id = m.version_id
        WHERE r.receipt_id = $1
      `,
        [receiptId],
      );

      if (receiptResult.rows.length === 0) {
        return json(res, 404, { error: 'receipt-not-found' });
      }

      const receipt = receiptResult.rows[0];

      // Get payment transaction details if available
      let paymentTransaction = null;
      if (receipt.payment_txid) {
        const txStatus = await bsvProcessor.getTransactionStatus(receipt.payment_txid);
        if (txStatus) {
          paymentTransaction = {
            txid: txStatus.txid,
            vout: receipt.payment_vout || 0,
            requiredConfirmations: parseInt(process.env.BSV_MIN_CONFIRMATIONS || '6'),
            currentConfirmations: txStatus.confirmations,
          };
        }
      }

      // Get payment event history
      const eventHistory = await brcIntegration.notifications.getPaymentEventHistory(receiptId);

      const response = {
        receiptId: receipt.receipt_id,
        versionId: receipt.version_id,
        contentHash: receipt.content_hash,
        title: receipt.title,
        paymentDetails: {
          quantity: receipt.quantity,
          unitPriceSatoshis: receipt.unit_price_satoshis,
          totalSatoshis: receipt.total_satoshis,
          pricingTier: receipt.pricing_tier,
          currency: receipt.currency_code,
        },
        paymentTransaction,
        identity: receipt.payer_identity_key
          ? {
              identityKey: receipt.payer_identity_key,
              verificationLevel: 'verified', // Would get from payment_identities table
              trustScore: 0.85, // Would get from payment_identities table
            }
          : null,
        usage: {
          downloadAllowance: receipt.download_allowance,
          downloadsUsed: receipt.downloads_used,
          bytesAllowance: receipt.bytes_allowance,
          bytesUsed: receipt.bytes_used,
          expiresAt: receipt.expires_at,
        },
        revenueAllocation: {
          producerShareSatoshis: receipt.producer_share_satoshis,
          platformFeeSatoshis: receipt.platform_fee_satoshis,
          agentCommissionSatoshis: receipt.agent_commission_satoshis,
        },
        overlayNetwork: {
          topics: receipt.overlay_topics || [],
          settlementNetwork: receipt.settlement_network,
          notificationSent: true,
        },
        status: receipt.status,
        createdAt: receipt.created_at,
        confirmedAt: receipt.confirmed_at,
        consumedAt: receipt.consumed_at,
        expiresAt: receipt.expires_at,
        eventHistory,
      };

      return json(res, 200, response);
    } catch (error) {
      console.error('Receipt retrieval error:', error);
      return json(res, 500, { error: 'receipt-retrieval-failed', message: error.message });
    }
  });

  /**
   * POST /verify - Payment verification and confirmation
   */
  router.post('/verify', async (req: Request, res: Response) => {
    try {
      const { receiptId, rawTx, spvProof } = req.body;

      if (!receiptId || !rawTx) {
        return json(res, 400, {
          error: 'missing-required-fields',
          hint: 'receiptId and rawTx required',
        });
      }

      // Get receipt
      const receiptResult = await database.query(
        'SELECT * FROM overlay_receipts WHERE receipt_id = $1',
        [receiptId],
      );

      if (receiptResult.rows.length === 0) {
        return json(res, 404, { error: 'receipt-not-found' });
      }

      const receipt = receiptResult.rows[0];

      if (receipt.status !== 'pending') {
        return json(res, 409, {
          error: 'receipt-already-processed',
          currentStatus: receipt.status,
        });
      }

      // Process BSV payment
      const paymentResult = await bsvProcessor.processPayment(
        rawTx,
        receipt.total_satoshis,
        '76a914' + '00'.repeat(20) + '88ac', // Mock producer script
      );

      if (!paymentResult.isValid) {
        return json(res, 400, {
          error: 'payment-verification-failed',
          reason: paymentResult.reason,
        });
      }

      // Verify SPV proof if provided
      if (spvProof) {
        const spvValid = await bsvProcessor.verifySPVProof(paymentResult.txid, spvProof);
        if (!spvValid) {
          return json(res, 400, { error: 'spv-verification-failed' });
        }
      }

      // Update receipt status
      await database.query(
        `
        UPDATE overlay_receipts
        SET payment_txid = $2, payment_vout = $3, confirmation_height = $4,
            status = $5, confirmed_at = NOW(), updated_at = NOW()
        WHERE receipt_id = $1
      `,
        [receiptId, paymentResult.txid, 0, paymentResult.confirmations, 'confirmed'],
      );

      // Broadcast payment confirmed event
      await brcIntegration.notifications.broadcastPaymentEvent({
        eventType: 'payment-confirmed',
        receiptId,
        paymentTxid: paymentResult.txid,
        agentId: receipt.agent_id,
        topics: ['payments', 'settlements'],
        timestamp: new Date(),
        details: {
          confirmations: paymentResult.confirmations,
          totalAmount: paymentResult.totalAmount,
          spvVerified: !!spvProof,
        },
      });

      // Update identity trust score if applicable
      if (receipt.payer_identity_key) {
        await brcIntegration.identity.updateTrustScore(
          receipt.payer_identity_key,
          true,
          receipt.total_satoshis,
        );
      }

      return json(res, 200, {
        status: 'verified',
        txid: paymentResult.txid,
        confirmations: paymentResult.confirmations,
        totalAmount: paymentResult.totalAmount,
        spvVerified: !!spvProof,
        brcNotificationSent: true,
      });
    } catch (error) {
      console.error('Payment verification error:', error);
      return json(res, 500, { error: 'payment-verification-failed', message: error.message });
    }
  });

  /**
   * POST /brc31/verify - BRC-31 identity verification
   */
  router.post('/brc31/verify', async (req: Request, res: Response) => {
    try {
      const { identityKey, certificate } = req.body;

      if (!identityKey) {
        return json(res, 400, { error: 'identity-key-required' });
      }

      const verification = await brcIntegration.identity.verifyIdentity(identityKey, certificate);

      return json(res, 200, {
        success: verification.success,
        identity: verification.identity,
        trustScore: verification.trustScore,
        reason: verification.reason,
      });
    } catch (error) {
      console.error('BRC-31 verification error:', error);
      return json(res, 500, { error: 'identity-verification-failed', message: error.message });
    }
  });

  /**
   * POST /brc22/notify - BRC-22 payment notifications
   */
  router.post('/brc22/notify', async (req: Request, res: Response) => {
    try {
      const { eventType, receiptId, paymentTxid, agentId, topics = [], details = {} } = req.body;

      if (!eventType || !receiptId) {
        return json(res, 400, { error: 'event-type-and-receipt-id-required' });
      }

      await brcIntegration.notifications.broadcastPaymentEvent({
        eventType,
        receiptId,
        paymentTxid,
        agentId,
        topics,
        timestamp: new Date(),
        details,
      });

      return json(res, 200, { status: 'notification-sent', topics });
    } catch (error) {
      console.error('BRC-22 notification error:', error);
      return json(res, 500, { error: 'notification-failed', message: error.message });
    }
  });

  return router;
}
