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
export declare class PostgreSQLBRC22SubmitService extends EventEmitter {
    private database;
    private topicManagers;
    private trackedUTXOs;
    constructor(database: DatabaseAdapter);
    private initialize;
    private setupDatabase;
    private setupDefaultTopicManagers;
    addTopicManager(manager: TopicManager): void;
    processSubmission(transaction: BRC22Transaction, requesterId?: string): Promise<BRC22Response>;
    private processTransactionForTopic;
    private admitUTXO;
    private storeTransactionRecord;
    getUTXOsByTopic(topic: string): Promise<Array<{
        utxoId: string;
        txid: string;
        vout: number;
        outputScript: string;
        satoshis: number;
        admittedAt: number;
        spentAt?: number;
    }>>;
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
    private extractTxId;
    private parseTransactionOutputs;
}
export interface BRC24Query {
    provider: string;
    query: any;
    limit?: number;
    offset?: number;
}
export interface BRC24Response {
    status: 'success' | 'error';
    results: Array<{
        topic: string;
        txid: string;
        vout: number;
        envelope?: any;
    }>;
    error?: {
        code: string;
        description: string;
    };
}
export interface LookupProvider {
    providerId: string;
    name: string;
    description: string;
    processQuery: (query: any, requesterId?: string) => Promise<Array<{
        topic: string;
        txid: string;
        vout: number;
        envelope?: any;
    }>>;
}
export declare class PostgreSQLBRC24LookupService extends EventEmitter {
    private database;
    private brc22Service;
    private providers;
    constructor(database: DatabaseAdapter, brc22Service: PostgreSQLBRC22SubmitService);
    private initialize;
    private setupDatabase;
    private setupDefaultProviders;
    addLookupProvider(provider: LookupProvider): void;
    processLookup(providerId: string, query: any, requesterId?: string): Promise<BRC24Response>;
    getAvailableProviders(): Array<{
        id: string;
        name: string;
        description: string;
    }>;
}
export interface HistoricalUTXO {
    utxoId: string;
    txid: string;
    vout: number;
    topic: string;
    capturedAt: number;
    inputsPreserved: boolean;
}
export interface HistoryQuery {
    utxoId: string;
    topic?: string;
    depth?: number;
    direction?: 'backward' | 'forward' | 'both';
}
export interface LineageGraph {
    nodes: Array<{
        utxoId: string;
        txid: string;
        vout: number;
        topic: string;
        level: number;
    }>;
    edges: Array<{
        from: string;
        to: string;
        relationship: string;
        timestamp: number;
    }>;
}
export declare class PostgreSQLBRC64HistoryService extends EventEmitter {
    private database;
    private brc22Service;
    private brc24Service;
    constructor(database: DatabaseAdapter, brc22Service: PostgreSQLBRC22SubmitService, brc24Service: PostgreSQLBRC24LookupService);
    private initialize;
    private setupDatabase;
    queryHistory(query: HistoryQuery): Promise<HistoricalUTXO[]>;
    generateLineageGraph(startUtxoId: string, topic?: string, maxDepth?: number): Promise<LineageGraph>;
    getStats(): Promise<{
        historicalInputs: number;
        lineageEdges: number;
        trackedTransactions: number;
        cacheHitRate: number;
    }>;
}
export interface SHIPAdvertisement {
    advertiserIdentity: string;
    domainName: string;
    topicName: string;
    signature: string;
    timestamp: number;
    utxoId?: string;
}
export interface SLAPAdvertisement {
    advertiserIdentity: string;
    domainName: string;
    serviceId: string;
    signature: string;
    timestamp: number;
    utxoId?: string;
}
export declare class PostgreSQLBRC88SHIPSLAPService extends EventEmitter {
    private database;
    private domain;
    constructor(database: DatabaseAdapter, domain: string);
    private initialize;
    private setupDatabase;
    createSHIPAdvertisement(topicName: string): Promise<SHIPAdvertisement>;
    createSLAPAdvertisement(serviceId: string): Promise<SLAPAdvertisement>;
    getSHIPAdvertisements(): Promise<SHIPAdvertisement[]>;
    getSLAPAdvertisements(): Promise<SLAPAdvertisement[]>;
}
