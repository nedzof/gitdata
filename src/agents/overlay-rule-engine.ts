// D24 Overlay Rule Engine
// Event-driven rule processing with BRC-22 job orchestration

import { EventEmitter } from 'events';

import type { PostgreSQLBRC22SubmitService } from '../overlay/brc-services-postgresql';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';

import type { OverlayAgentRegistry, OverlayAgent } from './overlay-agent-registry';

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
  schedule?: string; // Cron expression for scheduled rules
}

export interface FindStrategy {
  source: 'overlay-search' | 'agent-registry' | 'capability-lookup';
  topics?: string[];
  query?: any;
  requireAll?: string[]; // Require all specified capabilities
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

export class OverlayRuleEngine extends EventEmitter {
  private database: DatabaseAdapter;
  private brc22Service: PostgreSQLBRC22SubmitService;
  private agentRegistry: OverlayAgentRegistry;
  private processingInterval: NodeJS.Timeout | null = null;
  private subscriptions = new Map<string, Set<string>>(); // topic -> set of ruleIds

  constructor(
    database: DatabaseAdapter,
    brc22Service: PostgreSQLBRC22SubmitService,
    agentRegistry: OverlayAgentRegistry,
  ) {
    super();
    this.database = database;
    this.brc22Service = brc22Service;
    this.agentRegistry = agentRegistry;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.setupDatabase();
    await this.loadSubscriptions();
    this.startJobProcessor();
    this.setupOverlayEventListeners();
  }

