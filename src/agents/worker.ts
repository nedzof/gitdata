import Database from 'better-sqlite3';
import { claimNextJob, setJobResult, bumpJobRetry, getRule, getAgent, setPrice, createReceipt, createArtifact } from '../db';
import { callAgentWebhook } from './webhook';
import { evalPredicate } from './predicate';
import { generateContract } from './templates';
import { publishContractArtifact, publishArtifactToDLM1 } from './dlm1-publisher';

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
          if (!act.templateId) throw new Error('contract.generate requires templateId');
          const variables = act.variables || {
            AGREEMENT_ID: `AGR_${job.job_id}`,
            VERSION_ID: job.target_id || 'unknown',
            DATASET_ID: act.datasetId || 'unknown',
            PROCESSING_TYPE: act.processingType || 'data-access',
            PRICE_SATS: act.priceSats || 1000,
            QUANTITY: act.quantity || 1
          };
          const result = generateContract(db, act.templateId, variables);
          if (!result.success) throw new Error(`contract generation failed: ${result.error}`);

          // Store artifact in database with proper content hash
          const contentHash = require('crypto').createHash('sha256').update(result.content || '', 'utf8').digest('hex');
          const artifactId = createArtifact(db, {
            job_id: job.job_id,
            artifact_type: 'contract/markdown',
            content_hash: contentHash,
            content_data: Buffer.from(result.content || '', 'utf8'),
            metadata_json: JSON.stringify(result.metadata)
          });

          const artifact = {
            artifactId,
            type: 'contract/markdown',
            contentHash,
            metadata: result.metadata,
            size: Buffer.byteLength(result.content || '', 'utf8')
          };
          evidence.push({ action:'contract.generate', artifact });
        } else if (act.action === 'price.set') {
          if (!act.versionId || act.satoshis === undefined) throw new Error('price.set requires versionId and satoshis');
          setPrice(db, act.versionId, act.satoshis);
          evidence.push({ action:'price.set', versionId: act.versionId, satoshis: act.satoshis });
        } else if (act.action === 'pay') {
          if (!act.versionId || !act.quantity) throw new Error('pay requires versionId and quantity');
          const receiptId = createReceipt(db, {
            version_id: act.versionId,
            quantity: act.quantity,
            amount_sat: act.amountSat || (act.quantity * 1000)
          });
          evidence.push({ action:'pay', versionId: act.versionId, quantity: act.quantity, receiptId });
        } else if (act.action === 'publish') {
          if (!act.artifactId) throw new Error('publish requires artifactId');
          const overlayUrl = process.env.OVERLAY_URL || 'http://localhost:8788';
          const publishResult = await publishArtifactToDLM1(db, act.artifactId, overlayUrl);
          if (!publishResult.success) throw new Error(`artifact publishing failed: ${publishResult.error}`);
          evidence.push({
            action:'publish',
            artifactId: act.artifactId,
            versionId: publishResult.versionId,
            status: 'published'
          });
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