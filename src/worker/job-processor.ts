/**
 * A2A Job Processor - Executes queued jobs from the agent marketplace
 * Handles notify actions and contract.generate simulation
 */

async function processJobs() {
  try {
    const { getPostgreSQLClient } = await import('../db/postgresql');
    const pgClient = getPostgreSQLClient();

    // Get queued jobs
    const result = await pgClient.query(`
      SELECT * FROM jobs
      WHERE state = 'queued' AND next_run_at <= $1
      ORDER BY created_at
      LIMIT 10
    `, [Math.floor(Date.now() / 1000)]);

    const jobs = result.rows;
    if (jobs.length === 0) return;

    for (const job of jobs) {
      await processJob(job, pgClient);
    }
  } catch (error) {
    console.error('[processJobs] Error:', error);
  }
}

async function processJob(job: any, pgClient: any) {
  try {
    // Mark job as running
    await pgClient.query(
      'UPDATE jobs SET state = $1, updated_at = $2 WHERE job_id = $3',
      ['running', Math.floor(Date.now() / 1000), job.job_id]
    );

    // Parse evidence to get actions
    const evidence = job.evidence_json ? JSON.parse(job.evidence_json) : {};
    const actions = evidence.actions || [];

    // Execute actions
    const actionResults = [];
    for (const action of actions) {
      const result = await executeAction(action, evidence.manifest, job);
      actionResults.push(result);
    }

    // Mark job as done with evidence
    const finalEvidence = {
      ...evidence,
      actions: actionResults,
      completedAt: Math.floor(Date.now() / 1000),
      jobId: job.job_id
    };

    await pgClient.query(
      'UPDATE jobs SET state = $1, evidence_json = $2, updated_at = $3 WHERE job_id = $4',
      ['done', JSON.stringify(finalEvidence), Math.floor(Date.now() / 1000), job.job_id]
    );

  } catch (error) {
    // Mark job as failed
    await pgClient.query(
      'UPDATE jobs SET state = $1, last_error = $2, updated_at = $3, attempts = attempts + 1 WHERE job_id = $4',
      ['failed', String(error), Math.floor(Date.now() / 1000), job.job_id]
    );
    console.error(`[processJob] Job ${job.job_id} failed:`, error);
  }
}

async function executeAction(action: any, manifest: any, job: any): Promise<any> {
  const { action: actionType, agentId } = action;

  if (actionType === 'notify') {
    // Simulate notification to agent webhook
    const { generatePrivateKey, signBRC31Message } = await import('../brc31/signer');

    const privateKey = process.env.AGENT_CALL_PRIVKEY || generatePrivateKey();
    const notificationPayload = {
      jobId: job.job_id,
      ruleId: job.rule_id,
      targetId: job.target_id,
      manifest: manifest,
      timestamp: Math.floor(Date.now() / 1000)
    };

    // Mock successful notification (would normally make HTTP request)
    return {
      action: 'notify',
      agentId,
      status: 200,
      body: { ok: true },
      payload: notificationPayload,
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  if (actionType === 'contract.generate') {
    // Simulate contract generation
    return {
      action: 'contract.generate',
      status: 200,
      contractId: `contract_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  // Default action handler
  return {
    action: actionType,
    status: 200,
    note: 'simulated',
    timestamp: Math.floor(Date.now() / 1000)
  };
}

export interface WorkerConfig {
  privateKey: string;         // AGENT_CALL_PRIVKEY - required for BRC-31 signing
  publicKey?: string;         // AGENT_CALL_PUBKEY - optional, derived from private key
  maxRetries: number;         // JOB_RETRY_MAX
  callbackTimeout: number;    // CALLBACK_TIMEOUT_MS
  pollInterval: number;       // How often to check for new jobs (ms)
}

export interface JobProcessor {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

// Create a minimal job processor for testing
export function createJobProcessor(): JobProcessor {
  let running = false;
  let intervalId: NodeJS.Timeout | null = null;

  return {
    start() {
      if (running) return;
      running = true;
      console.log('✓ Jobs worker started');

      // Process jobs from PostgreSQL
      intervalId = setInterval(async () => {
        try {
          await processJobs();
        } catch (error) {
          console.error('[job-processor] Error processing jobs:', error);
        }
      }, 500); // Check every 500ms for responsiveness
    },

    stop() {
      if (!running) return;
      running = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      console.log('✓ Jobs worker stopped');
    },

    isRunning() {
      return running;
    }
  };
}