import { EventEmitter } from 'events';
import type { BRC22SubmitService } from './brc22-submit';
import type { BRC24LookupService, BRC36UTXO } from './brc24-lookup';
import type { DatabaseAdapter } from './brc26-uhrp';
export interface HistoricalUTXO extends BRC36UTXO {
    spentAt?: number;
    spentByTxid?: string;
    spentInTopic?: string;
    historicalInputs?: HistoricalInput[];
    lineageDepth?: number;
    parentUTXOs?: string[];
    childUTXOs?: string[];
    timestamp?: number;
}
export interface HistoricalInput {
    txid: string;
    vout: number;
    outputScript: string;
    satoshis: number;
    topic: string;
    rawTx: string;
    spentAt: number;
    spentByTxid: string;
    originalAdmittedAt: number;
}
export interface HistoryQuery {
    utxoId: string;
    topic: string;
    depth?: number;
    direction?: 'backward' | 'forward' | 'both';
    includeSpent?: boolean;
    timeRange?: {
        start: number;
        end: number;
    };
}
export interface LineageGraph {
    nodes: Array<{
        utxoId: string;
        txid: string;
        vout: number;
        topic: string;
        satoshis: number;
        timestamp: number;
        status: 'active' | 'spent';
        metadata?: any;
    }>;
    edges: Array<{
        from: string;
        to: string;
        relationship: 'input' | 'output' | 'topic_transfer';
        timestamp: number;
        txid: string;
    }>;
}
declare class BRC64HistoryService extends EventEmitter {
    private database;
    private brc22Service;
    private brc24Service;
    constructor(database: DatabaseAdapter, brc22Service: BRC22SubmitService, brc24Service: BRC24LookupService);
    /**
     * Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
     * This method is kept for compatibility but no longer creates tables
     */
    private setupDatabase;
    /**
     * Set up event handlers for BRC-22 transaction processing
     */
    private setupEventHandlers;
    /**
     * Capture transaction history when a transaction is processed
     */
    private captureTransactionHistory;
    /**
     * Store a historical input
     */
    private storeHistoricalInput;
    /**
     * Build lineage relationships for newly admitted UTXOs
     */
    private buildLineageRelationships;
    /**
     * Create a lineage edge between two UTXOs
     */
    private createLineageEdge;
    /**
     * Query UTXO history
     */
    queryHistory(query: HistoryQuery): Promise<HistoricalUTXO[]>;
    /**
     * Recursively traverse UTXO history
     */
    private traverseHistory;
    /**
     * Get UTXO details
     */
    private getUTXODetails;
    /**
     * Get historical inputs for a transaction
     */
    private getHistoricalInputs;
    /**
     * Get parent UTXOs
     */
    private getParentUTXOs;
    /**
     * Get child UTXOs
     */
    private getChildUTXOs;
    /**
     * Generate lineage graph
     */
    generateLineageGraph(startUtxoId: string, topic: string, maxDepth?: number): Promise<LineageGraph>;
    /**
     * Get history statistics
     */
    getStats(): Promise<{
        historicalInputs: number;
        lineageEdges: number;
        trackedTransactions: number;
        cacheHitRate: number;
    }>;
    private parseTransactionInputs;
    private generateCacheKey;
    private getCachedResult;
    private cacheResult;
    /**
     * Clean up expired cache entries
     */
    cleanupCache(): Promise<number>;
}
export { BRC64HistoryService };
