import { EventEmitter } from 'events';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
import type { OverlayAgent } from './overlay-agent-registry';
import type { OverlayJob } from './overlay-rule-engine';
export interface AgentExecution {
    jobId: string;
    agentId: string;
    identityKey?: string;
    signature: string;
    nonce: string;
    artifacts: ExecutionArtifact[];
    executionTime: number;
    success: boolean;
    errorMessage?: string;
    clientFeedback?: any;
}
export interface ExecutionArtifact {
    type: string;
    hash?: string;
    url?: string;
    contentType?: string;
    size?: number;
    metadata?: any;
}
export interface BRC31Headers {
    'X-Identity-Key': string;
    'X-Nonce': string;
    'X-Signature': string;
}
export interface WebhookPayload {
    type: string;
    jobId: string;
    payload: any;
    timestamp: number;
}
export interface WebhookResponse {
    ok: boolean;
    artifacts?: ExecutionArtifact[];
    executionTime?: number;
    error?: string;
    metadata?: any;
}
export declare class AgentExecutionService extends EventEmitter {
    private database;
    private webhookTimeoutMs;
    private requireIdentity;
    constructor(database: DatabaseAdapter, options?: {
        webhookTimeoutMs?: number;
        requireIdentity?: boolean;
    });
    private initialize;
    private setupDatabase;
    /**
     * Execute agent job with BRC-31 identity verification
     */
    executeAgentJob(job: OverlayJob, agent: OverlayAgent, payload: any): Promise<AgentExecution>;
    /**
     * Call agent webhook with BRC-31 signed request
     */
    private callAgentWebhook;
    /**
     * Verify BRC-31 signature
     */
    verifyBRC31Signature(identityKey: string, message: string, headers: BRC31Headers): Promise<boolean>;
    /**
     * Process agent execution result
     */
    processExecutionResult(jobId: string, agentId: string, result: {
        signature: string;
        nonce: string;
        artifacts: ExecutionArtifact[];
        success: boolean;
        executionTime?: number;
        error?: string;
        clientFeedback?: any;
    }): Promise<void>;
    /**
     * Process execution artifacts (store via BRC-26 if needed)
     */
    private processExecutionArtifacts;
    /**
     * Get agent execution history
     */
    getAgentExecutionHistory(agentId: string, limit?: number): Promise<AgentExecution[]>;
    /**
     * Get job execution details
     */
    getJobExecution(jobId: string): Promise<AgentExecution[]>;
    /**
     * Get BRC-31 verification statistics
     */
    getBRC31Stats(agentId?: string): Promise<{
        totalVerifications: number;
        successfulVerifications: number;
        failedVerifications: number;
        successRate: number;
        recentFailures: Array<{
            agentId: string;
            identityKey: string;
            error: string;
            verifiedAt: number;
        }>;
    }>;
    private storeExecution;
    private logBRC31Verification;
    private getWebhookType;
    private generateNonce;
    private createMessageHash;
    private signMessage;
    private verifySignature;
    private getSystemIdentityKey;
    private extractBRC31Headers;
    private getAgentFromDatabase;
}
