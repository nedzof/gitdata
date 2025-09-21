import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initSchema } from './src/db';
import { bundleRouter } from './src/routes/bundle';
import { readyRouter } from './src/routes/ready';
import { priceRouter } from './src/routes/price';
import { listingsRouter } from './src/routes/listings';
import { healthRouter } from './src/routes/health';
import { submitDlm1Router } from './src/routes/submit-builder';
import { submitReceiverRouter } from './src/routes/submit-receiver';
import { payRouter } from './src/routes/pay';
import { dataRouter } from './src/routes/data';
import { producersRouter } from './src/routes/producers';
import { advisoriesRouter } from './src/routes/advisories';
import { agentsRouter } from './src/routes/agents';
import { rulesRouter } from './src/routes/rules';
import { jobsRouter } from './src/routes/jobs';
import { templatesRouter } from './src/routes/templates';
import { createArtifactRoutes } from './src/agents/dlm1-publisher';
import { artifactsRouter } from './src/routes/artifacts';
import { catalogRouter } from './src/routes/catalog';
import { producersRegisterRouter } from './src/routes/producers-register';
import { createJobProcessor } from './src/worker/job-processor';
import { opsRouter } from './src/routes/metrics';
import { auditLogger } from './src/middleware/audit';
import { rateLimit } from './src/middleware/limits';
import { metricsRoute } from './src/middleware/metrics';
import {
  enforceAgentRegistrationPolicy,
  enforceRuleConcurrency,
  enforceJobCreationPolicy,
  enforceResourceLimits,
  enforceAgentSecurityPolicy
} from './src/middleware/policy';
import { runPaymentsMigrations, paymentsRouter, reconcilePayments } from './src/payments';
import { storageRouter } from './src/routes/storage';
import { createStorageEventsMigration } from './src/storage/lifecycle';
import { runIngestMigrations, ingestRouter, startIngestWorker } from './src/ingest';
import { startJobsWorker } from './src/agents/worker';
import { runModelsMigrations, modelsRouter } from './src/models/scaffold';
import { runPolicyMigrations, policiesRouter } from './src/policies';
import openlineageRouter from './src/routes/openlineage.js';
import { walletRouter } from './src/routes/wallet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// D12: Strict body size limits (256kb default)
const BODY_SIZE_LIMIT = process.env.BODY_SIZE_LIMIT || '256kb';
app.use(express.json({ limit: BODY_SIZE_LIMIT }));

// D12: Audit logging for all requests
app.use(auditLogger());

// CORS headers for frontend development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// UI - serve SvelteKit build BEFORE rate limiting
app.use(express.static(path.join(__dirname, 'ui/build')));

// Modern PostgreSQL/Redis Hybrid Database
initSchema().catch(console.error);

// TODO: Migrate these initialization functions to work with PostgreSQL
// For now, commenting out to get the hybrid system running
// runPaymentsMigrations(db);
// createStorageEventsMigration(db);
// runIngestMigrations(db);
// runModelsMigrations(db);
// runPolicyMigrations(db);
// OpenLineage schema is included in PostgreSQL schema initialization

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
app.use('/api/models', metricsRoute('models'));
app.use('/policies', metricsRoute('policies'));
app.use('/openlineage', metricsRoute('openlineage'));

// API routes with rate limiting
app.use(rateLimit('bundle'), bundleRouter());
app.use(rateLimit('ready'), readyRouter());
app.use(rateLimit('price'), priceRouter());
app.use(rateLimit('pay'), payRouter());
app.use(rateLimit('data'), dataRouter());
app.use(healthRouter());
app.use('/listings', rateLimit('submit'), listingsRouter());
// TODO: These routes need to be updated to work without database parameter
app.use(rateLimit('submit'), producersRouter());
app.use(rateLimit('submit'), advisoriesRouter());

// TODO: Update these routes to use hybrid database
// D19: Identity-signed producer registration
// app.use(producersRegisterRouter());

// D16: A2A Agent marketplace routes with policy enforcement (updated for hybrid)
app.use('/agents', enforceResourceLimits(), enforceAgentSecurityPolicy(), enforceAgentRegistrationPolicy(), agentsRouter());
app.use('/rules', enforceResourceLimits(), enforceRuleConcurrency(), enforceJobCreationPolicy(), rulesRouter());
app.use('/jobs', jobsRouter());
app.use('/templates', enforceResourceLimits(), templatesRouter());
app.use('/artifacts', enforceResourceLimits(), artifactsRouter());

// D18: Catalog routes (/search and /resolve) - updated for hybrid
app.use(catalogRouter());

