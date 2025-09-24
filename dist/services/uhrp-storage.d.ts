/**
 * D22 - BSV Overlay Network Storage Backend
 * UHRP (Universal Hash Resolution Protocol) Storage Service
 * Provides BRC-26 compliant distributed storage with multi-location support
 */
import type { WalletClient } from '@bsv/sdk';
import type { Pool } from 'pg';
export interface ContentMetadata {
    size: number;
    mimeType: string;
    classification: string;
    accessFrequency?: number;
    updateFrequency?: number;
    geographicRestrictions?: string[];
    customMetadata?: Record<string, any>;
}
export interface StorageLocation {
    type: 'local' | 'overlay' | 'uhrp' | 's3' | 'cdn';
    url: string;
    availability: number;
    latency: number;
    bandwidth: number;
    cost: number;
    geographicRegion: string[];
    verifiedAt: string;
    verificationAgent?: string;
}
export interface UHRPStorageResult {
    contentHash: string;
    uhrpUrl: string;
    localPath: string;
    overlayAdvertisements: string[];
    storageLocations: StorageLocation[];
    verificationAgents: string[];
}
export interface UHRPResolveOptions {
    preferredMethod?: 'local' | 'uhrp' | 'overlay' | 's3' | 'cdn' | 'auto';
    maxLatency?: number;
    geographicPreference?: string[];
    includeVerification?: boolean;
    trackAccess?: boolean;
}
export interface UHRPResolution {
    contentHash: string;
    availableLocations: StorageLocation[];
    preferredLocation: StorageLocation;
    integrityVerified: boolean;
    resolutionTime: number;
    overlayRoute: OverlayRoute[];
}
export interface OverlayRoute {
    nodeId: string;
    location: string;
    latency: number;
    hops: number;
}
export interface UHRPAdvertisement {
    advertisementId: string;
    contentHash: string;
    storageProvider: string;
    capability: StorageCapability;
    endpoints: string[];
    geographicRegions: string[];
    ttlHours: number;
    publishedAt: Date;
}
export interface StorageCapability {
    maxFileSize: number;
    supportedMimeTypes: string[];
    availabilityGuarantee: number;
    bandwidthMbps: number;
    costPerGBSatoshis: number;
    features: string[];
}
export interface IntegrityVerification {
    contentHash: string;
    verificationResults: LocationVerification[];
    consensusAchieved: boolean;
    agreementRatio: number;
    verifiedAt: Date;
}
export interface LocationVerification {
    location: StorageLocation;
    hashMatch: boolean;
    responseTime: number;
    contentSize: number;
    error: string | null;
}
export declare class UHRPStorageService {
    private pool;
    private walletClient;
    private storageBasePath;
    private overlayTopics;
    private config;
    constructor(pool: Pool, walletClient: WalletClient, config: UHRPStorageConfig);
    private initializeStorage;
    /**
     * Store content with UHRP addressing and multi-location replication
     */
    storeContent(content: Buffer, metadata: ContentMetadata, versionId: string): Promise<UHRPStorageResult>;
    /**
     * Resolve content via UHRP with intelligent location selection
     */
    resolveContent(contentHash: string, options?: UHRPResolveOptions): Promise<UHRPResolution>;
    /**
     * Advertise content availability via BRC-88 SHIP/SLAP
     */
    advertiseContent(contentHash: string, storageCapability: StorageCapability): Promise<UHRPAdvertisement>;
    /**
     * Verify content integrity across all storage locations
     */
    verifyContentIntegrity(contentHash: string): Promise<IntegrityVerification>;
    private storeLocally;
    private createStorageRecord;
    private generateUHRPUrl;
    private publishToOverlay;
    private initializeReplication;
    private getStorageLocations;
    private getAvailableLocations;
    private selectOptimalLocation;
    private calculateLocationScore;
    private verifyLocationIntegrity;
    private assignVerificationAgents;
    private getOverlayRoute;
    private logAccess;
    private calculateContentHash;
    private generateAdvertisementId;
    private getStorageProviderIdentity;
    private getStorageEndpoints;
    private publishAdvertisementToOverlay;
}
export interface UHRPStorageConfig {
    storageBasePath?: string;
    overlayTopics?: string[];
    geographicRegions?: string[];
    advertisementTTLHours?: number;
    consensusThreshold?: number;
    baseUrl?: string;
}
export default UHRPStorageService;
