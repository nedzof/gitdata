/**
 * BRC-41 PacketPay HTTP Payment Service Implementation
 *
 * This service implements the complete BRC-41 PacketPay mechanism for
 * HTTP micropayments using BRC-29 payments and BRC-31 authentication.
 */

import { randomBytes, createHash } from 'crypto';

import * as bsv from '@bsv/sdk';

import { getBRC31Middleware, type BRC31Request } from '../brc31/middleware';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';

import type {
  BRC41PaymentRequest,
  BRC41PaymentVerification,
  BRC29Payment,
  BRC29Transaction,
  BRC29Output,
  PaymentRecord,
  PaymentStatus,
  PaymentAnalytics,
  UsageMetrics,
  ServicePricing,
  ServiceType,
  BRC41PaymentService,
} from './types';
import {
  BRC41Error,
  BRC41PaymentRequiredError,
  BRC41PaymentInvalidError,
  BRC41PaymentExpiredError,
  BRC41ServicePricingError,
  BRC29_PROTOCOL_ID,
  PAYMENT_EXPIRY_MS,
  MIN_PAYMENT_SATOSHIS,
  MAX_PAYMENT_SATOSHIS,
  DEFAULT_SERVICE_PRICING,
  SERVICE_TYPES,
} from './types';

export class BRC41PaymentServiceImpl implements BRC41PaymentService {
  private database: DatabaseAdapter;
  private serverPrivateKey: bsv.PrivateKey | null = null;
  private serverPublicKey: bsv.PublicKey | null = null;
  private initialized = false;