// D17: Ops routes (/health and /metrics)
// app.use(opsRouter(db));

// D21: BSV Payments routes (/payments/quote, /payments/submit, /payments/:receiptId)
// app.use(rateLimit('payments'), paymentsRouter());

// D22: Storage backend monitoring (/v1/storage/health, /v1/storage/stats, etc.)
// app.use(rateLimit('storage'), storageRouter());

// D23: Real-time event ingestion (/ingest/events, /ingest/feed, /watch)
// app.use(rateLimit('ingest'), ingestRouter());

// D27: Model provenance & reverse lineage (/api/models/connect, /api/models/search, etc.)
// app.use('/api/models', rateLimit('models'), modelsRouter(db));

// D28: Policy governance (/policies CRUD, /policies/evaluate)
// app.use('/policies', rateLimit('policies'), policiesRouter(db));

// D38: OpenLineage API (/openlineage/lineage, /openlineage/nodes, etc.)
app.use('/openlineage', rateLimit('openlineage'), openlineageRouter);

// BRC100 Wallet Integration API (/wallet/purchases, /wallet/balance, /assets/:id/status, /notifications/*)
app.use(rateLimit('wallet'), walletRouter());

// D01 Builder route with rate limiting - Updated for D01A spec compliance
app.use(rateLimit('submit'), submitDlm1Router());

// Receiver (BRC-22-ish: rawTx + manifest [+ envelope]) with rate limiting
// app.use(
//   rateLimit('submit'),
//   submitReceiverRouter(db, {
//     headersFile: process.env.HEADERS_FILE || './data/headers.json',
//     minConfs: Number(process.env.POLICY_MIN_CONFS || 1),
//     bodyMaxSize: Number(process.env.BODY_MAX_SIZE || 1_000_000),
//   })
// );

// TODO: Update worker initialization to use hybrid database
// D16: Initialize A2A job processor if enabled
// let jobProcessor;
// if (process.env.A2A_WORKER_ENABLED === 'true') {
//   try {
//     jobProcessor = createJobProcessor(db);
//     jobProcessor.start();
//     console.log('[A2A] Job processor started');
//   } catch (error) {
//     console.warn('[A2A] Job processor could not start:', error);
//     console.warn('[A2A] Set AGENT_CALL_PRIVKEY environment variable to enable A2A worker');
//   }
// }

// D23: Start ingest worker for real-time event processing
// const stopIngestWorker = startIngestWorker();

// D24: Start jobs worker for agent marketplace automation
// const stopJobsWorker = startJobsWorker(db);

// TODO: Update payments reconciliation to use hybrid database
// D21: Initialize payments reconciliation job
// if (process.env.PAYMENTS_RECONCILE_ENABLED !== 'false') {
//   setInterval(() => {
//     reconcilePayments().catch(err =>
//       console.warn('[D21] Payments reconcile error:', err.message)
//     );
//   }, Number(process.env.PAYMENTS_RECONCILE_INTERVAL_MS || 60000));
//   console.log('[D21] Payments reconciliation job started');
// }

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  // if (jobProcessor) {
  //   jobProcessor.stop();
  // }
  // stopIngestWorker();
  // stopJobsWorker();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  // if (jobProcessor) {
  //   jobProcessor.stop();
  // }
  // stopIngestWorker();
  // stopJobsWorker();
  process.exit(0);
});

// UI static files already served above before rate limiting

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api') ||
      req.path.startsWith('/v1') ||
      req.path.startsWith('/ready') ||
      req.path.startsWith('/price') ||
      req.path.startsWith('/listings') ||
      req.path.startsWith('/pay') ||
      req.path.startsWith('/data') ||
      req.path.startsWith('/bundle') ||
      req.path.startsWith('/submit') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/metrics') ||
      req.path.startsWith('/agents') ||
      req.path.startsWith('/rules') ||
      req.path.startsWith('/jobs') ||
      req.path.startsWith('/templates') ||
      req.path.startsWith('/catalog') ||
      req.path.startsWith('/producers') ||
      req.path.startsWith('/advisories') ||
      req.path.startsWith('/ops') ||
      req.path.startsWith('/payments') ||
      req.path.startsWith('/storage') ||
      req.path.startsWith('/ingest') ||
      req.path.startsWith('/policies') ||
      req.path.startsWith('/openlineage') ||
      req.path.startsWith('/wallet') ||
      req.path.startsWith('/assets') ||
      req.path.startsWith('/notifications')) {
    return next();
  }

  // Serve the SPA index.html for all other routes
  res.sendFile(path.join(__dirname, 'ui/build/index.html'));
});

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
