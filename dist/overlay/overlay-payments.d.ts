import { EventEmitter } from 'events';
import type { DatabaseAdapter } from './brc26-uhrp';
import type { OverlayManager } from './overlay-manager';
export interface PaymentQuote {
    quoteId: string;
    receiptId: string;
    versionId: string;
    amountSat: number;
    outputs: Array<{
        scriptHex: string;
        satoshis: number;
        description: string;
    }>;
    expiresAt: number;
    templateHash: string;
    createdAt: number;
}
export interface PaymentRequest {
    receiptId: string;
    versionId: string;
    quantity: number;
    buyerPublicKey: string;
    timestamp: number;
}
export interface PaymentReceipt {
    receiptId: string;
    txid: string;
    status: 'pending' | 'confirmed' | 'failed';
    amountSat: number;
    createdAt: number;
    confirmedAt?: number;
}
declare class OverlayPaymentService extends EventEmitter {
    private overlayManager;
    private database;
    private pendingQuotes;
    private pendingPayments;
    constructor(overlayManager: OverlayManager, database: DatabaseAdapter);
    /**
     * Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
     * This method is kept for compatibility but no longer creates tables
     */
    private setupDatabase;
    /**
     * Set up event handlers for overlay payment messages
     */
    private setupEventHandlers;
    /**
     * Create a payment quote for overlay transmission
     */
    createPaymentQuote(request: PaymentRequest): Promise<PaymentQuote>;
    /**
     * Process payment submission from overlay
     */
    processPaymentSubmission(submission: {
        quoteId: string;
        rawTxHex: string;
        buyerPublicKey: string;
    }): Promise<PaymentReceipt>;
    /**
     * Request payment quote from overlay network
     */
    requestPaymentQuote(versionId: string, quantity?: number): Promise<void>;
    /**
     * Submit payment to overlay network
     */
    submitPayment(quoteId: string): Promise<PaymentReceipt>;
    /**
     * Handle incoming payment messages from overlay
     */
    private handlePaymentMessage;
    /**
     * Handle payment request from buyer
     */
    private handlePaymentRequestMessage;
    /**
     * Handle payment quote from seller
     */
    private handlePaymentQuoteMessage;
    /**
     * Handle payment submission from buyer
     */
    private handlePaymentSubmissionMessage;
    /**
     * Handle payment receipt from seller
     */
    private handlePaymentReceiptMessage;
    /**
     * Publish payment quote to overlay
     */
    private publishPaymentQuote;
    /**
     * Publish payment receipt to overlay
     */
    private publishPaymentReceipt;
    /**
     * Handle payment request from overlay
     */
    private handlePaymentRequest;
    /**
     * Get payment script for producer
     */
    private getPaymentScript;
    /**
     * Get overlay platform fee script
     */
    private getOverlayFeeScript;
    /**
     * Validate and broadcast transaction
     */
    private validateAndBroadcastTransaction;
    /**
     * Get quote from database
     */
    private getQuoteFromDatabase;
    /**
     * Generate unique quote ID
     */
    private generateQuoteId;
    /**
     * Generate unique receipt ID
     */
    private generateReceiptId;
    /**
     * Generate template hash for quote consistency
     */
    private generateTemplateHash;
    /**
     * Generate mock transaction ID
     */
    private generateTxid;
    /**
     * Get payment statistics
     */
    getPaymentStats(): Promise<{
        quotes: {
            total: number;
            active: number;
            expired: number;
        };
        receipts: {
            total: number;
            pending: number;
            confirmed: number;
        };
    }>;
    /**
     * Clean up expired quotes
     */
    cleanupExpiredQuotes(): Promise<number>;
}
export { OverlayPaymentService };
