type CacheKey = string;
export type BundleCacheEntry = {
    assembledAt: number;
    body: any;
    meetsPolicyAtWrite: boolean;
};
export declare function bundlesKey(versionId: string, depth: number): CacheKey;
export declare function bundlesGet(key: CacheKey): Promise<BundleCacheEntry | undefined>;
export declare function bundlesSet(key: CacheKey, body: any, meetsPolicyAtWrite: boolean): Promise<void>;
export declare function bundlesInvalidate(key?: CacheKey): Promise<void>;
export {};
