/**
 * BRC-41 PacketPay Middleware for Express
 *
 * Implements payment walls and micropayment requirements for API endpoints
 * using the BRC-41 PacketPay HTTP payment mechanism.
 */
import type { Response, NextFunction } from 'express';
import { type BRC31Request } from '../brc31/middleware';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
import type { UsageMetrics, ServicePricing, ServiceType } from './types';
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
interface BRC41MiddlewareConfig {
    database: DatabaseAdapter;
    serverPrivateKey?: string;
    enabled: boolean;
    defaultPricing: ServicePricing;
    freeIdentityLevels: string[];
    requirePaymentForAll: boolean;
}
export declare class BRC41PaymentMiddleware {
    private paymentService;
    private config;
    private initialized;
    constructor(config: Partial<BRC41MiddlewareConfig>);
    initialize(): Promise<void>;
    /**
     * Creates middleware that requires payment for access
     */
    requirePayment(service: ServiceType, options?: {
        pricing?: ServicePricing;
        calculateUsage?: (req: BRC41Request) => UsageMetrics;
        description?: string;
        allowFreeForIdentity?: boolean;
    }): (req: BRC41Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Creates middleware that tracks usage but doesn't require payment
     */
    trackUsage(service: ServiceType, calculateUsage?: (req: BRC41Request) => UsageMetrics): (req: BRC41Request, res: Response, next: NextFunction) => void;
    private processExistingPayment;
    private requireNewPayment;
    /**
     * Payment middleware for BRC-24 lookup services
     */
    brc24LookupPayment(): (req: BRC41Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Payment middleware for BRC-24 query services
     */
    brc24QueryPayment(): (req: BRC41Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Payment middleware for data search services
     */
    dataSearchPayment(): (req: BRC41Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Payment middleware for analytics services
     */
    analyticsPayment(): (req: BRC41Request, res: Response, next: NextFunction) => Promise<void>;
    private hasFreeTierAccess;
    private extractPaymentHeaders;
    private getDefaultUsageMetrics;
    private estimateRequestSize;
    private extractPriority;
    private handlePaymentError;
    private ensureInitialized;
    getPaymentStats(): Promise<any>;
    updateServicePricing(service: string, pricing: ServicePricing): Promise<void>;
}
/**
 * Initialize the global BRC-41 payment middleware
 */
export declare function initializeBRC41PaymentMiddleware(config: Partial<BRC41MiddlewareConfig>): BRC41PaymentMiddleware;
/**
 * Get the global BRC-41 payment middleware
 */
export declare function getBRC41PaymentMiddleware(): BRC41PaymentMiddleware;
/**
 * Require payment for BRC-24 lookup services
 */
export declare function requireBRC24LookupPayment(): (req: BRC41Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Require payment for BRC-24 query services
 */
export declare function requireBRC24QueryPayment(): (req: BRC41Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Require payment for data search services
 */
export declare function requireDataSearchPayment(): (req: BRC41Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Track usage for analytics services
 */
export declare function trackAnalyticsUsage(): (req: BRC41Request, res: Response, next: NextFunction) => void;
export {};
