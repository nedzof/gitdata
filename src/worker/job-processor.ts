/**
 * A2A Job Processor - Executes queued jobs from the agent marketplace
 * Handles notify actions and contract.generate simulation
 */

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

      // Mock job processing - just log that we're running
      intervalId = setInterval(() => {
        // In real implementation, this would process jobs from PostgreSQL
      }, 1000);
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