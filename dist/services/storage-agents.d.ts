/**
 * D22 - BSV Overlay Network Storage Backend
 * Storage Agent Coordination System
 * Manages automated replication and verification agents
 */
import type { WalletClient } from '@bsv/sdk';
import type { Pool } from 'pg';
import type { StorageLocation, IntegrityVerification } from './uhrp-storage.js';
export interface ReplicationJob {
    id: string;
    contentHash: string;
    sourceLocation: StorageLocation;
    targetLocation: StorageLocation;
    priority: number;
    retryCount: number;
    maxRetries: number;
    estimatedSizeBytes: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}
export interface ReplicationResult {
    jobId: string;
    success: boolean;
    bytesReplicated: number;
    duration: number;
    verificationHash?: string;
    error?: string;
}
export interface VerificationJob {
    id: string;
    contentHash: string;
    verificationType: 'hash' | 'availability' | 'integrity' | 'full';
    locations: StorageLocation[];
    scheduleInterval: number;
    lastRun?: Date;
    nextRun: Date;
}
export interface AgentCapability {
    agentId: string;
    agentType: 'replication' | 'verification' | 'monitoring';
    capabilities: string[];
    maxConcurrentJobs: number;
    currentJobs: number;
    reliability: number;
    averageJobTime: number;
    geographicRegions: string[];
    costPerJob: number;
    lastSeen: Date;
}
export interface NetworkVerification {
    contentHash: string;
    totalLocations: number;
    healthyLocations: number;
    corruptedLocations: number;
    missingLocations: number;
    integrityScore: number;
    recommendedActions: string[];
    verifiedAt: Date;
}
export declare class StorageReplicationAgent {
    private pool;
    private walletClient;
    private agentId;
    private isActive;
    private currentJobs;
    constructor(pool: Pool, walletClient: WalletClient, agentId?: string);
    start(): Promise<void>;
    stop(): Promise<void>;
    private registerAgent;
    private processJobs;
    private getPendingJobs;
    executeReplicationJob(job: ReplicationJob): Promise<ReplicationResult>;
    private performReplication;
    private getContentFromLocation;
    private storeContentAtLocation;
    private updateStorageIndex;
    private calculateHash;
    private completeCurrentJobs;
    private unregisterAgent;
    private sleep;
}
export declare class StorageVerificationAgent {
    private pool;
    private walletClient;
    private agentId;
    private isActive;
    constructor(pool: Pool, walletClient: WalletClient, agentId?: string);
    start(): Promise<void>;
    stop(): Promise<void>;
    private registerAgent;
    private processVerifications;
    private getContentNeedingVerification;
    performIntegrityCheck(contentHash: string): Promise<IntegrityVerification>;
    private getStorageLocations;
    private verifyLocationIntegrity;
    private downloadContentFromLocation;
    verifyStorageNetwork(): Promise<NetworkVerification>;
    private generateRecommendations;
    private sleep;
}
export declare class StorageAgentCoordinator {
    private pool;
    private walletClient;
    private replicationAgents;
    private verificationAgents;
    constructor(pool: Pool, walletClient: WalletClient);
    startAgents(replicationAgentCount?: number, verificationAgentCount?: number): Promise<void>;
    stopAgents(): Promise<void>;
    getAgentStatus(): Promise<{
        replicationAgents: number;
        verificationAgents: number;
        activeJobs: number;
    }>;
}
export default StorageAgentCoordinator;
