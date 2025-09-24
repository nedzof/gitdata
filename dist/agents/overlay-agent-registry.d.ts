import { EventEmitter } from 'events';
import type { PostgreSQLBRC88SHIPSLAPService } from '../overlay/brc-services-postgresql';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
export interface OverlayAgent {
    agentId: string;
    name: string;
    capabilities: AgentCapability[];
    overlayTopics: string[];
    shipAdvertisementId?: string;
    slapAdvertisementId?: string;
    geographicRegion?: string;
    reputationScore: number;
    performanceStats: AgentPerformanceStats;
    identityKey?: string;
    webhookUrl: string;
    status: 'unknown' | 'up' | 'down';
    lastPingAt?: number;
    overlayNodeId?: string;
    createdAt: number;
    updatedAt: number;
}
export interface AgentCapability {
    name: string;
    inputs: string[];
    outputs: string[];
    description?: string;
    version?: string;
}
export interface AgentPerformanceStats {
    totalJobs: number;
    successfulJobs: number;
    avgExecutionTime: number;
    avgQualityScore: number;
    successRate: number;
    lastJobAt?: number;
}
export interface AgentSearchQuery {
    capability?: string;
    region?: string;
    minReputation?: number;
    maxExecutionTime?: number;
    overlayTopic?: string;
    limit?: number;
    offset?: number;
}
export declare class OverlayAgentRegistry extends EventEmitter {
    private database;
    private brc88Service;
    constructor(database: DatabaseAdapter, brc88Service: PostgreSQLBRC88SHIPSLAPService);
    private initialize;
    private setupDatabase;
    /**
     * Register agent with BRC-88 SHIP advertisement
     */
    registerAgent(agentData: {
        name: string;
        capabilities: AgentCapability[];
        overlayTopics: string[];
        webhookUrl: string;
        geographicRegion?: string;
        identityKey?: string;
        overlayNodeId?: string;
    }): Promise<OverlayAgent>;
    /**
     * Search agents by capability, region, reputation, etc.
     */
    searchAgents(query: AgentSearchQuery): Promise<OverlayAgent[]>;
    /**
     * Get agent by ID
     */
    getAgent(agentId: string): Promise<OverlayAgent | null>;
    /**
     * Update agent ping status
     */
    updateAgentPing(agentId: string, isUp: boolean): Promise<void>;
    /**
     * Update agent capabilities and re-advertise
     */
    updateAgentCapabilities(agentId: string, capabilities: AgentCapability[], overlayTopics?: string[]): Promise<void>;
    /**
     * Record agent performance
     */
    recordAgentPerformance(agentId: string, jobId: string, performance: {
        executionTimeMs: number;
        success: boolean;
        qualityScore?: number;
        clientFeedback?: any;
        overlayConfirmation?: string;
    }): Promise<void>;
    /**
     * Update agent's aggregate performance statistics
     */
    private updateAgentAggregateStats;
    /**
     * Calculate reputation score based on performance metrics
     */
    private calculateReputationScore;
    /**
     * Get agents by geographic region
     */
    getAgentsByRegion(region: string): Promise<OverlayAgent[]>;
    /**
     * Get agents subscribed to specific overlay topic
     */
    getAgentsByTopic(topic: string): Promise<OverlayAgent[]>;
    /**
     * Get top-rated agents by capability
     */
    getTopAgentsByCapability(capability: string, limit?: number): Promise<OverlayAgent[]>;
    /**
     * Get agent performance history
     */
    getAgentPerformanceHistory(agentId: string, limit?: number): Promise<Array<{
        jobId: string;
        executionTimeMs: number;
        success: boolean;
        qualityScore?: number;
        clientFeedback?: any;
        recordedAt: number;
    }>>;
    /**
     * Remove agent and cleanup advertisements
     */
    removeAgent(agentId: string): Promise<void>;
    /**
     * Get registry statistics
     */
    getRegistryStats(): Promise<{
        totalAgents: number;
        activeAgents: number;
        agentsByRegion: Record<string, number>;
        agentsByCapability: Record<string, number>;
        avgReputationScore: number;
    }>;
    private generateAgentId;
    private mapRowToAgent;
}
