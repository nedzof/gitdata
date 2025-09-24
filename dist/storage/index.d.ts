import type { Readable } from 'stream';
export type StorageTier = 'hot' | 'warm' | 'cold';
export type CDNMode = 'off' | 'direct' | 'signed';
export interface StorageConfig {
    backend: 'fs' | 's3';
    s3?: {
        endpoint: string;
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
        buckets: {
            hot: string;
            warm: string;
            cold: string;
            backup?: string;
        };
    };
    cdn: {
        mode: CDNMode;
        baseUrl?: string;
        signingKey?: string;
    };
    presignTtlSec: number;
    defaultTier: StorageTier;
    maxRangeBytes: number;
    dataRoot?: string;
}
export interface StorageObject {
    contentHash: string;
    tier: StorageTier;
    size?: number;
    lastModified?: Date;
    etag?: string;
}
export interface PresignedUrl {
    url: string;
    expiresAt: number;
    headers?: Record<string, string>;
}
export interface RangeRequest {
    start?: number;
    end?: number;
}
export interface StorageMetadata {
    contentType?: string;
    contentLength?: number;
    cacheControl?: string;
    tier: StorageTier;
}
export declare abstract class StorageDriver {
    protected config: StorageConfig;
    constructor(config: StorageConfig);
    abstract putObject(contentHash: string, data: Buffer | Readable, tier: StorageTier, metadata?: StorageMetadata): Promise<void>;
    abstract getObject(contentHash: string, tier: StorageTier, range?: RangeRequest): Promise<{
        data: Readable;
        metadata: StorageMetadata;
    }>;
    abstract headObject(contentHash: string, tier: StorageTier): Promise<StorageMetadata>;
    abstract deleteObject(contentHash: string, tier: StorageTier): Promise<void>;
    abstract objectExists(contentHash: string, tier: StorageTier): Promise<boolean>;
    abstract getPresignedUrl(contentHash: string, tier: StorageTier, ttlSec?: number): Promise<PresignedUrl>;
    abstract healthCheck(): Promise<{
        healthy: boolean;
        latencyMs?: number;
        error?: string;
    }>;
    abstract listObjects(tier: StorageTier, prefix?: string, maxKeys?: number): Promise<StorageObject[]>;
    abstract moveObject(contentHash: string, fromTier: StorageTier, toTier: StorageTier): Promise<void>;
    protected generateCdnUrl(contentHash: string, tier: StorageTier): string | null;
    protected getBucketForTier(tier: StorageTier): string;
    protected getObjectKey(contentHash: string): string;
}
export declare class FilesystemStorageDriver extends StorageDriver {
    putObject(contentHash: string, data: Buffer | Readable, tier: StorageTier, metadata?: StorageMetadata): Promise<void>;
    getObject(contentHash: string, tier: StorageTier, range?: RangeRequest): Promise<{
        data: Readable;
        metadata: StorageMetadata;
    }>;
    headObject(contentHash: string, tier: StorageTier): Promise<StorageMetadata>;
    deleteObject(contentHash: string, tier: StorageTier): Promise<void>;
    objectExists(contentHash: string, tier: StorageTier): Promise<boolean>;
    getPresignedUrl(contentHash: string, tier: StorageTier, ttlSec?: number): Promise<PresignedUrl>;
    healthCheck(): Promise<{
        healthy: boolean;
        latencyMs?: number;
        error?: string;
    }>;
    listObjects(tier: StorageTier, prefix?: string, maxKeys?: number): Promise<StorageObject[]>;
    moveObject(contentHash: string, fromTier: StorageTier, toTier: StorageTier): Promise<void>;
    private getFilePath;
}
export declare class S3StorageDriver extends StorageDriver {
    putObject(contentHash: string, data: Buffer | Readable, tier: StorageTier, metadata?: StorageMetadata): Promise<void>;
    getObject(contentHash: string, tier: StorageTier, range?: RangeRequest): Promise<{
        data: Readable;
        metadata: StorageMetadata;
    }>;
    headObject(contentHash: string, tier: StorageTier): Promise<StorageMetadata>;
    deleteObject(contentHash: string, tier: StorageTier): Promise<void>;
    objectExists(contentHash: string, tier: StorageTier): Promise<boolean>;
    getPresignedUrl(contentHash: string, tier: StorageTier, ttlSec?: number): Promise<PresignedUrl>;
    healthCheck(): Promise<{
        healthy: boolean;
        latencyMs?: number;
        error?: string;
    }>;
    listObjects(tier: StorageTier, prefix?: string, maxKeys?: number): Promise<StorageObject[]>;
    moveObject(contentHash: string, fromTier: StorageTier, toTier: StorageTier): Promise<void>;
    private getS3StorageClass;
    private generatePresignedUrl;
    private s3Request;
    private createAuthHeaders;
    private createCanonicalRequest;
    private createStringToSign;
    private calculateSignature;
    private formatDate;
    private formatDateTime;
}
export declare function createStorageDriver(config?: StorageConfig): StorageDriver;
export declare function calculateContentHash(data: Buffer | Readable): Promise<string>;
export declare function parseRange(rangeHeader: string, contentLength: number): RangeRequest | null;
export declare function formatContentRange(start: number, end: number, total: number): string;
export declare function getStorageDriver(): StorageDriver;
export type { StorageDriver as StorageDriverType, StorageConfig as StorageConfigType, StorageObject as StorageObjectType, PresignedUrl as PresignedUrlType, RangeRequest as RangeRequestType, StorageMetadata as StorageMetadataType, };
