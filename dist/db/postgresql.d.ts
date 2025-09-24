import type { PoolClient, PoolConfig } from 'pg';
import { Pool } from 'pg';
export interface PostgreSQLConfig extends PoolConfig {
    url?: string;
    poolMin?: number;
    poolMax?: number;
}
export declare class PostgreSQLClient {
    private pool;
    private config;
    constructor(config?: PostgreSQLConfig);
    query<T = any>(text: string, params?: any[]): Promise<{
        rows: T[];
        rowCount: number;
    }>;
    queryOne<T = any>(text: string, params?: any[]): Promise<T | null>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    initSchema(schemaFile?: string): Promise<void>;
    healthCheck(): Promise<boolean>;
    close(): Promise<void>;
    getPool(): Pool;
}
export declare function getPostgreSQLClient(): PostgreSQLClient;
export declare function closePostgreSQLConnection(): Promise<void>;
export declare function upsertRecord<T extends Record<string, any>>(client: PostgreSQLClient, table: string, record: T, conflictColumns: string[], updateColumns?: string[]): Promise<void>;
export declare function insertRecord<T extends Record<string, any>>(client: PostgreSQLClient, table: string, record: T): Promise<void>;
export declare function updateRecord<T extends Record<string, any>>(client: PostgreSQLClient, table: string, record: Partial<T>, whereClause: string, whereParams: any[]): Promise<void>;
export declare function deleteRecord(client: PostgreSQLClient, table: string, whereClause: string, whereParams: any[]): Promise<number>;
