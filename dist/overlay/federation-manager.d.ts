/**
 * Cross-Overlay Network Federation Manager
 *
 * Implements multi-node content synchronization, global content discovery,
 * and cross-network payment settlement for distributed overlay networks.
 */
import { EventEmitter } from 'events';
import type { DatabaseAdapter } from './brc26-uhrp';
export interface FederationNode {
    nodeId: string;
    hostname: string;
    port: number;
    publicKey: string;
    capabilities: NodeCapability[];
    lastSeen: Date;
    reputation: number;
    region: string;
}
export interface NodeCapability {
    service: string;
    version: string;
    endpoints: string[];
    maxThroughput: number;
    costPerRequest: number;
}
export interface ContentSync {
    contentHash: string;
    sourceNode: string;
    targetNodes: string[];
    syncStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
    priority: 'low' | 'normal' | 'high';
    createdAt: Date;
    completedAt?: Date;
    progress: number;
}
export interface GlobalContentReference {
    contentHash: string;
    availableNodes: string[];
    primaryNode: string;
    backupNodes: string[];
    contentType: string;
    size: number;
    createdAt: Date;
    lastVerified: Date;
    verificationStatus: 'verified' | 'pending' | 'failed';
}
export interface FederationMetrics {
    connectedNodes: number;
    totalContent: number;
    syncedContent: number;
    pendingSyncs: number;
    averageLatency: number;
    totalThroughput: number;
}
export declare class FederationManager extends EventEmitter {
    private database;
    private nodeId;
    private privateKey;
    private connectedNodes;
    private syncQueue;
    private heartbeatInterval;
    constructor(database: DatabaseAdapter, nodeId: string, privateKey: string);
    initialize(): Promise<void>;
    registerNode(node: Omit<FederationNode, 'lastSeen' | 'reputation'>): Promise<void>;
    discoverNodes(region?: string): Promise<FederationNode[]>;
    initiateContentSync(contentHash: string, targetNodes: string[], priority?: 'low' | 'normal' | 'high'): Promise<string>;
    processContentSync(syncId: string): Promise<void>;
    registerGlobalContent(contentHash: string, metadata: {
        contentType: string;
        size: number;
        backupNodes?: string[];
    }): Promise<void>;
    discoverGlobalContent(contentHash: string): Promise<GlobalContentReference | null>;
    routeContentRequest(contentHash: string, clientRegion?: string): Promise<FederationNode | null>;
    getFederationMetrics(): Promise<FederationMetrics>;
    private createFederationTables;
    private loadConnectedNodes;
    private startHeartbeat;
    private sendHeartbeat;
    private cleanupStaleNodes;
    private updateSyncStatus;
    private getLocalContent;
    private transferContentToNode;
    private getNodeLoadFactor;
    private calculateAverageLatency;
    private calculateTotalThroughput;
    shutdown(): Promise<void>;
}
