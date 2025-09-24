import { EventEmitter } from 'events';
export interface UHRPAdvertisement {
    publicKey: string;
    address: string;
    contentHash: string;
    url: string;
    expiryTime: number;
    contentLength: number;
    signature: string;
    utxoId?: string;
    advertisedAt?: number;
    isActive?: boolean;
}
export interface UHRPContent {
    hash: string;
    filename: string;
    contentType: string;
    size: number;
    uploadedAt: number;
    expiresAt: number;
    downloadCount: number;
    localPath: string;
    isPublic: boolean;
    metadata?: {
        title?: string;
        description?: string;
        tags?: string[];
        author?: string;
    };
}
export interface UHRPQuery {
    hash?: string;
    filename?: string;
    contentType?: string;
    tags?: string[];
    author?: string;
    includeExpired?: boolean;
    limit?: number;
}
export interface UHRPHost {
    publicKey: string;
    address: string;
    baseUrl: string;
    reputation: number;
    uptime: number;
    lastSeen: number;
    contentCount: number;
    isActive: boolean;
}
export interface DatabaseAdapter {
    query(sql: string, params?: any[]): Promise<any[]>;
    queryOne(sql: string, params?: any[]): Promise<any>;
    execute(sql: string, params?: any[]): Promise<void>;
}
declare class BRC26UHRPService extends EventEmitter {
    private database;
    private storageBasePath;
    private myPublicKey;
    private myAddress;
    private baseUrl;
    private advertisements;
    private hostedContent;
    constructor(database: DatabaseAdapter, storageBasePath: string, baseUrl: string);
    /**
     * Initialize database tables for UHRP
     */
    private initializeDatabase;
    /**
     * Initialize identity from wallet
     */
    private initializeIdentity;
    /**
     * Load existing content from database
     */
    private loadExistingContent;
    /**
     * Store a file and create UHRP advertisement
     */
    storeFile(fileBuffer: Buffer, filename: string, contentType: string, options?: {
        expiryHours?: number;
        isPublic?: boolean;
        metadata?: {
            title?: string;
            description?: string;
            tags?: string[];
            author?: string;
        };
    }): Promise<UHRPContent>;
    /**
     * Create UHRP advertisement for content
     */
    createAdvertisement(content: UHRPContent): Promise<UHRPAdvertisement>;
    /**
     * Query content by hash or other criteria
     */
    queryContent(query: UHRPQuery): Promise<UHRPContent[]>;
    /**
     * Resolve content by hash from overlay network
     */
    resolveContent(contentHash: string): Promise<{
        content?: UHRPContent;
        advertisements: UHRPAdvertisement[];
        availableHosts: UHRPHost[];
    }>;
    /**
     * Download content from remote host
     */
    downloadContent(contentHash: string, hostUrl?: string): Promise<{
        success: boolean;
        content?: UHRPContent;
        buffer?: Buffer;
        error?: string;
    }>;
    /**
     * Get file buffer for local content
     */
    getFileBuffer(contentHash: string): Promise<Buffer | null>;
    /**
     * Get UHRP statistics
     */
    getStats(): Promise<{
        localContent: {
            total: number;
            public: number;
            private: number;
            totalSize: number;
        };
        advertisements: {
            own: number;
            total: number;
            active: number;
        };
        hosts: {
            total: number;
            active: number;
            averageReputation: number;
        };
        downloads: {
            total: number;
            successful: number;
            failed: number;
        };
    }>;
    private calculateContentHash;
    private deriveAddressFromPublicKey;
    private createAdvertisementMessage;
    private submitAdvertisementTransaction;
    private storeAdvertisement;
    private getHostsByPublicKeys;
    private recordDownload;
    /**
     * Clean up expired content and advertisements
     */
    cleanup(): Promise<{
        contentRemoved: number;
        advertisementsExpired: number;
    }>;
}
export { BRC26UHRPService };
