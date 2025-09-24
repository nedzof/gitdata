export type BRCCacheEntry = {
    method: string;
    timestamp: number;
    data: any;
    signature?: string;
    publicKey?: string;
    expiresAt: number;
};
export type BRCVerificationEntry = {
    method: string;
    hash: string;
    verified: boolean;
    timestamp: number;
    publicKey: string;
    expiresAt: number;
};
export declare function invalidateAPIClientCache(): Promise<void>;
export declare function shouldBypassAPICache(): Promise<boolean>;
export declare function cacheBRCVerification(method: string, hash: string, verified: boolean, publicKey: string): Promise<void>;
export declare function getCachedBRCVerification(method: string, hash: string): Promise<BRCVerificationEntry | null>;
export declare function cacheBRCSignature(hash: string, signature: string, publicKey: string): Promise<void>;
export declare function getCachedBRCSignature(hash: string): Promise<any | null>;
export declare function invalidateBRCCache(publicKey?: string): Promise<void>;
export declare function shouldBypassCache(method: string): Promise<boolean>;
export declare function logCacheOperation(operation: string, key: string, hit?: boolean): void;
