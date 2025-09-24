/**
 * BRC-41 PacketPay HTTP Payment Service Implementation
 *
 * This service implements the complete BRC-41 PacketPay mechanism for
 * HTTP micropayments using BRC-29 payments and BRC-31 authentication.
 */
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
import type { BRC41PaymentRequest, BRC41PaymentVerification, BRC29Payment, PaymentRecord, PaymentAnalytics, UsageMetrics, ServicePricing, BRC41PaymentService } from './types';
export declare class BRC41PaymentServiceImpl implements BRC41PaymentService {
    private database;
    private serverPrivateKey;
    private serverPublicKey;
    private initialized;
    constructor(database: DatabaseAdapter, serverPrivateKey?: string);
    initialize(): Promise<void>;
    createPaymentRequest(params: {
        service: string;
        satoshis: number;
        description: string;
        identityKey?: string;
        metadata?: Record<string, any>;
    }): Promise<BRC41PaymentRequest>;
    processPayment(payment: BRC29Payment, paymentId: string): Promise<BRC41PaymentVerification>;
    verifyPayment(paymentId: string, transactionId: string): Promise<BRC41PaymentVerification>;
    calculateFee(service: string, usage: UsageMetrics, identityLevel?: string): number;
    getPaymentRecord(paymentId: string): Promise<PaymentRecord | null>;
    getPaymentAnalytics(timeRange?: {
        start: Date;
        end: Date;
    }): Promise<PaymentAnalytics>;
    updateServicePricing(service: string, pricing: ServicePricing): Promise<void>;
    getServicePricing(service: string): Promise<ServicePricing | null>;
    private ensureInitialized;
    private generatePaymentId;
    private getServicePricingSync;
    private verifyBRC29Payment;
    private verifySPVProof;
    private storePaymentRecord;
    private updatePaymentRecord;
    private updatePaymentStatus;
    private camelToSnake;
    private createDatabaseTables;
}
