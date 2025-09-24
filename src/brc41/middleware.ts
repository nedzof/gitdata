/**
 * BRC-41 PacketPay Middleware for Express
 *
 * Implements payment walls and micropayment requirements for API endpoints
 * using the BRC-41 PacketPay HTTP payment mechanism.
 */

import type { Request, Response, NextFunction } from 'express';

import { getBRC31Identity, isBRC31Request, type BRC31Request } from '../brc31/middleware';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';

import { BRC41PaymentServiceImpl } from './service';
import type {
  BRC41Headers,
  BRC29Payment,
  UsageMetrics,
  ServicePricing,
  ServiceType,
  BRC41PaymentRequest,
} from './types';
import {
  BRC41Error,
  BRC41PaymentRequiredError,
  BRC41PaymentInvalidError,
  BRC41PaymentExpiredError,
  SERVICE_TYPES,
  DEFAULT_SERVICE_PRICING,
} from './types';

// ==================== Extended Request Interface ====================

export interface BRC41Request extends BRC31Request {
  brc41Payment?: {
    verified: boolean;
    satoshisPaid: number;
    paymentId: string;
    transactionId: string;
    senderIdentityKey: string;
  };
  brc41UsageMetrics?: UsageMetrics;
}

// ==================== Middleware Configuration ====================

interface BRC41MiddlewareConfig {
  database: DatabaseAdapter;
  serverPrivateKey?: string;
  enabled: boolean;
  defaultPricing: ServicePricing;
  freeIdentityLevels: string[];
  requirePaymentForAll: boolean;
}

const DEFAULT_CONFIG: Partial<BRC41MiddlewareConfig> = {
  enabled: true,
  defaultPricing: DEFAULT_SERVICE_PRICING,
  freeIdentityLevels: ['certified'], // Certified identities get free access
  requirePaymentForAll: false,
};

// ==================== Main Middleware Class ====================

export class BRC41PaymentMiddleware {
  private paymentService: BRC41PaymentServiceImpl;
  private config: BRC41MiddlewareConfig;
  private initialized = false;

  constructor(config: Partial<BRC41MiddlewareConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as BRC41MiddlewareConfig;

    if (!this.config.database) {
      throw new Error('Database adapter is required for BRC-41 middleware');
    }

    this.paymentService = new BRC41PaymentServiceImpl(
      this.config.database,
      this.config.serverPrivateKey,
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.paymentService.initialize();
    this.initialized = true;
  }

  // ==================== Payment Wall Middleware ====================

  /**
   * Creates middleware that requires payment for access
   */
  requirePayment(
    service: ServiceType,
    options: {
      pricing?: ServicePricing;
      calculateUsage?: (req: BRC41Request) => UsageMetrics;
      description?: string;
      allowFreeForIdentity?: boolean;
    } = {},
  ): (req: BRC41Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: BRC41Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      await this.ensureInitialized();

      try {
        // Check if identity gets free access
        if (options.allowFreeForIdentity !== false && this.hasFreeTierAccess(req)) {
          console.info(`[BRC-41] Free tier access granted for ${service}`);
          return next();
        }

        // Calculate usage metrics and pricing
        const usageMetrics = options.calculateUsage
          ? options.calculateUsage(req)
          : this.getDefaultUsageMetrics(req);
        const identityLevel = getBRC31Identity(req)?.level;
        const satoshisRequired = this.paymentService.calculateFee(
          service,
          usageMetrics,
          identityLevel,
        );

        // Check for existing payment
        const paymentHeaders = this.extractPaymentHeaders(req);

        if (paymentHeaders['x-bsv-payment']) {
          // Process existing payment
          return await this.processExistingPayment(
            req,
            res,
            next,
            service,
            satoshisRequired,
            paymentHeaders,
          );
        } else {
          // Require new payment
          return await this.requireNewPayment(
            req,
            res,
            service,
            satoshisRequired,
            options.description,
          );
        }
      } catch (error) {
        console.error('[BRC-41] Payment middleware error:', error);
        return this.handlePaymentError(res, error);
      }
    };
  }

  /**
   * Creates middleware that tracks usage but doesn't require payment
   */
  trackUsage(
    service: ServiceType,
    calculateUsage?: (req: BRC41Request) => UsageMetrics,
  ): (req: BRC41Request, res: Response, next: NextFunction) => void {
    return (req: BRC41Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      // Attach usage metrics to request for analytics
      req.brc41UsageMetrics = calculateUsage
        ? calculateUsage(req)
        : this.getDefaultUsageMetrics(req);

      // Continue without payment requirement
      next();
    };
  }

