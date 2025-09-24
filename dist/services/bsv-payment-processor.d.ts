/**
 * D06 - BSV Payment Processing Service
 * Handles BSV native payments, SPV verification, and transaction management
 */
import { EventEmitter } from 'events';
export interface BSVTransaction {
    txid: string;
    rawTx: string;
    inputs: BSVInput[];
    outputs: BSVOutput[];
    blockHash?: string;
    blockHeight?: number;
    confirmations: number;
}
export interface BSVInput {
    txid: string;
    vout: number;
    scriptSig: string;
    satoshis: number;
}
export interface BSVOutput {
    vout: number;
    scriptPubKey: string;
    satoshis: number;
}
export interface PaymentVerificationResult {
    isValid: boolean;
    txid: string;
    confirmations: number;
    outputs: BSVOutput[];
    totalAmount: number;
    reason?: string;
}
export interface SPVProof {
    merkleProof: string;
    blockHeader: string;
    blockHeight: number;
    txIndex: number;
}
export declare class BSVPaymentProcessor extends EventEmitter {
    private database;
    private minConfirmations;
    private network;
    constructor(config?: {
        minConfirmations?: number;
        network?: string;
    });
    /**
     * Process and verify a BSV payment transaction
     */
    processPayment(rawTx: string, expectedAmount: number, payoutScript: string): Promise<PaymentVerificationResult>;
    /**
     * Parse raw transaction hex into structured format
     */
    private parseTransaction;
    /**
     * Store transaction in the database
     */
    private storeTransaction;
    /**
     * Verify payment against expected criteria
     */
    private verifyPayment;
    /**
     * Verify SPV proof for a transaction
     */
    verifySPVProof(txid: string, proof: SPVProof): Promise<boolean>;
    /**
     * Update transaction confirmation count
     */
    updateConfirmations(txid: string, confirmations: number, blockHeight?: number): Promise<void>;
    /**
     * Get transaction status and details
     */
    getTransactionStatus(txid: string): Promise<BSVTransaction | null>;
    /**
     * Create payment outputs for a specific amount and recipient
     */
    createPaymentOutputs(totalAmount: number, producerScript: string, platformFeePercentage?: number, agentCommissionPercentage?: number): BSVOutput[];
    /**
     * Monitor blockchain for transaction confirmations
     */
    startConfirmationMonitoring(): Promise<void>;
    /**
     * Get payment statistics
     */
    getPaymentStatistics(timeframe?: 'day' | 'week' | 'month'): Promise<any>;
}
