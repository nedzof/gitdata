import { EventEmitter } from 'events';
import type { DatabaseAdapter } from './brc26-uhrp';
import type { BRC22SubmitService } from './brc22-submit';
import type { BRC24LookupService } from './brc24-lookup';
export interface SHIPAdvertisement {
    advertiserIdentity: string;
    domainName: string;
    topicName: string;
    signature: string;
    timestamp: number;
    isRevocation?: boolean;
}
export interface SLAPAdvertisement {
    advertiserIdentity: string;
    domainName: string;
    serviceId: string;
    signature: string;
    timestamp: number;
    isRevocation?: boolean;
}
export interface ServiceNode {
    identity: string;
    domainName: string;
    services: {
        topics: string[];
        lookupProviders: string[];
    };
    lastSeen: number;
    isActive: boolean;
    connectionStatus: 'connected' | 'disconnected' | 'pending';
}
export interface SynchronizationConfig {
    enableAutoSync: boolean;
    syncInterval: number;
    peerDiscoveryUrls: string[];
    advertisementTTL: number;
    maxPeers: number;
}
declare class BRC88SHIPSLAPService extends EventEmitter {
    private database;
    private brc22Service;
    private brc24Service;
    private config;
    private myIdentity;
    private myDomain;
    private syncTimer;
    private knownPeers;
    constructor(database: DatabaseAdapter, brc22Service: BRC22SubmitService, brc24Service: BRC24LookupService, config: SynchronizationConfig, myDomain: string);
    /**
     * Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
     * This method is kept for compatibility but no longer creates tables
     */
    private setupDatabase;
    /**
     * Set up SHIP and SLAP topic managers in BRC-22
     */
    private setupSHIPSLAPTopicManagers;
    /**
     * Initialize identity from connected wallet
     */
    private initializeIdentity;
    /**
     * Start synchronization process
     */
    private startSynchronization;
    /**
     * Perform synchronization with peers
     */
    private performSynchronization;
    /**
     * Discover new peers from configured URLs
     */
    private discoverPeers;
    /**
     * Simulate peer discovery (placeholder for real implementation)
     */
    private simulatePeerDiscovery;
    /**
     * Add a discovered peer
     */
    private addDiscoveredPeer;
    /**
     * Sync with known peers
     */
    private syncWithPeers;
    /**
     * Sync with a specific peer
     */
    private syncWithPeer;
    /**
     * Handle peer sync failure
     */
    private handlePeerSyncFailure;
    /**
     * Create and submit SHIP advertisement
     */
    createSHIPAdvertisement(topicName: string): Promise<string>;
    /**
     * Create and submit SLAP advertisement
     */
    createSLAPAdvertisement(serviceId: string): Promise<string>;
    /**
     * Update our own advertisements based on current services
     */
    private updateOwnAdvertisements;
    /**
     * Validate SHIP token in transaction output
     */
    private validateSHIPToken;
    /**
     * Validate SLAP token in transaction output
     */
    private validateSLAPToken;
    /**
     * Process SHIP advertisement from blockchain
     */
    private processSHIPAdvertisement;
    /**
     * Process SLAP advertisement from blockchain
     */
    private processSLAPAdvertisement;
    /**
     * Get service statistics
     */
    getStats(): Promise<{
        ship: {
            total: number;
            active: number;
            own: number;
        };
        slap: {
            total: number;
            active: number;
            own: number;
        };
        peers: {
            total: number;
            active: number;
            connected: number;
        };
        sync: {
            attempts: number;
            successes: number;
            failures: number;
        };
    }>;
    private createSHIPMessage;
    private createSLAPMessage;
    private createAdvertisementTransaction;
    private storeSHIPAdvertisement;
    private storeSLAPAdvertisement;
    private parseSHIPFromScript;
    private parseSLAPFromScript;
    private parseTransactionOutputs;
    private recordSyncAttempt;
    private cleanupStaleAdvertisements;
    /**
     * Stop synchronization
     */
    stop(): void;
}
export { BRC88SHIPSLAPService };
