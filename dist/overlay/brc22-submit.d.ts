import { EventEmitter } from 'events';
import type { DatabaseAdapter } from './brc26-uhrp';
export interface BRC22Transaction {
    rawTx: string;
    inputs: Record<string, BRC22Input>;
    mapiResponses?: Array<{
        payload: string;
        signature: string;
        publicKey: string;
    }>;
    proof?: string;
    topics: string[];
}
export interface BRC22Input {
    proof?: {
        flags: number;
        index: number;
        txOrId: string;
        target: string;
        nodes: string[];
        targetType: string;
    };
    rawTx: string;
}
export interface BRC22Response {
    status: 'success' | 'error';
    topics?: Record<string, number[]>;
    error?: {
        code: string;
        description: string;
    };
}
export interface TopicManager {
    topicName: string;
    admittanceLogic: (transaction: BRC22Transaction, outputIndex: number) => boolean;
    spentInputLogic?: (inputTxid: string, inputVout: number) => boolean;
    onOutputAdmitted?: (txid: string, vout: number, outputScript: string, satoshis: number) => void;
    onInputSpent?: (txid: string, vout: number) => void;
}
declare class BRC22SubmitService extends EventEmitter {
    private database;
    private topicManagers;
    private trackedUTXOs;
    constructor(database: DatabaseAdapter);
    private initialize;
    /**
     * Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
     * This method is kept for compatibility but no longer creates tables
     */
    private setupDatabase;
    /**
     * Set up default topic managers for common Gitdata use cases
     */
    private setupDefaultTopicManagers;
    /**
     * Add a topic manager
     */
    addTopicManager(manager: TopicManager): void;
    /**
     * Remove a topic manager
     */
    removeTopicManager(topicName: string): void;
    /**
     * Process a BRC-22 transaction submission
     */
    processSubmission(transaction: BRC22Transaction, senderIdentity?: string): Promise<BRC22Response>;
    /**
     * Process spent inputs for a topic
     */
    private processSpentInputs;
    /**
     * Admit an output to a topic
     */
    private admitOutput;
    /**
     * Mark UTXO as spent
     */
    private markUTXOSpent;
    /**
     * Store transaction record
     */
    private storeTransactionRecord;
    /**
     * Get UTXOs for a topic
     */
    getTopicUTXOs(topic: string, includeSpent?: boolean): Promise<Array<{
        utxoId: string;
        txid: string;
        vout: number;
        outputScript: string;
        satoshis: number;
        admittedAt: number;
        spentAt?: number;
        spentByTxid?: string;
    }>>;
    /**
     * Get statistics for BRC-22 operations
     */
    getStats(): Promise<{
        topics: Record<string, {
            active: number;
            spent: number;
            total: number;
        }>;
        transactions: {
            total: number;
            recent: number;
        };
    }>;
    private isD01AAssetOutput;
    private isPaymentReceiptOutput;
    private isAgentRegistryOutput;
    private isLineageOutput;
    private calculateTxid;
    private parseTransactionOutputs;
    private parseTransactionInputs;
    private verifyTransactionEnvelope;
}
export { BRC22SubmitService };
