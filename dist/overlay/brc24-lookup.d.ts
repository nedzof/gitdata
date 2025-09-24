import { EventEmitter } from 'events';
import type { BRC22SubmitService } from './brc22-submit';
import type { DatabaseAdapter } from './brc26-uhrp';
export interface BRC24Query {
    provider: string;
    query: any;
}
export interface BRC24Response {
    status: 'success' | 'error';
    utxos?: BRC36UTXO[];
    error?: {
        code: string;
        description: string;
    };
}
export interface BRC36UTXO {
    txid: string;
    vout: number;
    outputScript: string;
    topic: string;
    satoshis: number;
    rawTx: string;
    proof?: string;
    inputs?: string;
    mapiResponses?: string;
}
export interface LookupProvider {
    providerId: string;
    name: string;
    description: string;
    processQuery: (query: any, requesterId?: string) => Promise<Array<{
        topic: string;
        txid: string;
        vout: number;
    }>>;
    onUTXOAdded?: (topic: string, txid: string, vout: number, outputScript: string, satoshis: number) => void;
    onUTXOSpent?: (topic: string, txid: string, vout: number) => void;
}
export interface PaymentRequirement {
    required: boolean;
    amountSat: number;
    description: string;
    receiptTemplate?: any;
}
declare class BRC24LookupService extends EventEmitter {
    private database;
    private brc22Service;
    private lookupProviders;
    constructor(database: DatabaseAdapter, brc22Service: BRC22SubmitService);
    /**
     * Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
     * This method is kept for compatibility but no longer creates tables
     */
    private setupDatabase;
    /**
     * Set up default lookup providers
     */
    private setupDefaultProviders;
    /**
     * Set up event handlers for BRC-22 events
     */
    private setupBRC22EventHandlers;
    /**
     * Add a lookup provider
     */
    addLookupProvider(provider: LookupProvider): void;
    /**
     * Remove a lookup provider
     */
    removeLookupProvider(providerId: string): void;
    /**
     * Process a BRC-24 lookup query
     */
    processLookup(queryRequest: BRC24Query, requesterId?: string): Promise<BRC24Response>;
    /**
     * Check payment requirements for a query
     */
    private checkPaymentRequirement;
    /**
     * Hydrate UTXO identifiers with full BRC-36 information
     */
    private hydrateUTXOs;
    /**
     * Store query record
     */
    private storeQueryRecord;
    private searchDatasets;
    private searchPayments;
    private searchAgents;
    private searchLineage;
    private indexDatasetUTXO;
    private indexPaymentUTXO;
    private indexAgentUTXO;
    private indexLineageUTXO;
    private updateProviderData;
    /**
     * Get available providers
     */
    getAvailableProviders(): Array<{
        providerId: string;
        name: string;
        description: string;
    }>;
    /**
     * Get lookup statistics
     */
    getStats(): Promise<{
        providers: Record<string, {
            queries: number;
            recentQueries: number;
        }>;
        totalQueries: number;
        indexedData: Record<string, number>;
    }>;
    private generateQueryId;
}
export { BRC24LookupService };