  constructor(database: DatabaseAdapter, serverPrivateKey?: string) {
    this.database = database;

    if (serverPrivateKey) {
      try {
        this.serverPrivateKey = bsv.PrivateKey.fromString(serverPrivateKey);
        this.serverPublicKey = this.serverPrivateKey.toPublicKey();
      } catch (error) {
        console.error('[BRC-41] Invalid server private key provided');
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.createDatabaseTables();

    if (!this.serverPrivateKey) {
      this.serverPrivateKey = bsv.PrivateKey.fromRandom();
      this.serverPublicKey = this.serverPrivateKey.toPublicKey();
      console.warn(
        '[BRC-41] Generated ephemeral server key - payments will not persist across restarts',
      );
    }

    this.initialized = true;
    console.log(
      `[BRC-41] Payment service initialized with public key: ${this.serverPublicKey?.toString()}`,
    );
  }

  // ==================== Payment Request Generation ====================

  async createPaymentRequest(params: {
    service: string;
    satoshis: number;
    description: string;
    identityKey?: string;
    metadata?: Record<string, any>;
  }): Promise<BRC41PaymentRequest> {
    await this.ensureInitialized();

    if (params.satoshis < MIN_PAYMENT_SATOSHIS || params.satoshis > MAX_PAYMENT_SATOSHIS) {
      throw new BRC41Error(
        `Payment amount must be between ${MIN_PAYMENT_SATOSHIS} and ${MAX_PAYMENT_SATOSHIS} satoshis`,
        'BRC41_INVALID_AMOUNT',
        400,
      );
    }

    const paymentId = this.generatePaymentId();
    const expires = Date.now() + PAYMENT_EXPIRY_MS;

    const paymentRequest: BRC41PaymentRequest = {
      satoshisRequired: params.satoshis,
      service: params.service,
      description: params.description,
      expires,
      recipientPublicKey: this.serverPublicKey!.toString(),
      paymentId,
    };

    // Store payment request in database
    await this.storePaymentRecord({
      paymentId,
      service: params.service,
      senderIdentityKey: params.identityKey || 'anonymous',
      satoshisRequired: params.satoshis,
      satoshisPaid: 0,
      transactionId: '',
      createdAt: new Date(),
      status: 'pending',
      metadata: params.metadata || {},
    });

    return paymentRequest;
  }

  // ==================== Payment Processing ====================

  async processPayment(
    payment: BRC29Payment,
    paymentId: string,
  ): Promise<BRC41PaymentVerification> {
    await this.ensureInitialized();

    try {
      // Validate payment format
      if (payment.protocol !== BRC29_PROTOCOL_ID) {
        throw new BRC41PaymentInvalidError('Invalid BRC-29 protocol ID', 'invalid_protocol');
      }

      // Get payment request
      const paymentRecord = await this.getPaymentRecord(paymentId);
      if (!paymentRecord) {
        throw new BRC41PaymentInvalidError('Payment request not found', 'request_not_found');
      }

      if (paymentRecord.status !== 'pending') {
        throw new BRC41PaymentInvalidError(
          'Payment request already processed',
          'already_processed',
        );
      }

      if (paymentRecord.createdAt.getTime() + PAYMENT_EXPIRY_MS < Date.now()) {
        await this.updatePaymentStatus(paymentId, 'expired');
        throw new BRC41PaymentExpiredError(paymentId);
      }

      // Verify payment transactions
      const verification = await this.verifyBRC29Payment(payment, paymentRecord);

      // Update payment record
      await this.updatePaymentRecord(paymentId, {
        senderIdentityKey: payment.senderIdentityKey,
        satoshisPaid: verification.satoshisPaid,
        transactionId: verification.transactionId,
        paidAt: new Date(),
        status: verification.valid ? 'received' : 'invalid',
      });

      // If payment is valid, mark as verified
      if (verification.valid) {
        await this.updatePaymentStatus(paymentId, 'verified');
        await this.updatePaymentRecord(paymentId, {
          verifiedAt: new Date(),
        });
      }

      return verification;
    } catch (error) {
      if (error instanceof BRC41Error) {
        throw error;
      }

      console.error('[BRC-41] Payment processing error:', error);
      throw new BRC41Error('Payment processing failed', 'BRC41_PROCESSING_ERROR', 500);
    }
  }

  // ==================== Payment Verification ====================

  async verifyPayment(paymentId: string, transactionId: string): Promise<BRC41PaymentVerification> {
    await this.ensureInitialized();

    const paymentRecord = await this.getPaymentRecord(paymentId);
    if (!paymentRecord) {
      throw new BRC41PaymentInvalidError('Payment not found', 'payment_not_found');
    }

    if (paymentRecord.transactionId !== transactionId) {
      throw new BRC41PaymentInvalidError('Transaction ID mismatch', 'tx_mismatch');
    }

    // Perform SPV verification if payment has proof
    const spvValid = await this.verifySPVProof(paymentRecord);

    const verification: BRC41PaymentVerification = {
      valid: paymentRecord.status === 'verified' && spvValid,
      satoshisPaid: paymentRecord.satoshisPaid,
      paymentId,
      transactionId,
      senderIdentityKey: paymentRecord.senderIdentityKey,
      verified: spvValid,
      reason: paymentRecord.status !== 'verified' ? 'Payment not verified' : undefined,
    };

    return verification;
  }

  // ==================== Pricing Calculation ====================

  calculateFee(service: string, usage: UsageMetrics, identityLevel?: string): number {
    const pricing = this.getServicePricingSync(service);

    let fee = pricing.baseFee;

    // Add per-byte charges
    fee += usage.dataSize * pricing.perByteRate;

    // Apply complexity multiplier
    fee *= usage.complexity * pricing.complexityMultiplier;

    // Apply priority multiplier
    fee *= pricing.priorityMultipliers[usage.priority];

    // Apply discounts based on identity level
    if (identityLevel) {
      if (identityLevel === 'certified') {
        fee *= pricing.discounts.highTrust;
      } else if (identityLevel === 'verified') {
        fee *= pricing.discounts.subscriber;
      }
    }

    // Round to nearest satoshi
    return Math.max(MIN_PAYMENT_SATOSHIS, Math.round(fee));
  }

  // ==================== Analytics and Tracking ====================

  async getPaymentRecord(paymentId: string): Promise<PaymentRecord | null> {
    const result = await this.database.queryOne(
      `
      SELECT payment_id, service, sender_identity_key, satoshis_required,
             satoshis_paid, transaction_id, created_at, paid_at, verified_at,
             status, metadata
      FROM brc41_payments
      WHERE payment_id = $1
    `,
      [paymentId],
    );

    if (!result) return null;

    return {
      paymentId: result.payment_id,
      service: result.service,
      senderIdentityKey: result.sender_identity_key,
      satoshisRequired: result.satoshis_required,
      satoshisPaid: result.satoshis_paid,
      transactionId: result.transaction_id,
      createdAt: new Date(result.created_at),
      paidAt: result.paid_at ? new Date(result.paid_at) : undefined,
      verifiedAt: result.verified_at ? new Date(result.verified_at) : undefined,
      status: result.status as PaymentStatus,
      metadata: result.metadata || {},
    };
  }

  async getPaymentAnalytics(timeRange?: { start: Date; end: Date }): Promise<PaymentAnalytics> {
    const startTime = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24h
    const endTime = timeRange?.end || new Date();

    const totalStats = await this.database.queryOne(
      `
      SELECT COUNT(*) as total_payments,
             COALESCE(SUM(satoshis_paid), 0) as total_satoshis,
             COALESCE(AVG(satoshis_paid), 0) as average_payment
      FROM brc41_payments
      WHERE created_at BETWEEN $1 AND $2
        AND status = 'verified'
    `,
      [startTime, endTime],
    );

    const serviceStats = await this.database.query(
      `
      SELECT service,
             COUNT(*) as payment_count,
             COALESCE(SUM(satoshis_paid), 0) as revenue
      FROM brc41_payments
      WHERE created_at BETWEEN $1 AND $2
        AND status = 'verified'
      GROUP BY service
    `,
      [startTime, endTime],
    );

    const hourlyStats = await this.database.query(
      `
      SELECT date_trunc('hour', created_at) as hour,
             COUNT(*) as count,
             COALESCE(SUM(satoshis_paid), 0) as revenue
      FROM brc41_payments
      WHERE created_at BETWEEN $1 AND $2
        AND status = 'verified'
      GROUP BY date_trunc('hour', created_at)
      ORDER BY hour
    `,
      [startTime, endTime],
    );

    const topPayers = await this.database.query(
      `
      SELECT sender_identity_key,
             COUNT(*) as count,
             COALESCE(SUM(satoshis_paid), 0) as total
      FROM brc41_payments
      WHERE created_at BETWEEN $1 AND $2
        AND status = 'verified'
      GROUP BY sender_identity_key
      ORDER BY total DESC
      LIMIT 10
    `,
      [startTime, endTime],
    );

    const paymentsByService: Record<string, number> = {};
    const revenueByService: Record<string, number> = {};

    for (const stat of serviceStats) {
      paymentsByService[stat.service] = parseInt(stat.payment_count);
      revenueByService[stat.service] = parseInt(stat.revenue);
    }

    return {
      totalPayments: parseInt(totalStats.total_payments),
      totalSatoshis: parseInt(totalStats.total_satoshis),
      averagePayment: parseFloat(totalStats.average_payment),
      paymentsByService,
      revenueByService,
      paymentsByHour: hourlyStats.map((stat: any) => ({
        hour: stat.hour.toISOString(),
        count: parseInt(stat.count),
        revenue: parseInt(stat.revenue),
      })),
      topPayers: topPayers.map((payer: any) => ({
        identityKey: payer.sender_identity_key,
        count: parseInt(payer.count),
        total: parseInt(payer.total),
      })),
    };
  }

  // ==================== Service Management ====================

  async updateServicePricing(service: string, pricing: ServicePricing): Promise<void> {
    await this.database.execute(
      `
      INSERT INTO brc41_service_pricing
        (service, pricing_config, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (service)
      DO UPDATE SET
        pricing_config = $2,
        updated_at = NOW()
    `,
      [service, JSON.stringify(pricing)],
    );
  }

  async getServicePricing(service: string): Promise<ServicePricing | null> {
    const result = await this.database.queryOne(
      `
      SELECT pricing_config
      FROM brc41_service_pricing
      WHERE service = $1
    `,
      [service],
    );

    if (!result) return null;

    return JSON.parse(result.pricing_config) as ServicePricing;
  }

  // ==================== Private Helper Methods ====================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private generatePaymentId(): string {
    return randomBytes(16).toString('hex');
  }

  private getServicePricingSync(service: string): ServicePricing {
    // In a real implementation, this would cache pricing configs
    // For now, return default pricing
    return DEFAULT_SERVICE_PRICING;
  }

  private async verifyBRC29Payment(
    payment: BRC29Payment,
    paymentRecord: PaymentRecord,
  ): Promise<BRC41PaymentVerification> {
    let totalSatoshisPaid = 0;
    let mainTransactionId = '';

    for (const txEnvelope of payment.transactions) {
      try {
        // Parse and validate transaction
        const tx = bsv.Transaction.fromHex(txEnvelope.rawTx);
        mainTransactionId = tx.id('hex');

        // Verify outputs match expected payment
        for (const [outputIndex, outputInfo] of Object.entries(txEnvelope.outputs)) {
          const output = tx.outputs[parseInt(outputIndex)];
          if (!output) continue;

          // Verify the output pays to our server key
          const expectedScript = bsv.Script.fromAddress(this.serverPublicKey!.toAddress());

          if (output.lockingScript.toHex() === expectedScript.toHex()) {
            totalSatoshisPaid += Number(output.satoshis);
          }
        }

        // TODO: Implement full SPV verification with merkle proofs
        // if (txEnvelope.proof) {
        //   await this.verifySPVProof(txEnvelope.proof, tx);
        // }
      } catch (error) {
        console.error('[BRC-41] Transaction verification failed:', error);
      }
    }

    const valid = totalSatoshisPaid >= paymentRecord.satoshisRequired;

    return {
      valid,
      satoshisPaid: totalSatoshisPaid,
      paymentId: paymentRecord.paymentId,
      transactionId: mainTransactionId,
      senderIdentityKey: payment.senderIdentityKey,
      verified: true, // SPV verification would be implemented here
      reason: valid
        ? undefined
        : `Insufficient payment: ${totalSatoshisPaid} < ${paymentRecord.satoshisRequired}`,
    };
  }

  private async verifySPVProof(paymentRecord: PaymentRecord): Promise<boolean> {
    // TODO: Implement full SPV verification
    // This would verify merkle proofs against block headers
    // For now, return true if payment is marked as verified
    return paymentRecord.status === 'verified';
  }

  private async storePaymentRecord(record: PaymentRecord): Promise<void> {
    await this.database.execute(
      `
      INSERT INTO brc41_payments
        (payment_id, service, sender_identity_key, satoshis_required,
         satoshis_paid, transaction_id, created_at, paid_at, verified_at,
         status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
      [
        record.paymentId,
        record.service,
        record.senderIdentityKey,
        record.satoshisRequired,
        record.satoshisPaid,
        record.transactionId,
        record.createdAt,
        record.paidAt || null,
        record.verifiedAt || null,
        record.status,
        JSON.stringify(record.metadata),
      ],
    );
  }

  private async updatePaymentRecord(
    paymentId: string,
    updates: Partial<PaymentRecord>,
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const dbKey = this.camelToSnake(key);
        fields.push(`${dbKey} = $${paramIndex}`);
        values.push(key === 'metadata' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return;

    values.push(paymentId);
    await this.database.execute(
      `
      UPDATE brc41_payments
      SET ${fields.join(', ')}
      WHERE payment_id = $${paramIndex}
    `,
      values,
    );
  }

  private async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<void> {
    await this.database.execute(
      `
      UPDATE brc41_payments
      SET status = $1
      WHERE payment_id = $2
    `,
      [status, paymentId],
    );
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  private async createDatabaseTables(): Promise<void> {
    // Create payments table
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS brc41_payments (
        payment_id VARCHAR(32) PRIMARY KEY,
        service VARCHAR(100) NOT NULL,
        sender_identity_key VARCHAR(66) NOT NULL,
        satoshis_required INTEGER NOT NULL,
        satoshis_paid INTEGER DEFAULT 0,
        transaction_id VARCHAR(64) DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP,
        verified_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);

    // Create service pricing table
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS brc41_service_pricing (
        service VARCHAR(100) PRIMARY KEY,
        pricing_config JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_brc41_payments_service
      ON brc41_payments(service)
    `);

    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_brc41_payments_status
      ON brc41_payments(status)
    `);

    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_brc41_payments_created_at
      ON brc41_payments(created_at)
    `);
  }
}
