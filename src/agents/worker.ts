import Database from 'better-sqlite3';
import { claimNextJob, setJobResult, bumpJobRetry, getRule, getAgent } from '../db';
import { callAgentWebhook } from './webhook';
import { evalPredicate } from './predicate';

// Minimal evaluator context builder: load manifest details when needed (skipped here for brevity)

const RETRY_MAX = Number(process.env.JOB_RETRY_MAX || 5);
const BACKOFF_BASE = 500;
const BACKOFF_FACTOR = 2;

export function startJobsWorker(db: Database.Database): (() => void) {
  let stopped = false;

  async function processOne() {
    if (stopped) return;

    const job = claimNextJob(db);
    if (!job) return;

    try {
      const rule = getRule(db, job.rule_id);
      if (!rule) throw new Error('rule-not-found');

      const actions = JSON.parse(rule.actions_json || '[]') as any[];
      const evidence: any[] = [];
      for (const act of actions) {
        if (act.action === 'notify') {
          const agent = getAgent(db, String(act.agentId || ''));
          if (!agent) throw new Error('agent-not-found');
          const payload = act.payload || { targetId: job.target_id, ruleId: job.rule_id };
          const r = await callAgentWebhook(agent.webhook_url, { type:'notify', payload });
          evidence.push({ action:'notify', agentId: agent.agent_id, status: r.status, body: r.body });
          if (r.status >= 300) throw new Error('agent-notify-failed');
        } else if (act.action === 'contract.generate') {
          // In a real system you'd call an agent or template service. Here we simulate.
          const artifact = { type:'contract/pdf', url:`/contracts/${job.job_id}.pdf`, hash:'deadbeef' };
          evidence.push({ action:'contract.generate', artifact });
        } else if (act.action === 'price.set') {
          // You can call your own /price endpoints internally here; skipped to keep worker small.
          evidence.push({ action:'price.set', versionId: act.versionId, satoshis: act.satoshis });
        } else if (act.action === 'pay') {
          evidence.push({ action:'pay', versionId: act.versionId, quantity: act.quantity });
        } else if (act.action === 'publish') {
          evidence.push({ action:'publish', note:'not implemented in worker scaffold' });
        } else {
          evidence.push({ action: act.action, note: 'unknown action (skipped)' });
        }
      }

      setJobResult(db, job.job_id, 'done', evidence, undefined);
    } catch (e:any) {
      const row = (e?.message || 'error');
      if (job.attempts + 1 >= RETRY_MAX) {
        setJobResult(db, job.job_id, 'dead', undefined, row);
      } else {
        const delay = BACKOFF_BASE * Math.pow(BACKOFF_FACTOR, job.attempts);
        bumpJobRetry(db, job.job_id, Math.min(30_000/1000, Math.floor(delay/1000)), row);
      }
    }
  }

  const intervalId = setInterval(() => {
    if (!stopped) {
      processOne().catch(()=>{});
    }
  }, 500);

  console.log('✓ Jobs worker started');

  // Return cleanup function
  return () => {
    stopped = true;
    clearInterval(intervalId);
    console.log('✓ Jobs worker stopped');
  };
}