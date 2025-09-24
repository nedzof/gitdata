import Redis from 'ioredis';
export interface RedisConfig {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number;
    retryDelayOnFailover?: number;
    lazyConnect?: boolean;
}
export declare class RedisClient {
    private client;
    private config;
    constructor(config?: RedisConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    del(key: string | string[]): Promise<void>;
    exists(key: string): Promise<boolean>;
    keys(pattern: string): Promise<string[]>;
    delPattern(pattern: string): Promise<void>;
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string): Promise<void>;
    hgetall(key: string): Promise<Record<string, string>>;
    hdel(key: string, field: string): Promise<void>;
    sadd(key: string, members: string[]): Promise<void>;
    smembers(key: string): Promise<string[]>;
    srem(key: string, members: string[]): Promise<void>;
    zadd(key: string, score: number, member: string): Promise<void>;
    zrange(key: string, start: number, stop: number): Promise<string[]>;
    zrevrange(key: string, start: number, stop: number): Promise<string[]>;
    expire(key: string, seconds: number): Promise<void>;
    ttl(key: string): Promise<number>;
    publish(channel: string, message: string): Promise<void>;
    getClient(): Redis;
    ping(): Promise<boolean>;
}
export interface CacheTTLs {
    assets: number;
    listings: number;
    lineage: number;
    sessions: number;
    policies: number;
    prices: number;
}
export declare function getCacheTTLs(): CacheTTLs;
export declare const CacheKeys: {
    asset: (versionId: string) => string;
    listings: (query?: string, page?: number, filters?: Record<string, any>) => string;
    olEvent: (namespace: string, hash: string) => string;
    olJob: (namespace: string, name: string) => string;
    olRun: (namespace: string, runId: string) => string;
    olDataset: (namespace: string, name: string) => string;
    olUpstream: (namespace: string, child: string) => string;
    olDownstream: (namespace: string, parent: string) => string;
    olEventsByTime: (namespace: string) => string;
    olJobsByUpdated: (namespace: string) => string;
    olRunsByUpdated: (namespace: string) => string;
    olDatasetsAll: (namespace: string) => string;
    lineageGraph: (node: string, depth: number, direction: string, format: string) => string;
    session: (sessionId: string) => string;
    jobs: (state?: string) => string;
    policy: (policyId: string) => string;
    policyRuns: (versionId: string) => string;
    price: (versionId: string) => string;
    priceRules: (scope: string, scopeId: string) => string;
};
export declare function getRedisClient(): RedisClient;
export declare function closeRedisConnection(): Promise<void>;
