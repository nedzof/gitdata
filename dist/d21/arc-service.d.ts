/**
 * D21 ARC Broadcasting Service
 *
 * Implements BSV transaction broadcasting using ARC from BSV SDK.
 * Provides comprehensive transaction lifecycle management with multi-provider support.
 */
import { Arc } from '@bsv/sdk';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp.js';
import type { D21ARCBroadcastService, D21ARCProvider, D21ARCBroadcastRequest, D21ARCBroadcastResult, ARCSubmitTxResponse, ARCTxStatus, ARCFeeQuote, ARCPolicyQuote } from './types.js';
export declare class D21ARCBroadcastServiceImpl implements D21ARCBroadcastService {
    private database;
    private providers;
    private arcInstances;
    private callbackBaseUrl;
    private initialized;
    constructor(database: DatabaseAdapter, callbackBaseUrl?: string);
    initialize(): Promise<void>;
    private createARCSchema;
    private initializeProviders;
    /**
     * Initialize BSV SDK ARC instance for a provider
     */
    private initializeARCInstance;
    /**
     * Broadcast transaction using BSV SDK ARC
     */
    broadcastTransaction(request: D21ARCBroadcastRequest): Promise<D21ARCBroadcastResult>;
    /**
     * Get transaction status from ARC
     */
    getTransactionStatus(txid: string, providerId?: string): Promise<ARCSubmitTxResponse>;
    /**
     * Wait for transaction to reach specific status
     */
    waitForTransactionStatus(txid: string, targetStatus: ARCTxStatus, timeout?: number): Promise<ARCSubmitTxResponse>;
    /**
     * Batch broadcast multiple transactions
     */
    batchBroadcast(requests: D21ARCBroadcastRequest[]): Promise<D21ARCBroadcastResult[]>;
    /**
     * Get all available ARC providers
     */
    getProviders(): Promise<D21ARCProvider[]>;
    /**
     * Get provider health status
     */
    getProviderHealth(providerId: string): Promise<{
        isHealthy: boolean;
        responseTime: number;
        successRate: number;
        lastChecked: Date;
        currentFeeQuote?: ARCFeeQuote;
    }>;
    /**
     * Select optimal ARC provider
     */
    selectOptimalProvider(criteria?: {
        maxLatency?: number;
        minSuccessRate?: number;
        preferredProviders?: string[];
        minFeeRate?: number;
        maxTxSize?: number;
    }): Promise<D21ARCProvider>;
    /**
     * Get policy quote from ARC provider
     */
    getPolicyQuote(providerId: string): Promise<ARCPolicyQuote>;
    /**
     * Get fee quote from ARC provider
     */
    getFeeQuote(providerId: string): Promise<ARCFeeQuote>;
    /**
     * Map ARC status to our internal status enum
     */
    private mapARCStatus;
    private getAuthHeaders;
    private storeARCTransaction;
    private updateTransactionStatus;
    private updateProviderMetrics;
    private parseARCTimestamp;
    /**
     * Handle ARC callback for merkle proofs (based on BSV SDK example)
     */
    handleARCCallback(providerId: string, callbackData: {
        txid: string;
        merklePath: string;
        blockHeight: number;
    }): Promise<void>;
    /**
     * Process merkle proof and update transaction status
     */
    private handleNewMerkleProof;
    /**
     * Get ARC instance for external use (e.g., in routes)
     */
    getARCInstance(providerId: string): Arc | undefined;
    /**
     * Get callback URL for a provider (for route setup)
     */
    getCallbackUrl(providerId: string): string;
}
export default D21ARCBroadcastServiceImpl;