  // ==================== Payment Processing ====================

  private async processExistingPayment(
    req: BRC41Request,
    res: Response,
    next: NextFunction,
    service: ServiceType,
    satoshisRequired: number,
    paymentHeaders: Partial<BRC41Headers>,
  ): Promise<void> {
    try {
      // Parse BRC-29 payment from header
      const paymentJson = paymentHeaders['x-bsv-payment'];
      if (!paymentJson) {
        throw new BRC41PaymentInvalidError('Missing payment data', 'missing_payment');
      }

      const payment: BRC29Payment = JSON.parse(paymentJson);

      // Create or find payment request
      const identityKey = getBRC31Identity(req)?.publicKey || 'anonymous';
      const paymentRequest = await this.paymentService.createPaymentRequest({
        service,
        satoshis: satoshisRequired,
        description: `${service} access`,
        identityKey,
      });

      // Process the payment
      const verification = await this.paymentService.processPayment(
        payment,
        paymentRequest.paymentId,
      );

      if (!verification.valid) {
        throw new BRC41PaymentInvalidError(
          verification.reason || 'Payment verification failed',
          'verification_failed',
        );
      }

      // Attach payment info to request
      req.brc41Payment = {
        verified: verification.verified,
        satoshisPaid: verification.satoshisPaid,
        paymentId: paymentRequest.paymentId,
        transactionId: verification.transactionId,
        senderIdentityKey: verification.senderIdentityKey,
      };

      // Add payment confirmation header to response
      res.setHeader('x-bsv-payment-satoshis-paid', verification.satoshisPaid.toString());

      console.info(
        `[BRC-41] Payment verified: ${verification.satoshisPaid} satoshis for ${service}`,
      );
      return next();
    } catch (error) {
      if (error instanceof BRC41Error) {
        throw error;
      }
      throw new BRC41PaymentInvalidError('Payment processing failed', 'processing_error');
    }
  }

  private async requireNewPayment(
    req: BRC41Request,
    res: Response,
    service: ServiceType,
    satoshisRequired: number,
    description?: string,
  ): Promise<void> {
    const identityKey = getBRC31Identity(req)?.publicKey || 'anonymous';

    const paymentRequest = await this.paymentService.createPaymentRequest({
      service,
      satoshis: satoshisRequired,
      description: description || `Payment required for ${service}`,
      identityKey,
    });

    // Set payment required headers
    res.setHeader('x-bsv-payment-satoshis-required', satoshisRequired.toString());

    throw new BRC41PaymentRequiredError(paymentRequest);
  }

  // ==================== Service-Specific Middleware Factories ====================

  /**
   * Payment middleware for BRC-24 lookup services
   */
  brc24LookupPayment() {
    return this.requirePayment(SERVICE_TYPES.BRC24_LOOKUP, {
      calculateUsage: (req) => ({
        complexity: 1.0,
        dataSize: this.estimateRequestSize(req),
        computeTime: 100, // 100ms estimated
        cacheable: true,
        priority: 'normal',
      }),
      description: 'BRC-24 Agent Lookup',
    });
  }

  /**
   * Payment middleware for BRC-24 query services
   */
  brc24QueryPayment() {
    return this.requirePayment(SERVICE_TYPES.BRC24_QUERY, {
      calculateUsage: (req) => ({
        complexity: 1.5,
        dataSize: this.estimateRequestSize(req),
        computeTime: 250, // 250ms estimated for queries
        cacheable: false,
        priority: this.extractPriority(req),
      }),
      description: 'BRC-24 Agent Query',
    });
  }

  /**
   * Payment middleware for data search services
   */
  dataSearchPayment() {
    return this.requirePayment(SERVICE_TYPES.DATA_SEARCH, {
      calculateUsage: (req) => {
        const query = (req.query.q as string) || '';
        const limit = parseInt((req.query.limit as string) || '10');

        return {
          complexity: Math.max(1.0, query.length / 100),
          dataSize: limit * 1000, // Estimated 1KB per result
          computeTime: 500 + limit * 10,
          cacheable: true,
          priority: this.extractPriority(req),
        };
      },
      description: 'Data Search Service',
    });
  }

  /**
   * Payment middleware for analytics services
   */
  analyticsPayment() {
    return this.requirePayment(SERVICE_TYPES.ANALYTICS, {
      calculateUsage: (req) => ({
        complexity: 2.0,
        dataSize: this.estimateRequestSize(req),
        computeTime: 1000, // 1s for analytics
        cacheable: false,
        priority: 'low',
      }),
      description: 'Analytics Service',
      allowFreeForIdentity: false, // Analytics always requires payment
    });
  }

