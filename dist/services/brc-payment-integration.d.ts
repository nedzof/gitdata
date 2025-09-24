/**
 * D06 - BRC Standards Integration for Payment Processing
 * Implements BRC-22 payment notifications and BRC-31 identity verification for payments
 */
import { EventEmitter } from 'events';
import type { Pool } from 'pg';
export interface BRC22PaymentEvent {
    eventType: 'payment-created' | 'payment-confirmed' | 'payment-consumed' | 'payment-refunded';
    receiptId: string;
    paymentTxid?: string;
    agentId?: string;
    topics: string[];
    timestamp: Date;
    details: Record<string, any>;
}
export interface BRC31Identity {
    identityKey: string;
    certificate?: string;
    verificationLevel: 'basic' | 'verified' | 'premium';
    trustScore: number;
    isValid: boolean;
}
export interface BRC31VerificationResult {
    success: boolean;
    identity?: BRC31Identity;
    reason?: string;
    trustScore: number;
}
export declare class BRC22PaymentNotificationService extends EventEmitter {
    private database;
    private overlayTopics;
    constructor(database: Pool, overlayTopics?: string[]);
    /**
     * Broadcast payment event across BRC-22 overlay network
     */
    broadcastPaymentEvent(event: BRC22PaymentEvent): Promise<void>;
    /**
     * Broadcast payment event to specific overlay topic
     */
    private broadcastToTopic;
    /**
     * Subscribe to payment events for specific topics
     */
    subscribeToTopic(topic: string, handler: (event: BRC22PaymentEvent) => void): void;
    /**
     * Get payment event history for a receipt
     */
    getPaymentEventHistory(receiptId: string): Promise<BRC22PaymentEvent[]>;
}
export declare class BRC31IdentityVerificationService {
    private database;
    private minTrustScore;
    constructor(database: Pool, minTrustScore?: number);
    /**
     * Verify BRC-31 identity for payment authorization
     */
    verifyIdentity(identityKey: string, certificate?: string): Promise<BRC31VerificationResult>;
    /**
     * Create new identity record
     */
    private createNewIdentity;
    /**
     * Validate BRC-31 certificate chain
     */
    private validateCertificate;
    /**
     * Update identity trust score based on payment behavior
     */
    updateTrustScore(identityKey: string, paymentSuccessful: boolean, paymentAmount: number): Promise<void>;
    /**
     * Get identity payment statistics
     */
    getIdentityStats(identityKey: string): Promise<any>;
}
export declare class BRCPaymentIntegrationService {
    private brc22Service;
    private brc31Service;
    constructor(database: Pool, config?: {
        overlayTopics?: string[];
        minTrustScore?: number;
    });
    get notifications(): BRC22PaymentNotificationService;
    get identity(): BRC31IdentityVerificationService;
    /**
     * Process payment with full BRC integration
     */
    processPaymentWithBRCIntegration(params: {
        receiptId: string;
        identityKey?: string;
        certificate?: string;
        paymentTxid?: string;
        agentId?: string;
        eventType: BRC22PaymentEvent['eventType'];
        details: Record<string, any>;
    }): Promise<{
        success: boolean;
        identityVerified: boolean;
        trustScore: number;
        reason?: string;
    }>;
}
export declare function ensureBRC22Tables(database: Pool): Promise<void>;
