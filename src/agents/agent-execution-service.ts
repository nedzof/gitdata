// D24 Agent Execution Service
// BRC-31 identity verification and secure agent job execution

import { createHash } from 'crypto';
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

export class AgentExecutionService extends EventEmitter {
  private database: DatabaseAdapter;
  private webhookTimeoutMs: number;
  private requireIdentity: boolean;

  constructor(
    database: DatabaseAdapter,
    options: {
      webhookTimeoutMs?: number;
      requireIdentity?: boolean;
    } = {},
  ) {
    super();
    this.database = database;
    this.webhookTimeoutMs = options.webhookTimeoutMs || 15000;
    this.requireIdentity = options.requireIdentity ?? true;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.setupDatabase();
  }

  private async setupDatabase(): Promise<void> {
    // Agent execution history
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS agent_executions (
        id SERIAL PRIMARY KEY,
        job_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        identity_key TEXT,
        signature TEXT,
        nonce TEXT,
        artifacts JSONB,
        execution_time_ms INTEGER,
        success BOOLEAN,
        error_message TEXT,
        client_feedback JSONB,
        overlay_confirmation TEXT,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // BRC-31 signature verification logs
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS brc31_verifications (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        identity_key TEXT NOT NULL,
        message_hash TEXT NOT NULL,
        signature TEXT NOT NULL,
        nonce TEXT NOT NULL,
        verified BOOLEAN NOT NULL,
        verification_error TEXT,
        verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_agent_executions_job ON agent_executions(job_id);
      CREATE INDEX IF NOT EXISTS idx_agent_executions_agent ON agent_executions(agent_id, executed_at);
      CREATE INDEX IF NOT EXISTS idx_brc31_verifications_agent ON brc31_verifications(agent_id, verified_at);
    `);
  }

  /**
   * Execute agent job with BRC-31 identity verification
   */
  async executeAgentJob(
    job: OverlayJob,
    agent: OverlayAgent,
    payload: any,
  ): Promise<AgentExecution> {
    const startTime = Date.now();

    try {
      // Generate nonce for this execution
      const nonce = this.generateNonce();

      // Prepare webhook payload
      const webhookPayload: WebhookPayload = {
        type: this.getWebhookType(job),
        jobId: job.jobId,
        payload,
        timestamp: Date.now(),
      };

      // Call agent webhook with BRC-31 signature
      const webhookResponse = await this.callAgentWebhook(agent, webhookPayload, nonce);

      const executionTime = Date.now() - startTime;

      // Create execution record
      const execution: AgentExecution = {
        jobId: job.jobId,
        agentId: agent.agentId,
        identityKey: agent.identityKey,
        signature: '', // Will be set from webhook response verification
        nonce,
        artifacts: webhookResponse.artifacts || [],
        executionTime,
        success: webhookResponse.ok,
        errorMessage: webhookResponse.error,
        clientFeedback: webhookResponse.metadata,
      };

      // Store execution record
      await this.storeExecution(execution);

      // Emit execution event
      this.emit('agent-execution-completed', execution);

      return execution;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      const execution: AgentExecution = {
        jobId: job.jobId,
        agentId: agent.agentId,
        identityKey: agent.identityKey,
        signature: '',
        nonce: '',
        artifacts: [],
        executionTime,
        success: false,
        errorMessage: error.message,
      };

      await this.storeExecution(execution);
      this.emit('agent-execution-failed', { execution, error });

      throw error;
    }
  }

  /**
   * Call agent webhook with BRC-31 signed request
   */
  private async callAgentWebhook(
    agent: OverlayAgent,
    payload: WebhookPayload,
    nonce: string,
  ): Promise<WebhookResponse> {
    const body = JSON.stringify(payload);

    // Generate message hash for signing
    const messageHash = this.createMessageHash(body, nonce);

    // In production, this would use the system's private key to sign
    // For now, we'll simulate the signing process
    const signature = await this.signMessage(messageHash);

    // Prepare BRC-31 headers
    const headers: BRC31Headers & { [key: string]: string } = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Identity-Key': this.getSystemIdentityKey(),
      'X-Nonce': nonce,
      'X-Signature': signature,
    };

    // Make HTTP request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.webhookTimeoutMs);

    try {
      const response = await fetch(agent.webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      let responseData: WebhookResponse;

      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Invalid JSON response from agent webhook');
      }

      // Verify response signature if identity verification is required
      if (this.requireIdentity && agent.identityKey) {
        const responseHeaders = this.extractBRC31Headers(response.headers);
        if (responseHeaders) {
          const verified = await this.verifyBRC31Signature(
            agent.identityKey,
            responseText,
            responseHeaders,
          );

          if (!verified) {
            throw new Error('Agent response signature verification failed');
          }

          // Log successful verification
          await this.logBRC31Verification(agent.agentId, agent.identityKey, responseHeaders, true);
        } else if (this.requireIdentity) {
          throw new Error('Agent response missing required BRC-31 headers');
        }
      }

      return responseData;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Agent webhook timeout after ${this.webhookTimeoutMs}ms`);
      }

      throw error;
    }
  }

  /**
   * Verify BRC-31 signature
   */
  async verifyBRC31Signature(
    identityKey: string,
    message: string,
    headers: BRC31Headers,
  ): Promise<boolean> {
    try {
      // Recreate message hash
      const messageHash = this.createMessageHash(message, headers['X-Nonce']);

      // In production, use proper secp256k1 signature verification
      // For now, simulate verification
      const isValid = await this.verifySignature(messageHash, headers['X-Signature'], identityKey);

      // Log verification attempt
      await this.logBRC31Verification(
        identityKey, // Using as agent ID for logging
        identityKey,
        headers,
        isValid,
        isValid ? undefined : 'Signature verification failed',
      );

      return isValid;
    } catch (error) {
      // Log verification failure
      await this.logBRC31Verification(identityKey, identityKey, headers, false, error.message);

      return false;
    }
  }

  /**
   * Process agent execution result
   */
  async processExecutionResult(
    jobId: string,
    agentId: string,
    result: {
      signature: string;
      nonce: string;
      artifacts: ExecutionArtifact[];
      success: boolean;
      executionTime?: number;
      error?: string;
      clientFeedback?: any;
    },
  ): Promise<void> {
    // Verify the execution signature if identity verification is enabled
    if (this.requireIdentity) {
      const agent = await this.getAgentFromDatabase(agentId);
      if (agent?.identityKey) {
        const messageHash = this.createMessageHash(
          JSON.stringify({ jobId, agentId, result: result.artifacts }),
          result.nonce,
        );

        const verified = await this.verifySignature(
          messageHash,
          result.signature,
          agent.identityKey,
        );

        if (!verified) {
          throw new Error('Execution result signature verification failed');
        }
      }
    }

    // Store execution record
    const execution: AgentExecution = {
      jobId,
      agentId,
      signature: result.signature,
      nonce: result.nonce,
      artifacts: result.artifacts,
      executionTime: result.executionTime || 0,
      success: result.success,
      errorMessage: result.error,
      clientFeedback: result.clientFeedback,
    };

    await this.storeExecution(execution);

    // Process artifacts if any
    if (result.artifacts.length > 0) {
      await this.processExecutionArtifacts(jobId, result.artifacts);
    }

    this.emit('execution-result-processed', { jobId, agentId, execution });
  }

  /**
   * Process execution artifacts (store via BRC-26 if needed)
   */
  private async processExecutionArtifacts(
    jobId: string,
    artifacts: ExecutionArtifact[],
  ): Promise<void> {
    for (const artifact of artifacts) {
      try {
        // If artifact has URL but no hash, we might want to fetch and store it
        if (artifact.url && !artifact.hash) {
          // In production, fetch the artifact and store via BRC-26
          console.log(`[AGENT-EXECUTION] Processing artifact: ${artifact.url}`);
        }

        // Log artifact processing
        this.emit('artifact-processed', { jobId, artifact });
      } catch (error) {
        console.error(`[AGENT-EXECUTION] Failed to process artifact:`, error);
        this.emit('artifact-processing-failed', { jobId, artifact, error });
      }
    }
  }

  /**
   * Get agent execution history
   */
  async getAgentExecutionHistory(agentId: string, limit: number = 50): Promise<AgentExecution[]> {
    const results = await this.database.query(
      `
      SELECT job_id, agent_id, identity_key, signature, nonce, artifacts,
             execution_time_ms, success, error_message, client_feedback,
             EXTRACT(EPOCH FROM executed_at) * 1000 as executed_at
      FROM agent_executions
      WHERE agent_id = $1
      ORDER BY executed_at DESC
      LIMIT $2
    `,
      [agentId, limit],
    );

    return results.map((row) => ({
      jobId: row.job_id,
      agentId: row.agent_id,
      identityKey: row.identity_key,
      signature: row.signature || '',
      nonce: row.nonce || '',
      artifacts:
        typeof row.artifacts === 'string' ? JSON.parse(row.artifacts) : row.artifacts || [],
      executionTime: row.execution_time_ms || 0,
      success: row.success,
      errorMessage: row.error_message,
      clientFeedback:
        typeof row.client_feedback === 'string'
          ? JSON.parse(row.client_feedback)
          : row.client_feedback,
    }));
  }

  /**
   * Get job execution details
   */
  async getJobExecution(jobId: string): Promise<AgentExecution[]> {
    const results = await this.database.query(
      `
      SELECT job_id, agent_id, identity_key, signature, nonce, artifacts,
             execution_time_ms, success, error_message, client_feedback,
             overlay_confirmation,
             EXTRACT(EPOCH FROM executed_at) * 1000 as executed_at
      FROM agent_executions
      WHERE job_id = $1
      ORDER BY executed_at DESC
    `,
      [jobId],
    );

    return results.map((row) => ({
      jobId: row.job_id,
      agentId: row.agent_id,
      identityKey: row.identity_key,
      signature: row.signature || '',
      nonce: row.nonce || '',
      artifacts:
        typeof row.artifacts === 'string' ? JSON.parse(row.artifacts) : row.artifacts || [],
      executionTime: row.execution_time_ms || 0,
      success: row.success,
      errorMessage: row.error_message,
      clientFeedback:
        typeof row.client_feedback === 'string'
          ? JSON.parse(row.client_feedback)
          : row.client_feedback,
    }));
  }

  /**
   * Get BRC-31 verification statistics
   */
  async getBRC31Stats(agentId?: string): Promise<{
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
  }> {
    let whereClause = '';
    const params: any[] = [];

    if (agentId) {
      whereClause = 'WHERE agent_id = $1';
      params.push(agentId);
    }

    const [statsResult, failuresResult] = await Promise.all([
      this.database.queryOne(
        `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE verified = true) as successful,
          COUNT(*) FILTER (WHERE verified = false) as failed
        FROM brc31_verifications
        ${whereClause}
      `,
        params,
      ),
      this.database.query(
        `
        SELECT agent_id, identity_key, verification_error,
               EXTRACT(EPOCH FROM verified_at) * 1000 as verified_at
        FROM brc31_verifications
        WHERE verified = false ${agentId ? 'AND agent_id = $1' : ''}
        ORDER BY verified_at DESC
        LIMIT 10
      `,
        agentId ? [agentId] : [],
      ),
    ]);

    const total = parseInt(statsResult?.total || '0');
    const successful = parseInt(statsResult?.successful || '0');
    const failed = parseInt(statsResult?.failed || '0');

    return {
      totalVerifications: total,
      successfulVerifications: successful,
      failedVerifications: failed,
      successRate: total > 0 ? successful / total : 0,
      recentFailures: failuresResult.map((row) => ({
        agentId: row.agent_id,
        identityKey: row.identity_key,
        error: row.verification_error || 'Unknown error',
        verifiedAt: parseInt(row.verified_at),
      })),
    };
  }

  // Private helper methods

  private async storeExecution(execution: AgentExecution): Promise<void> {
    await this.database.execute(
      `
      INSERT INTO agent_executions
      (job_id, agent_id, identity_key, signature, nonce, artifacts, execution_time_ms,
       success, error_message, client_feedback)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        execution.jobId,
        execution.agentId,
        execution.identityKey,
        execution.signature,
        execution.nonce,
        JSON.stringify(execution.artifacts),
        execution.executionTime,
        execution.success,
        execution.errorMessage,
        execution.clientFeedback ? JSON.stringify(execution.clientFeedback) : null,
      ],
    );
  }

  private async logBRC31Verification(
    agentId: string,
    identityKey: string,
    headers: BRC31Headers,
    verified: boolean,
    error?: string,
  ): Promise<void> {
    const messageHash = this.createMessageHash('verification-log', headers['X-Nonce']);

    await this.database.execute(
      `
      INSERT INTO brc31_verifications
      (agent_id, identity_key, message_hash, signature, nonce, verified, verification_error)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
      [
        agentId,
        identityKey,
        messageHash,
        headers['X-Signature'],
        headers['X-Nonce'],
        verified,
        error,
      ],
    );
  }

  private getWebhookType(job: OverlayJob): string {
    const action = job.coordinationData?.action;

    switch (action) {
      case 'overlay.notify':
      case 'notify':
        return 'notification';
      case 'overlay.coordinate':
        return 'coordination';
      case 'overlay.distribute':
        return 'distribution';
      case 'contract.generate':
        return 'contract-generation';
      case 'data.process':
        return 'data-processing';
      default:
        return 'task-execution';
    }
  }

  private generateNonce(): string {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  private createMessageHash(message: string, nonce: string): string {
    return createHash('sha256')
      .update(message + nonce)
      .digest('hex');
  }

  private async signMessage(messageHash: string): Promise<string> {
    // In production, use proper secp256k1 signing with system private key
    // For now, return a mock signature
    return 'mock_signature_' + createHash('sha256').update(messageHash).digest('hex').slice(0, 16);
  }

  private async verifySignature(
    messageHash: string,
    signature: string,
    publicKey: string,
  ): Promise<boolean> {
    // In production, use proper secp256k1 signature verification
    // For now, simulate verification logic

    // Mock verification: check if signature contains message hash
    return signature.includes(messageHash.slice(0, 8)) || signature.startsWith('mock_signature_');
  }

  private getSystemIdentityKey(): string {
    // In production, return the system's compressed public key
    return process.env.AGENT_CALL_PUBKEY || 'system_public_key_placeholder';
  }

  private extractBRC31Headers(headers: Headers): BRC31Headers | null {
    const identityKey = headers.get('X-Identity-Key');
    const nonce = headers.get('X-Nonce');
    const signature = headers.get('X-Signature');

    if (!identityKey || !nonce || !signature) {
      return null;
    }

    return {
      'X-Identity-Key': identityKey,
      'X-Nonce': nonce,
      'X-Signature': signature,
    };
  }

  private async getAgentFromDatabase(agentId: string): Promise<OverlayAgent | null> {
    const results = await this.database.query(
      `
      SELECT agent_id, identity_key, webhook_url
      FROM overlay_agents
      WHERE agent_id = $1
    `,
      [agentId],
    );

    if (results.length === 0) return null;

    const row = results[0];
    return {
      agentId: row.agent_id,
      identityKey: row.identity_key,
      webhookUrl: row.webhook_url,
    } as OverlayAgent;
  }
}
