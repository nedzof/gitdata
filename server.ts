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
import { createJobProcessor } from './src/worker/job-processor';
import { opsRouter } from './src/routes/metrics';
import { auditLogger } from './src/middleware/audit';
import { rateLimit } from './src/middleware/limits';
import { metricsRoute } from './src/middleware/metrics';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// D12: Strict body size limits (256kb default)
const BODY_SIZE_LIMIT = process.env.BODY_SIZE_LIMIT || '256kb';
app.use(express.json({ limit: BODY_SIZE_LIMIT }));

// D12: Audit logging for all requests
app.use(auditLogger());

// DB
const db = openDb();
initSchema(db);

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

// API routes with rate limiting
app.use(rateLimit('bundle'), bundleRouter(db));
app.use(rateLimit('ready'), readyRouter(db));
app.use(rateLimit('price'), priceRouter(db));
app.use(rateLimit('pay'), payRouter(db));
app.use(rateLimit('data'), dataRouter(db));
app.use(rateLimit('submit'), listingsRouter(db));
app.use(rateLimit('submit'), producersRouter(db));
app.use(rateLimit('submit'), advisoriesRouter(db));

// D16: A2A Agent marketplace routes
app.use('/agents', agentsRouter(db));
app.use('/rules', rulesRouter(db));
app.use('/jobs', jobsRouter(db));

// D18: Catalog routes (/search and /resolve)
app.use(catalogRouter(db));

// D17: Ops routes (/health and /metrics)
app.use(opsRouter(db));

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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (jobProcessor) {
    jobProcessor.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  if (jobProcessor) {
    jobProcessor.stop();
  }
  process.exit(0);
});

// UI
app.use(express.static(path.join(__dirname, 'public')));

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
