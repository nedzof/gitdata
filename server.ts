import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDb, initSchema } from './src/db';
import { bundleRouter } from './src/routes/bundle';
import { readyRouter } from './src/routes/ready';
import { priceRouter } from './src/routes/price';
import { listingsRouter } from './src/routes/listings';
import { submitDlm1Router } from './src/routes/submit-builder';
import { submitReceiverRouter } from './src/routes/submit-receiver';
import { payRouter } from './src/routes/pay';
import { dataRouter } from './src/routes/data';
import { producersRouter } from './src/routes/producers';
import { advisoriesRouter } from './src/routes/advisories';
import { agentsRouter } from './src/routes/agents';
import { rulesRouter } from './src/routes/rules';
import { jobsRouter } from './src/routes/jobs';
import { catalogRouter } from './src/routes/catalog';
import { producersRegisterRouter } from './src/routes/producers-register';
import { createJobProcessor } from './src/worker/job-processor';
import { opsRouter } from './src/routes/metrics';
import { auditLogger } from './src/middleware/audit';
import { rateLimit } from './src/middleware/limits';
import { metricsRoute } from './src/middleware/metrics';
import { runPaymentsMigrations, paymentsRouter, reconcilePayments } from './src/payments';
import { storageRouter } from './src/routes/storage';
import { createStorageEventsMigration } from './src/storage/lifecycle';
import { runIngestMigrations, ingestRouter, startIngestWorker } from './src/ingest';
import { startJobsWorker } from './src/agents/worker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// D12: Strict body size limits (256kb default)
const BODY_SIZE_LIMIT = process.env.BODY_SIZE_LIMIT || '256kb';
app.use(express.json({ limit: BODY_SIZE_LIMIT }));

// D12: Audit logging for all requests
app.use(auditLogger());

// UI - serve SvelteKit build BEFORE rate limiting
app.use(express.static(path.join(__dirname, 'ui/build')));

// DB
const db = openDb();
initSchema(db);

// D21: Initialize payments schema
runPaymentsMigrations(db);

// D22: Initialize storage events schema
createStorageEventsMigration(db);

// D23: Initialize ingest schema
runIngestMigrations(db);

// Attach per-route metrics wrappers before routers (best-effort)
app.use('/ready', metricsRoute('ready'));
app.use('/price', metricsRoute('price'));
app.use('/v1/data', metricsRoute('data'));
app.use('/pay', metricsRoute('pay'));
app.use('/advisories', metricsRoute('advisories'));
app.use('/producers', metricsRoute('producers'));
app.use('/listings', metricsRoute('listings'));
app.use('/agents', metricsRoute('agents'));
app.use('/rules', metricsRoute('rules'));
app.use('/jobs', metricsRoute('jobs'));
app.use('/payments', metricsRoute('payments'));

// API routes with rate limiting
app.use(rateLimit('bundle'), bundleRouter(db));
app.use(rateLimit('ready'), readyRouter(db));
app.use(rateLimit('price'), priceRouter(db));
app.use(rateLimit('pay'), payRouter(db));
app.use(rateLimit('data'), dataRouter(db));
app.use('/listings', rateLimit('submit'), listingsRouter(db));
app.use(rateLimit('submit'), producersRouter(db));
app.use(rateLimit('submit'), advisoriesRouter(db));

// D19: Identity-signed producer registration
app.use(producersRegisterRouter(db));

// D16: A2A Agent marketplace routes
app.use('/agents', agentsRouter(db));
app.use('/rules', rulesRouter(db));
app.use('/jobs', jobsRouter(db));

// D18: Catalog routes (/search and /resolve)
app.use(catalogRouter(db));

// D17: Ops routes (/health and /metrics)
app.use(opsRouter(db));

// D21: BSV Payments routes (/payments/quote, /payments/submit, /payments/:receiptId)
app.use(rateLimit('payments'), paymentsRouter(db));

// D22: Storage backend monitoring (/v1/storage/health, /v1/storage/stats, etc.)
app.use(rateLimit('storage'), storageRouter(db));

// D23: Real-time event ingestion (/ingest/events, /ingest/feed, /watch)
app.use(rateLimit('ingest'), ingestRouter(db));

// D01 Builder route with rate limiting
app.use(rateLimit('submit'), submitDlm1Router());

// Receiver (BRC-22-ish: rawTx + manifest [+ envelope]) with rate limiting
app.use(
  rateLimit('submit'),
  submitReceiverRouter(db, {
    headersFile: process.env.HEADERS_FILE || './data/headers.json',
    minConfs: Number(process.env.POLICY_MIN_CONFS || 1),
    bodyMaxSize: Number(process.env.BODY_MAX_SIZE || 1_000_000),
  })
);

// D16: Initialize A2A job processor if enabled
let jobProcessor;
if (process.env.A2A_WORKER_ENABLED === 'true') {
  try {
    jobProcessor = createJobProcessor(db);
    jobProcessor.start();
    console.log('[A2A] Job processor started');
  } catch (error) {
    console.warn('[A2A] Job processor could not start:', error);
    console.warn('[A2A] Set AGENT_CALL_PRIVKEY environment variable to enable A2A worker');
  }
}

// D23: Start ingest worker for real-time event processing
const stopIngestWorker = startIngestWorker(db);

// D24: Start jobs worker for agent marketplace automation
const stopJobsWorker = startJobsWorker(db);

// D21: Initialize payments reconciliation job
if (process.env.PAYMENTS_RECONCILE_ENABLED !== 'false') {
  setInterval(() => {
    reconcilePayments(db).catch(err =>
      console.warn('[D21] Payments reconcile error:', err.message)
    );
  }, Number(process.env.PAYMENTS_RECONCILE_INTERVAL_MS || 60000));
  console.log('[D21] Payments reconciliation job started');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (jobProcessor) {
    jobProcessor.stop();
  }
  stopIngestWorker();
  stopJobsWorker();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  if (jobProcessor) {
    jobProcessor.stop();
  }
  stopIngestWorker();
  stopJobsWorker();
  process.exit(0);
});

// UI static files already served above before rate limiting

// Start
const PORT = Number(process.env.OVERLAY_PORT || 8788);
app.listen(PORT, () => {
  console.log(`Overlay listening on :${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Metrics endpoint: http://localhost:${PORT}/metrics`);
  if (process.env.A2A_WORKER_ENABLED === 'true') {
    console.log(`A2A APIs: http://localhost:${PORT}/agents, /rules, /jobs`);
  }
});
