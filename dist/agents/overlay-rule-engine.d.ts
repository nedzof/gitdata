import { EventEmitter } from 'events';
import type { PostgreSQLBRC22SubmitService } from '../overlay/brc-services-postgresql';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
import type { OverlayAgentRegistry } from './overlay-agent-registry';
export interface OverlayRule {
    ruleId: string;
    name: string;
    enabled: boolean;
    overlayTopics: string[];
    whenCondition: RuleCondition;
    findStrategy: FindStrategy;
    actions: RuleAction[];
    ownerProducerId?: string;
    executionStats: RuleExecutionStats;
    lastTriggeredAt?: number;
    createdAt: number;
    updatedAt: number;
}
export interface RuleCondition {
    type: 'overlay-event' | 'scheduled' | 'manual';
    topic?: string;
    predicate?: PredicateExpression;
    schedule?: string;
}
export interface FindStrategy {
    source: 'overlay-search' | 'agent-registry' | 'capability-lookup';
    topics?: string[];
    query?: any;
    requireAll?: string[];
    limit?: number;
    timeout?: number;
}
export interface RuleAction {
    action: string;
    capability?: string;
    region?: string;
    timeout?: number;
    payload?: any;
    [key: string]: any;
}
export interface PredicateExpression {
    and?: PredicateExpression[];
    or?: PredicateExpression[];
    not?: PredicateExpression;
    eq?: Record<string, any>;
    gt?: Record<string, number>;
    gte?: Record<string, number>;
    lt?: Record<string, number>;
    lte?: Record<string, number>;
    includes?: Record<string, any>;
}
export interface RuleExecutionStats {
    totalTriggers: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
    lastExecutionTime?: number;
    successRate: number;
}
export interface OverlayJob {
    jobId: string;
    ruleId: string;
    targetId?: string;
    overlayTransactionId?: string;
    state: 'queued' | 'running' | 'done' | 'failed' | 'dead';
    assignedAgents: string[];
    coordinationData?: any;
    attempts: number;
    nextRunAt: number;
    lastError?: string;
    evidencePackage?: any;
    lineageData?: any;
    createdAt: number;
    updatedAt: number;
}
export declare class OverlayRuleEngine extends EventEmitter {
    private database;
    private brc22Service;
    private agentRegistry;
    private processingInterval;
    private subscriptions;
    constructor(database: DatabaseAdapter, brc22Service: PostgreSQLBRC22SubmitService, agentRegistry: OverlayAgentRegistry);
    private initialize;
    private setupDatabase;
    /**
     * Create a new overlay rule
     */
    createRule(ruleData: {
        name: string;
        overlayTopics?: string[];
        whenCondition: RuleCondition;
        findStrategy: FindStrategy;
        actions: RuleAction[];
        ownerProducerId?: string;
    }): Promise<OverlayRule>;
    /**
     * Trigger rule execution manually
     */
    triggerRule(ruleId: string, triggerEvent?: any): Promise<string[]>;
    /**
     * Execute rule and create jobs
     */
    private executeRule;
    /**
     * Find agents based on rule's find strategy
     */
    private findAgentsForRule;
    private findAgentsFromRegistry;
    private findAgentsByCapability;
    private findAgentsFromOverlay;
    /**
     * Create jobs for a specific action
     */
    private createJobsForAction;
    /**
     * Create a new job
     */
    private createJob;
    /**
     * Process queued jobs
     */
    private processJobs;
    /**
     * Execute a specific job
     */
    private executeJob;
    private executeNotifyAction;
    private executeCoordinateAction;
    private executeDistributeAction;
    private executeBRC22Action;
    private executeBRC26Action;
    /**
     * Handle job failure with retry logic
     */
    private handleJobFailure;
    /**
     * Update job state and evidence
     */
    private updateJobState;
    /**
     * Start the job processor
     */
    private startJobProcessor;
    /**
     * Stop the job processor
     */
    stopJobProcessor(): void;
    /**
     * Set up overlay event listeners
     */
    private setupOverlayEventListeners;
    /**
     * Handle overlay network events
     */
    private handleOverlayEvent;
    /**
     * Subscribe rule to overlay topics
     */
    private subscribeRuleToTopics;
    /**
     * Load existing subscriptions from database
     */
    private loadSubscriptions;
    /**
     * Evaluate predicate expression
     */
    private evaluatePredicate;
    private getValue;
    getRule(ruleId: string): Promise<OverlayRule | null>;
    listRules(enabledOnly?: boolean): Promise<OverlayRule[]>;
    getJob(jobId: string): Promise<OverlayJob | null>;
    listJobs(filters?: {
        state?: string;
        ruleId?: string;
        agentId?: string;
    }): Promise<OverlayJob[]>;
    private updateRuleTriggerStats;
    private updateRuleExecutionStats;
    private recordRuleExecution;
    private mapRowToRule;
    private mapRowToJob;
    private generateRuleId;
    private generateJobId;
}
