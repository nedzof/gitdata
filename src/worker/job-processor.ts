/**
 * A2A Job Processor - Executes queued jobs from the agent marketplace
 * Handles notify actions and contract.generate simulation
 */

import Database from 'better-sqlite3';
import {
  getNextQueuedJob,
  updateJob,
  getAgent,
  type JobRow
} from '../db';
import { generateBRC31Headers } from '../brc31/signer';

export interface WorkerConfig {
  privateKey: string;         // AGENT_CALL_PRIVKEY - required for BRC-31 signing
  publicKey?: string;         // AGENT_CALL_PUBKEY - optional, derived from private key
  maxRetries: number;         // JOB_RETRY_MAX
  callbackTimeout: number;    // CALLBACK_TIMEOUT_MS
  pollInterval: number;       // How often to check for new jobs (ms)
}

export class JobProcessor {
  private db: Database.Database;
  private config: WorkerConfig;
  private running: boolean = false;
  private pollTimer?: NodeJS.Timeout;

  constructor(db: Database.Database, config: WorkerConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Start the job processor
   */
  start() {
    if (this.running) return;

    this.running = true;
    console.log('[worker] Starting job processor...');

    // Start processing immediately, then poll
    this.processJobs();
    this.pollTimer = setInterval(() => this.processJobs(), this.config.pollInterval);
  }

  /**
   * Stop the job processor
   */
  stop() {
    if (!this.running) return;

    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    console.log('[worker] Job processor stopped');
  }

  /**
   * Process all queued jobs
   */
  private async processJobs() {
    if (!this.running) return;

    try {
      let job: JobRow | null;
      while ((job = getNextQueuedJob(this.db))) {
        await this.processJob(job);
      }
    } catch (error) {
      console.error('[worker] Error processing jobs:', error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: JobRow) {
    const jobId = job.job_id;
    console.log(`[worker] Processing job ${jobId}`);

    try {
      // Mark job as running
      updateJob(this.db, jobId, {
        state: 'running',
        started_at: Math.floor(Date.now() / 1000)
      });

      // Parse job evidence to get actions
      const evidence = job.evidence_json ? JSON.parse(job.evidence_json) : {};
      const actions = evidence.actions || [];

      const results: any[] = [];

      // Execute each action
      for (const action of actions) {
        try {
          const result = await this.executeAction(action, evidence);
          results.push(result);
        } catch (error) {
          console.error(`[worker] Action ${action.action} failed:`, error);
          results.push({
            action: action.action,
            status: 'error',
            error: String(error)
          });
        }
      }

      // Update evidence with results
      const updatedEvidence = {
        ...evidence,
        actions: results,
        completedAt: Math.floor(Date.now() / 1000)
      };

      // Check if all actions succeeded
      const allSucceeded = results.every(r => r.status && r.status < 300);

      updateJob(this.db, jobId, {
        state: allSucceeded ? 'done' : 'dead',
        completed_at: Math.floor(Date.now() / 1000),
        evidence_json: JSON.stringify(updatedEvidence),
        last_error: allSucceeded ? null : 'Some actions failed'
      });

      console.log(`[worker] Job ${jobId} completed: ${allSucceeded ? 'success' : 'failed'}`);

    } catch (error) {
      await this.handleJobError(job, error);
    }
  }

  /**
   * Execute a specific action
   */
  private async executeAction(action: any, evidence: any): Promise<any> {
    switch (action.action) {
      case 'notify':
        return await this.executeNotify(action, evidence);

      case 'contract.generate':
        return await this.executeContractGenerate(action, evidence);

      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }

  /**
   * Execute notify action - send BRC-31 signed webhook to agent
   */
  private async executeNotify(action: any, evidence: any): Promise<any> {
    const { agentId } = action;

    if (!agentId) {
      throw new Error('notify action requires agentId');
    }

    // Get agent details
    const agent = getAgent(this.db, agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Prepare webhook payload
    const payload = {
      action: 'notify',
      agentId: agentId,
      trigger: evidence.trigger || 'rule',
      manifest: evidence.manifest || null,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const body = JSON.stringify(payload);

    // Generate BRC-31 signature headers
    const headers = generateBRC31Headers(this.config.privateKey, body);

    // Make webhook call
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.callbackTimeout);

    try {
      const response = await fetch(agent.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers
        },
        body: body,
        signal: controller.signal
      });

      clearTimeout(timeout);

      const responseBody = await response.text();
      let parsedBody: any;

      try {
        parsedBody = JSON.parse(responseBody);
      } catch {
        parsedBody = { raw: responseBody };
      }

      return {
        action: 'notify',
        agentId: agentId,
        status: response.status,
        headers: Object.fromEntries(Array.from(response.headers.entries())),
        body: parsedBody,
        timestamp: Math.floor(Date.now() / 1000)
      };

    } catch (error) {
      clearTimeout(timeout);
      throw new Error(`Webhook call failed: ${error}`);
    }
  }

  /**
   * Execute contract.generate action (simulated for demo)
   */
  private async executeContractGenerate(action: any, evidence: any): Promise<any> {
    // Simulate contract generation
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      action: 'contract.generate',
      status: 200,
      contractId: 'contract_' + Math.random().toString(36).substring(2, 15),
      terms: {
        manifest: evidence.manifest,
        generated_at: Math.floor(Date.now() / 1000),
        type: 'simulated'
      },
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Handle job execution error with retry logic
   */
  private async handleJobError(job: JobRow, error: any) {
    const jobId = job.job_id;
    const retryCount = (job.retry_count || 0) + 1;

    console.error(`[worker] Job ${jobId} failed (attempt ${retryCount}):`, error);

    if (retryCount >= this.config.maxRetries) {
      // Mark as dead - no more retries
      updateJob(this.db, jobId, {
        state: 'dead',
        completed_at: Math.floor(Date.now() / 1000),
        retry_count: retryCount,
        last_error: String(error)
      });
      console.log(`[worker] Job ${jobId} marked as dead after ${retryCount} attempts`);
    } else {
      // Reset to queued for retry with exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);

      setTimeout(() => {
        updateJob(this.db, jobId, {
          state: 'queued',
          retry_count: retryCount,
          last_error: String(error)
        });
        console.log(`[worker] Job ${jobId} requeued for retry ${retryCount} after ${backoffMs}ms`);
      }, backoffMs);
    }
  }
}

/**
 * Create and configure job processor from environment variables
 */
export function createJobProcessor(db: Database.Database): JobProcessor {
  const privateKey = process.env.AGENT_CALL_PRIVKEY;
  if (!privateKey) {
    throw new Error('AGENT_CALL_PRIVKEY environment variable is required');
  }

  const config: WorkerConfig = {
    privateKey,
    publicKey: process.env.AGENT_CALL_PUBKEY,
    maxRetries: parseInt(process.env.JOB_RETRY_MAX || '3'),
    callbackTimeout: parseInt(process.env.CALLBACK_TIMEOUT_MS || '8000'),
    pollInterval: parseInt(process.env.JOB_POLL_INTERVAL_MS || '2000')
  };

  return new JobProcessor(db, config);
}