  private async setupDatabase(): Promise<void> {
    // Enhanced rules with overlay integration
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS overlay_rules (
        rule_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        overlay_topics TEXT[],
        when_condition JSONB NOT NULL,
        find_strategy JSONB NOT NULL,
        actions JSONB NOT NULL,
        owner_producer_id TEXT,
        execution_stats JSONB DEFAULT '{"totalTriggers":0,"successfulExecutions":0,"failedExecutions":0,"avgExecutionTime":0,"successRate":0}'::jsonb,
        last_triggered_at BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Enhanced jobs with overlay coordination
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS overlay_jobs (
        job_id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        target_id TEXT,
        overlay_transaction_id TEXT,
        state TEXT NOT NULL DEFAULT 'queued',
        assigned_agents TEXT[],
        coordination_data JSONB,
        attempts INTEGER DEFAULT 0,
        next_run_at BIGINT NOT NULL,
        last_error TEXT,
        evidence_package JSONB,
        lineage_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Rule execution history
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS rule_executions (
        id SERIAL PRIMARY KEY,
        rule_id TEXT NOT NULL,
        trigger_event JSONB,
        found_agents JSONB,
        created_jobs JSONB,
        execution_time_ms INTEGER,
        success BOOLEAN,
        error_message TEXT,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_overlay_rules_topics ON overlay_rules USING GIN(overlay_topics);
      CREATE INDEX IF NOT EXISTS idx_overlay_rules_enabled ON overlay_rules(enabled);
      CREATE INDEX IF NOT EXISTS idx_overlay_jobs_state ON overlay_jobs(state, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_overlay_jobs_rule ON overlay_jobs(rule_id);
      CREATE INDEX IF NOT EXISTS idx_overlay_jobs_agents ON overlay_jobs USING GIN(assigned_agents);
      CREATE INDEX IF NOT EXISTS idx_rule_executions_rule ON rule_executions(rule_id, executed_at);
    `);
  }

  /**
   * Create a new overlay rule
   */
  async createRule(ruleData: {
    name: string;
    overlayTopics?: string[];
    whenCondition: RuleCondition;
    findStrategy: FindStrategy;
    actions: RuleAction[];
    ownerProducerId?: string;
  }): Promise<OverlayRule> {
    const ruleId = this.generateRuleId();
    const now = Date.now();

    const rule: OverlayRule = {
      ruleId,
      name: ruleData.name,
      enabled: true,
      overlayTopics: ruleData.overlayTopics || [],
      whenCondition: ruleData.whenCondition,
      findStrategy: ruleData.findStrategy,
      actions: ruleData.actions,
      ownerProducerId: ruleData.ownerProducerId,
      executionStats: {
        totalTriggers: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0,
        successRate: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.database.execute(
      `
      INSERT INTO overlay_rules
      (rule_id, name, overlay_topics, when_condition, find_strategy, actions, owner_producer_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      [
        rule.ruleId,
        rule.name,
        rule.overlayTopics,
        JSON.stringify(rule.whenCondition),
        JSON.stringify(rule.findStrategy),
        JSON.stringify(rule.actions),
        rule.ownerProducerId,
        new Date(rule.createdAt),
        new Date(rule.updatedAt),
      ],
    );

    // Subscribe to overlay topics
    if (rule.overlayTopics.length > 0) {
      await this.subscribeRuleToTopics(rule.ruleId, rule.overlayTopics);
    }

    this.emit('rule-created', rule);
    return rule;
  }

  /**
   * Trigger rule execution manually
   */
  async triggerRule(ruleId: string, triggerEvent?: any): Promise<string[]> {
    const rule = await this.getRule(ruleId);
    if (!rule || !rule.enabled) {
      throw new Error('Rule not found or disabled');
    }

    return this.executeRule(rule, triggerEvent || { type: 'manual', timestamp: Date.now() });
  }

  /**
   * Execute rule and create jobs
   */
  private async executeRule(rule: OverlayRule, triggerEvent: any): Promise<string[]> {
    const startTime = Date.now();
    let success = false;
    const createdJobs: string[] = [];

    try {
      // Update rule trigger stats
      await this.updateRuleTriggerStats(rule.ruleId);

      // Evaluate predicate if present
      if (
        rule.whenCondition.predicate &&
        !this.evaluatePredicate(rule.whenCondition.predicate, triggerEvent)
      ) {
        console.log(`[RULE-ENGINE] Rule ${rule.ruleId} predicate not satisfied`);
        return [];
      }

      // Find agents based on strategy
      const foundAgents = await this.findAgentsForRule(rule, triggerEvent);

      if (foundAgents.length === 0) {
        console.log(`[RULE-ENGINE] No agents found for rule ${rule.ruleId}`);
        return [];
      }

      // Create jobs for each action
      for (const action of rule.actions) {
        const jobIds = await this.createJobsForAction(rule, action, foundAgents, triggerEvent);
        createdJobs.push(...jobIds);
      }

      success = true;

      // Record successful execution
      await this.recordRuleExecution(rule.ruleId, {
        triggerEvent,
        foundAgents: foundAgents.map((a) => ({
          agentId: a.agentId,
          name: a.name,
          capabilities: a.capabilities.map((c) => c.name),
        })),
        createdJobs,
        executionTimeMs: Date.now() - startTime,
        success: true,
      });

      this.emit('rule-executed', { ruleId: rule.ruleId, jobIds: createdJobs, triggerEvent });
    } catch (error) {
      console.error(`[RULE-ENGINE] Rule execution failed for ${rule.ruleId}:`, error);

      await this.recordRuleExecution(rule.ruleId, {
        triggerEvent,
        foundAgents: [],
        createdJobs: [],
        executionTimeMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      });

      this.emit('rule-execution-failed', { ruleId: rule.ruleId, error, triggerEvent });
    }

    // Update rule execution stats
    await this.updateRuleExecutionStats(rule.ruleId, Date.now() - startTime, success);

    return createdJobs;
  }

  /**
   * Find agents based on rule's find strategy
   */
  private async findAgentsForRule(rule: OverlayRule, triggerEvent: any): Promise<OverlayAgent[]> {
    const { findStrategy } = rule;
    let foundAgents: OverlayAgent[] = [];

    switch (findStrategy.source) {
      case 'agent-registry':
        foundAgents = await this.findAgentsFromRegistry(findStrategy, triggerEvent);
        break;

      case 'capability-lookup':
        foundAgents = await this.findAgentsByCapability(findStrategy, triggerEvent);
        break;

      case 'overlay-search':
        foundAgents = await this.findAgentsFromOverlay(findStrategy, triggerEvent);
        break;

      default:
        console.warn(`[RULE-ENGINE] Unknown find strategy: ${findStrategy.source}`);
    }

    // Apply limits
    if (findStrategy.limit && foundAgents.length > findStrategy.limit) {
      foundAgents = foundAgents.slice(0, findStrategy.limit);
    }

    return foundAgents;
  }

  private async findAgentsFromRegistry(
    strategy: FindStrategy,
    triggerEvent: any,
  ): Promise<OverlayAgent[]> {
    const query: any = { ...(strategy.query || {}) };

    // Add capability requirements
    if (strategy.requireAll) {
      // Find agents that have ALL required capabilities
      const agents = await this.agentRegistry.searchAgents(query);
      return agents.filter((agent) =>
        strategy.requireAll!.every((requiredCap) =>
          agent.capabilities.some((cap) => cap.name === requiredCap),
        ),
      );
    }

    return this.agentRegistry.searchAgents(query);
  }

  private async findAgentsByCapability(
    strategy: FindStrategy,
    triggerEvent: any,
  ): Promise<OverlayAgent[]> {
    const capability = strategy.query?.capability;
    if (!capability) return [];

    return this.agentRegistry.searchAgents({
      capability,
      region: strategy.query?.region,
      minReputation: strategy.query?.minReputation || 0.5,
      limit: strategy.limit,
    });
  }

  private async findAgentsFromOverlay(
    strategy: FindStrategy,
    triggerEvent: any,
  ): Promise<OverlayAgent[]> {
    // In a full implementation, this would query the overlay network
    // For now, fall back to registry search
    return this.findAgentsFromRegistry(strategy, triggerEvent);
  }

  /**
   * Create jobs for a specific action
   */
  private async createJobsForAction(
    rule: OverlayRule,
    action: RuleAction,
    agents: OverlayAgent[],
    triggerEvent: any,
  ): Promise<string[]> {
    const jobIds: string[] = [];

    // Determine which agents can handle this action
    const eligibleAgents = agents.filter(
      (agent) =>
        !action.capability || agent.capabilities.some((cap) => cap.name === action.capability),
    );

    if (eligibleAgents.length === 0) {
      console.warn(`[RULE-ENGINE] No eligible agents for action ${action.action}`);
      return [];
    }

    // Handle different action types
    switch (action.action) {
      case 'overlay.notify':
      case 'overlay.discover':
      case 'notify':
        // Create individual jobs for each agent
        for (const agent of eligibleAgents) {
          const jobId = await this.createJob({
            ruleId: rule.ruleId,
            targetId: triggerEvent.targetId || triggerEvent.datasetId,
            assignedAgents: [agent.agentId],
            coordinationData: {
              action: action.action,
              payload: action.payload,
              timeout: action.timeout || 30000,
            },
          });
          jobIds.push(jobId);
        }
        break;

      case 'overlay.coordinate': {
        // Create coordinated multi-agent job
        const jobId = await this.createJob({
          ruleId: rule.ruleId,
          targetId: triggerEvent.targetId || triggerEvent.datasetId,
          assignedAgents: eligibleAgents.map((a) => a.agentId),
          coordinationData: {
            action: action.action,
            workflow: action.workflow || 'parallel',
            steps: action.steps || [],
            timeout: action.timeout || 60000,
          },
        });
        jobIds.push(jobId);
        break;
      }

      case 'overlay.distribute': {
        // Distribute work among multiple agents
        const chunkSize = Math.ceil(eligibleAgents.length / (action.parallelism || 5));
        for (let i = 0; i < eligibleAgents.length; i += chunkSize) {
          const agentChunk = eligibleAgents.slice(i, i + chunkSize);
          const jobId = await this.createJob({
            ruleId: rule.ruleId,
            targetId: triggerEvent.targetId || triggerEvent.datasetId,
            assignedAgents: agentChunk.map((a) => a.agentId),
            coordinationData: {
              action: action.action,
              chunkIndex: Math.floor(i / chunkSize),
              totalChunks: Math.ceil(eligibleAgents.length / chunkSize),
              parallelism: action.parallelism,
            },
          });
          jobIds.push(jobId);
        }
        break;
      }

      case 'brc22.submit': {
        // Submit transaction via BRC-22
        const txJobId = await this.createJob({
          ruleId: rule.ruleId,
          targetId: triggerEvent.targetId || triggerEvent.datasetId,
          assignedAgents: [], // System job, no agents needed
          coordinationData: {
            action: action.action,
            topic: action.topic,
            transaction: action.transaction,
          },
        });
        jobIds.push(txJobId);
        break;
      }

      case 'brc26.store': {
        // Store artifact via BRC-26
        const storeJobId = await this.createJob({
          ruleId: rule.ruleId,
          targetId: triggerEvent.targetId || triggerEvent.datasetId,
          assignedAgents: [], // System job
          coordinationData: {
            action: action.action,
            type: action.type,
            templateId: action.templateId,
            variables: action.variables,
          },
        });
        jobIds.push(storeJobId);
        break;
      }

      default:
        console.warn(`[RULE-ENGINE] Unknown action type: ${action.action}`);
    }

    return jobIds;
  }

  /**
   * Create a new job
   */
  private async createJob(jobData: {
    ruleId: string;
    targetId?: string;
    assignedAgents: string[];
    coordinationData?: any;
    delaySeconds?: number;
  }): Promise<string> {
    const jobId = this.generateJobId();
    const now = Date.now();
    const nextRunAt = now + (jobData.delaySeconds || 0) * 1000;

    await this.database.execute(
      `
      INSERT INTO overlay_jobs
      (job_id, rule_id, target_id, state, assigned_agents, coordination_data, next_run_at, created_at, updated_at)
      VALUES ($1, $2, $3, 'queued', $4, $5, $6, $7, $8)
    `,
      [
        jobId,
        jobData.ruleId,
        jobData.targetId,
        jobData.assignedAgents,
        jobData.coordinationData ? JSON.stringify(jobData.coordinationData) : null,
        Math.floor(nextRunAt / 1000),
        new Date(now),
        new Date(now),
      ],
    );

    this.emit('job-created', {
      jobId,
      ruleId: jobData.ruleId,
      assignedAgents: jobData.assignedAgents,
    });
    return jobId;
  }

  /**
   * Process queued jobs
   */
  private async processJobs(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // Claim next available job
    const result = await this.database.query(
      `
      UPDATE overlay_jobs
      SET state = 'running', updated_at = $1
      WHERE job_id = (
        SELECT job_id FROM overlay_jobs
        WHERE state = 'queued' AND next_run_at <= $2
        ORDER BY next_run_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `,
      [new Date(), now],
    );

    if (result.length === 0) return; // No jobs to process

    const job = this.mapRowToJob(result[0]);

    try {
      await this.executeJob(job);
    } catch (error) {
      console.error(`[RULE-ENGINE] Job execution failed for ${job.jobId}:`, error);
      await this.handleJobFailure(job, error.message);
    }
  }

  /**
   * Execute a specific job
   */
  private async executeJob(job: OverlayJob): Promise<void> {
    const coordinationData = job.coordinationData || {};
    const action = coordinationData.action;

    console.log(`[RULE-ENGINE] Executing job ${job.jobId} with action ${action}`);

    switch (action) {
      case 'overlay.notify':
      case 'notify':
        await this.executeNotifyAction(job);
        break;

      case 'overlay.coordinate':
        await this.executeCoordinateAction(job);
        break;

      case 'overlay.distribute':
        await this.executeDistributeAction(job);
        break;

      case 'brc22.submit':
        await this.executeBRC22Action(job);
        break;

      case 'brc26.store':
        await this.executeBRC26Action(job);
        break;

      default:
        throw new Error(`Unknown action type: ${action}`);
    }

    // Mark job as completed
    await this.updateJobState(job.jobId, 'done', {
      completedAt: Date.now(),
      executedActions: [action],
    });
  }

  private async executeNotifyAction(job: OverlayJob): Promise<void> {
    // In a full implementation, this would call agent webhooks
    // For now, just simulate the notification
    console.log(`[RULE-ENGINE] Notifying agents:`, job.assignedAgents);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async executeCoordinateAction(job: OverlayJob): Promise<void> {
    const { workflow, steps } = job.coordinationData;

    if (workflow === 'sequential') {
      // Execute steps in sequence
      for (const step of steps || []) {
        console.log(`[RULE-ENGINE] Executing sequential step:`, step);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } else {
      // Execute in parallel (default)
      console.log(`[RULE-ENGINE] Executing parallel coordination for agents:`, job.assignedAgents);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async executeDistributeAction(job: OverlayJob): Promise<void> {
    const { chunkIndex, totalChunks } = job.coordinationData;
    console.log(`[RULE-ENGINE] Executing distributed job chunk ${chunkIndex + 1}/${totalChunks}`);

    // Simulate distributed processing
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  private async executeBRC22Action(job: OverlayJob): Promise<void> {
    const { topic, transaction } = job.coordinationData;

    // Submit transaction via BRC-22
    const submission = await this.brc22Service.processSubmission({
      rawTx: '01000000' + '00'.repeat(60), // Mock transaction
      inputs: {},
      topics: [topic],
      mapiResponses: [],
    });

    if (submission.status !== 'success') {
      throw new Error(`BRC-22 submission failed: ${submission.error?.description}`);
    }

    // Update job with transaction ID
    await this.updateJobState(job.jobId, 'running', {
      overlayTransactionId: 'tx_' + Date.now().toString(16),
    });
  }

  private async executeBRC26Action(job: OverlayJob): Promise<void> {
    const { type, templateId, variables } = job.coordinationData;

    // In a full implementation, this would store artifacts via BRC-26
    console.log(`[RULE-ENGINE] Storing ${type} artifact with template ${templateId}`);

    // Simulate artifact storage
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Update job with artifact hash
    await this.updateJobState(job.jobId, 'running', {
      artifactHash: 'brc26_' + Date.now().toString(16),
    });
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(job: OverlayJob, errorMessage: string): Promise<void> {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second
    const backoffFactor = 2;

    if (job.attempts >= maxRetries) {
      // Move to dead letter queue
      await this.updateJobState(job.jobId, 'dead', null, errorMessage);
      this.emit('job-dead', { jobId: job.jobId, error: errorMessage });
    } else {
      // Schedule retry with exponential backoff
      const delay = baseDelay * Math.pow(backoffFactor, job.attempts);
      const nextRunAt = Math.floor((Date.now() + delay) / 1000);

      await this.database.execute(
        `
        UPDATE overlay_jobs
        SET state = 'queued', attempts = attempts + 1, next_run_at = $1, last_error = $2, updated_at = $3
        WHERE job_id = $4
      `,
        [nextRunAt, errorMessage, new Date(), job.jobId],
      );

      this.emit('job-retry-scheduled', { jobId: job.jobId, attempt: job.attempts + 1, delay });
    }
  }

  /**
   * Update job state and evidence
   */
  private async updateJobState(
    jobId: string,
    state: OverlayJob['state'],
    evidenceUpdate?: any,
    error?: string,
  ): Promise<void> {
    let sql = 'UPDATE overlay_jobs SET state = $1, updated_at = $2';
    const params: any[] = [state, new Date()];

    if (evidenceUpdate) {
      sql +=
        ", evidence_package = COALESCE(evidence_package, '{}'::jsonb) || $" + (params.length + 1);
      params.push(JSON.stringify(evidenceUpdate));
    }

    if (error) {
      sql += ', last_error = $' + (params.length + 1);
      params.push(error);
    }

    sql += ' WHERE job_id = $' + (params.length + 1);
    params.push(jobId);

    await this.database.execute(sql, params);

    this.emit('job-state-updated', { jobId, state, evidenceUpdate, error });
  }

  /**
   * Start the job processor
   */
  private startJobProcessor(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(async () => {
      try {
        await this.processJobs();
      } catch (error) {
        console.error('[RULE-ENGINE] Job processing error:', error);
      }
    }, 1000); // Process jobs every second

    console.log('[RULE-ENGINE] Job processor started');
  }

  /**
   * Stop the job processor
   */
  stopJobProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('[RULE-ENGINE] Job processor stopped');
    }
  }

  /**
   * Set up overlay event listeners
   */
  private setupOverlayEventListeners(): void {
    // Listen for BRC-22 events
    this.brc22Service.on('manifest-utxo-admitted', async (event) => {
      await this.handleOverlayEvent('gitdata.d01a.manifest', event);
    });

    this.brc22Service.on('transaction-processed', async (event) => {
      await this.handleOverlayEvent('gitdata.transaction.processed', event);
    });
  }

  /**
   * Handle overlay network events
   */
  private async handleOverlayEvent(topic: string, eventData: any): Promise<void> {
    const subscribedRules = this.subscriptions.get(topic);
    if (!subscribedRules || subscribedRules.size === 0) return;

    console.log(
      `[RULE-ENGINE] Processing overlay event for topic ${topic}, ${subscribedRules.size} rules subscribed`,
    );

    for (const ruleId of subscribedRules) {
      try {
        const rule = await this.getRule(ruleId);
        if (rule && rule.enabled) {
          await this.executeRule(rule, { ...eventData, topic, timestamp: Date.now() });
        }
      } catch (error) {
        console.error(`[RULE-ENGINE] Failed to process overlay event for rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Subscribe rule to overlay topics
   */
  private async subscribeRuleToTopics(ruleId: string, topics: string[]): Promise<void> {
    for (const topic of topics) {
      if (!this.subscriptions.has(topic)) {
        this.subscriptions.set(topic, new Set());
      }
      this.subscriptions.get(topic)!.add(ruleId);
    }
  }

  /**
   * Load existing subscriptions from database
   */
  private async loadSubscriptions(): Promise<void> {
    const rules = await this.database.query(`
      SELECT rule_id, overlay_topics FROM overlay_rules WHERE enabled = true
    `);

    for (const row of rules) {
      const topics = row.overlay_topics || [];
      await this.subscribeRuleToTopics(row.rule_id, topics);
    }

    console.log(`[RULE-ENGINE] Loaded ${rules.length} rule subscriptions`);
  }

  /**
   * Evaluate predicate expression
   */
  private evaluatePredicate(predicate: PredicateExpression, context: any): boolean {
    if (predicate.and) {
      return predicate.and.every((p) => this.evaluatePredicate(p, context));
    }
    if (predicate.or) {
      return predicate.or.some((p) => this.evaluatePredicate(p, context));
    }
    if (predicate.not) {
      return !this.evaluatePredicate(predicate.not, context);
    }
    if (predicate.eq) {
      return Object.entries(predicate.eq).every(
        ([key, value]) => this.getValue(context, key) === value,
      );
    }
    if (predicate.gt) {
      return Object.entries(predicate.gt).every(
        ([key, value]) => this.getValue(context, key) > value,
      );
    }
    if (predicate.gte) {
      return Object.entries(predicate.gte).every(
        ([key, value]) => this.getValue(context, key) >= value,
      );
    }
    if (predicate.lt) {
      return Object.entries(predicate.lt).every(
        ([key, value]) => this.getValue(context, key) < value,
      );
    }
    if (predicate.lte) {
      return Object.entries(predicate.lte).every(
        ([key, value]) => this.getValue(context, key) <= value,
      );
    }
    if (predicate.includes) {
      return Object.entries(predicate.includes).every(([key, value]) => {
        const val = this.getValue(context, key);
        if (Array.isArray(val)) {
          return val.some((item) =>
            String(item).toLowerCase().includes(String(value).toLowerCase()),
          );
        }
        if (typeof val === 'string') {
          return val.toLowerCase().includes(String(value).toLowerCase());
        }
        return false;
      });
    }
    return true;
  }

  private getValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Helper methods for database operations
  async getRule(ruleId: string): Promise<OverlayRule | null> {
    const results = await this.database.query(
      `
      SELECT rule_id, name, enabled, overlay_topics, when_condition, find_strategy, actions,
             owner_producer_id, execution_stats, last_triggered_at,
             EXTRACT(EPOCH FROM created_at) * 1000 as created_at,
             EXTRACT(EPOCH FROM updated_at) * 1000 as updated_at
      FROM overlay_rules WHERE rule_id = $1
    `,
      [ruleId],
    );

    if (results.length === 0) return null;
    return this.mapRowToRule(results[0]);
  }

  async listRules(enabledOnly: boolean = false): Promise<OverlayRule[]> {
    const sql = `
      SELECT rule_id, name, enabled, overlay_topics, when_condition, find_strategy, actions,
             owner_producer_id, execution_stats, last_triggered_at,
             EXTRACT(EPOCH FROM created_at) * 1000 as created_at,
             EXTRACT(EPOCH FROM updated_at) * 1000 as updated_at
      FROM overlay_rules
      ${enabledOnly ? 'WHERE enabled = true' : ''}
      ORDER BY updated_at DESC
    `;

    const results = await this.database.query(sql);
    return results.map((row) => this.mapRowToRule(row));
  }

  async getJob(jobId: string): Promise<OverlayJob | null> {
    const results = await this.database.query(
      `
      SELECT job_id, rule_id, target_id, overlay_transaction_id, state, assigned_agents,
             coordination_data, attempts, next_run_at, last_error, evidence_package, lineage_data,
             EXTRACT(EPOCH FROM created_at) * 1000 as created_at,
             EXTRACT(EPOCH FROM updated_at) * 1000 as updated_at
      FROM overlay_jobs WHERE job_id = $1
    `,
      [jobId],
    );

    if (results.length === 0) return null;
    return this.mapRowToJob(results[0]);
  }

  async listJobs(
    filters: { state?: string; ruleId?: string; agentId?: string } = {},
  ): Promise<OverlayJob[]> {
    let sql = `
      SELECT job_id, rule_id, target_id, overlay_transaction_id, state, assigned_agents,
             coordination_data, attempts, next_run_at, last_error, evidence_package, lineage_data,
             EXTRACT(EPOCH FROM created_at) * 1000 as created_at,
             EXTRACT(EPOCH FROM updated_at) * 1000 as updated_at
      FROM overlay_jobs WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.state) {
      sql += ` AND state = $${params.length + 1}`;
      params.push(filters.state);
    }

    if (filters.ruleId) {
      sql += ` AND rule_id = $${params.length + 1}`;
      params.push(filters.ruleId);
    }

    if (filters.agentId) {
      sql += ` AND $${params.length + 1} = ANY(assigned_agents)`;
      params.push(filters.agentId);
    }

    sql += ` ORDER BY updated_at DESC LIMIT 100`;

    const results = await this.database.query(sql, params);
    return results.map((row) => this.mapRowToJob(row));
  }

  private async updateRuleTriggerStats(ruleId: string): Promise<void> {
    await this.database.execute(
      `
      UPDATE overlay_rules
      SET execution_stats = jsonb_set(execution_stats, '{totalTriggers}', (COALESCE((execution_stats->>'totalTriggers')::int, 0) + 1)::text::jsonb),
          last_triggered_at = $1,
          updated_at = $2
      WHERE rule_id = $3
    `,
      [Math.floor(Date.now() / 1000), new Date(), ruleId],
    );
  }

  private async updateRuleExecutionStats(
    ruleId: string,
    executionTimeMs: number,
    success: boolean,
  ): Promise<void> {
    // Update execution statistics
    const successField = success ? 'successfulExecutions' : 'failedExecutions';

    await this.database.execute(
      `
      UPDATE overlay_rules
      SET execution_stats = jsonb_set(
            jsonb_set(
              jsonb_set(execution_stats, '{${successField}}', (COALESCE((execution_stats->>'${successField}')::int, 0) + 1)::text::jsonb),
              '{lastExecutionTime}', $1::text::jsonb
            ),
            '{avgExecutionTime}', CASE
              WHEN (execution_stats->>'totalTriggers')::int > 1 THEN
                (((COALESCE((execution_stats->>'avgExecutionTime')::int, 0) * ((execution_stats->>'totalTriggers')::int - 1)) + $1) / (execution_stats->>'totalTriggers')::int)::text::jsonb
              ELSE $1::text::jsonb
            END
          ),
          updated_at = $2
      WHERE rule_id = $3
    `,
      [executionTimeMs, new Date(), ruleId],
    );

    // Calculate and update success rate
    await this.database.execute(
      `
      UPDATE overlay_rules
      SET execution_stats = jsonb_set(execution_stats, '{successRate}',
        CASE
          WHEN (execution_stats->>'totalTriggers')::int > 0 THEN
            ((execution_stats->>'successfulExecutions')::decimal / (execution_stats->>'totalTriggers')::decimal)::text::jsonb
          ELSE '0'::jsonb
        END
      )
      WHERE rule_id = $1
    `,
      [ruleId],
    );
  }

  private async recordRuleExecution(ruleId: string, execution: any): Promise<void> {
    await this.database.execute(
      `
      INSERT INTO rule_executions
      (rule_id, trigger_event, found_agents, created_jobs, execution_time_ms, success, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
      [
        ruleId,
        JSON.stringify(execution.triggerEvent),
        JSON.stringify(execution.foundAgents),
        JSON.stringify(execution.createdJobs),
        execution.executionTimeMs,
        execution.success,
        execution.errorMessage || null,
      ],
    );
  }

  private mapRowToRule(row: any): OverlayRule {
    return {
      ruleId: row.rule_id,
      name: row.name,
      enabled: row.enabled,
      overlayTopics: row.overlay_topics || [],
      whenCondition:
        typeof row.when_condition === 'string'
          ? JSON.parse(row.when_condition)
          : row.when_condition,
      findStrategy:
        typeof row.find_strategy === 'string' ? JSON.parse(row.find_strategy) : row.find_strategy,
      actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
      ownerProducerId: row.owner_producer_id,
      executionStats:
        typeof row.execution_stats === 'string'
          ? JSON.parse(row.execution_stats)
          : row.execution_stats || {
              totalTriggers: 0,
              successfulExecutions: 0,
              failedExecutions: 0,
              avgExecutionTime: 0,
              successRate: 0,
            },
      lastTriggeredAt: row.last_triggered_at ? parseInt(row.last_triggered_at) * 1000 : undefined,
      createdAt: parseInt(row.created_at),
      updatedAt: parseInt(row.updated_at),
    };
  }

  private mapRowToJob(row: any): OverlayJob {
    return {
      jobId: row.job_id,
      ruleId: row.rule_id,
      targetId: row.target_id,
      overlayTransactionId: row.overlay_transaction_id,
      state: row.state,
      assignedAgents: row.assigned_agents || [],
      coordinationData:
        typeof row.coordination_data === 'string'
          ? JSON.parse(row.coordination_data)
          : row.coordination_data,
      attempts: row.attempts,
      nextRunAt: parseInt(row.next_run_at) * 1000,
      lastError: row.last_error,
      evidencePackage:
        typeof row.evidence_package === 'string'
          ? JSON.parse(row.evidence_package)
          : row.evidence_package,
      lineageData:
        typeof row.lineage_data === 'string' ? JSON.parse(row.lineage_data) : row.lineage_data,
      createdAt: parseInt(row.created_at),
      updatedAt: parseInt(row.updated_at),
    };
  }

  private generateRuleId(): string {
    return 'rule_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  private generateJobId(): string {
    return 'job_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
}
