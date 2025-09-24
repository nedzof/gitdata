import type { PostgreSQLClient } from './postgresql';
import type { RedisClient } from './redis';
import type { ManifestRow, ProducerRow, ReceiptRow, OpenLineageEvent } from './index';
export declare class HybridDatabase {
    private pg;
    private redis;
    private ttls;
    constructor(pgClient?: PostgreSQLClient, redisClient?: RedisClient);
    private getFromCacheOrDb;
    private invalidateCache;
    query<T = any>(text: string, params?: any[]): Promise<{
        rows: T[];
        rowCount: number;
    }>;
    getAsset(versionId: string): Promise<ManifestRow | null>;
    upsertAsset(asset: Partial<ManifestRow>): Promise<void>;
    searchAssets(opts: {
        q?: string;
        datasetId?: string;
        limit?: number;
        offset?: number;
    }): Promise<ManifestRow[]>;
    getProducer(producerId: string): Promise<ProducerRow | null>;
    upsertProducer(producer: Partial<ProducerRow>): Promise<string>;
    getPrice(versionId: string): Promise<number | null>;
    setPrice(versionId: string, satoshis: number): Promise<void>;
    replaceEdges(child: string, parents: string[]): Promise<void>;
    getParents(child: string): Promise<string[]>;
    insertReceipt(receipt: Omit<ReceiptRow, 'bytes_used' | 'last_seen'> & Partial<Pick<ReceiptRow, 'bytes_used' | 'last_seen'>>): Promise<void>;
    getReceipt(receiptId: string): Promise<ReceiptRow | null>;
    getRecentReceipts(limit?: number, offset?: number): Promise<ReceiptRow[]>;
    ingestOpenLineageEvent(event: OpenLineageEvent): Promise<boolean>;
    queryLineage(options: {
        node: string;
        depth?: number;
        direction?: 'up' | 'down' | 'both';
        namespace?: string;
    }): Promise<{
        node: string;
        depth: number;
        direction: string;
        nodes: Array<{
            namespace: string;
            name: string;
            type: 'dataset';
            facets?: any;
        }>;
        edges: Array<{
            from: string;
            to: string;
            rel: 'parent';
        }>;
        stats: {
            nodes: number;
            edges: number;
            truncated: boolean;
        };
    }>;
    healthCheck(): Promise<{
        pg: boolean;
        redis: boolean;
    }>;
    close(): Promise<void>;
}
export declare function getHybridDatabase(): HybridDatabase;
export declare function closeHybridDatabase(): Promise<void>;
