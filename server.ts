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
import { auditLogger } from './src/middleware/audit';
import { rateLimit } from './src/middleware/limits';

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

// API routes with rate limiting
app.use(rateLimit('bundle'), bundleRouter(db));
app.use(rateLimit('ready'), readyRouter(db));
app.use(rateLimit('price'), priceRouter(db));
app.use(rateLimit('pay'), payRouter(db));
app.use(rateLimit('data'), dataRouter(db));
app.use(rateLimit('submit'), listingsRouter(db));
app.use(rateLimit('submit'), producersRouter(db));
app.use(rateLimit('submit'), advisoriesRouter(db));

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

// UI
app.use(express.static(path.join(__dirname, 'public')));

// Start
const PORT = Number(process.env.OVERLAY_PORT || 8788);
app.listen(PORT, () => console.log(`Overlay listening on :${PORT}`));