  // ==================== Helper Methods ====================

  private hasFreeTierAccess(req: BRC41Request): boolean {
    if (!isBRC31Request(req)) return false;

    const identity = getBRC31Identity(req);
    return identity && this.config.freeIdentityLevels.includes(identity.level);
  }

  private extractPaymentHeaders(req: Request): Partial<BRC41Headers> {
    return {
      'x-bsv-payment-satoshis-required': req.headers['x-bsv-payment-satoshis-required'] as string,
      'x-bsv-payment': req.headers['x-bsv-payment'] as string,
      'x-bsv-payment-satoshis-paid': req.headers['x-bsv-payment-satoshis-paid'] as string,
    };
  }

  private getDefaultUsageMetrics(req: BRC41Request): UsageMetrics {
    return {
      complexity: 1.0,
      dataSize: this.estimateRequestSize(req),
      computeTime: 100,
      cacheable: req.method === 'GET',
      priority: 'normal',
    };
  }

  private estimateRequestSize(req: Request): number {
    let size = req.url.length;

    if (req.body) {
      size += JSON.stringify(req.body).length;
    }

    return size;
  }

  private extractPriority(req: Request): 'low' | 'normal' | 'high' {
    const priority = req.headers['x-priority'] as string;
    if (priority === 'high' || priority === 'low') {
      return priority;
    }
    return 'normal';
  }

  private handlePaymentError(res: Response, error: any): Response {
    if (error instanceof BRC41PaymentRequiredError) {
      return res.status(402).json({
        error: 'payment-required',
        message: 'Payment required to access this resource',
        paymentRequest: error.paymentRequest,
        brc41: {
          version: '1.0',
          supported: true,
        },
      });
    }

    if (error instanceof BRC41Error) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
        brc41: {
          version: '1.0',
          supported: true,
        },
      });
    }

    console.error('[BRC-41] Unexpected payment error:', error);
    return res.status(500).json({
      error: 'brc41-internal-error',
      message: 'Internal payment processing error',
      brc41: {
        version: '1.0',
        supported: true,
      },
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ==================== Analytics and Management ====================

  async getPaymentStats(): Promise<any> {
    await this.ensureInitialized();
    return await this.paymentService.getPaymentAnalytics();
  }

  async updateServicePricing(service: string, pricing: ServicePricing): Promise<void> {
    await this.ensureInitialized();
    return await this.paymentService.updateServicePricing(service, pricing);
  }
}

// ==================== Factory Functions ====================

let globalBRC41Middleware: BRC41PaymentMiddleware | null = null;

/**
 * Initialize the global BRC-41 payment middleware
 */
export function initializeBRC41PaymentMiddleware(
  config: Partial<BRC41MiddlewareConfig>,
): BRC41PaymentMiddleware {
  globalBRC41Middleware = new BRC41PaymentMiddleware(config);
  return globalBRC41Middleware;
}

/**
 * Get the global BRC-41 payment middleware
 */
export function getBRC41PaymentMiddleware(): BRC41PaymentMiddleware {
  if (!globalBRC41Middleware) {
    throw new Error(
      'BRC-41 payment middleware not initialized. Call initializeBRC41PaymentMiddleware() first.',
    );
  }
  return globalBRC41Middleware;
}

// ==================== Convenience Middleware Functions ====================

/**
 * Require payment for BRC-24 lookup services
 */
export function requireBRC24LookupPayment() {
  return (req: BRC41Request, res: Response, next: NextFunction) => {
    const middleware = getBRC41PaymentMiddleware();
    return middleware.brc24LookupPayment()(req, res, next);
  };
}

/**
 * Require payment for BRC-24 query services
 */
export function requireBRC24QueryPayment() {
  return (req: BRC41Request, res: Response, next: NextFunction) => {
    const middleware = getBRC41PaymentMiddleware();
    return middleware.brc24QueryPayment()(req, res, next);
  };
}

/**
 * Require payment for data search services
 */
export function requireDataSearchPayment() {
  return (req: BRC41Request, res: Response, next: NextFunction) => {
    const middleware = getBRC41PaymentMiddleware();
    return middleware.dataSearchPayment()(req, res, next);
  };
}

/**
 * Track usage for analytics services
 */
export function trackAnalyticsUsage() {
  return (req: BRC41Request, res: Response, next: NextFunction) => {
    const middleware = getBRC41PaymentMiddleware();
    return middleware.trackUsage(SERVICE_TYPES.ANALYTICS)(req, res, next);
  };
}
