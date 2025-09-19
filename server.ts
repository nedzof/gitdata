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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

// DB
const db = openDb();
initSchema(db);

// API routes
app.use(bundleRouter(db));
app.use(readyRouter(db));
app.use(priceRouter(db));
app.use(payRouter(db));
app.use(dataRouter(db));
app.use(listingsRouter(db));

// D01 Builder route
app.use(submitDlm1Router());

// Receiver (BRC-22-ish: rawTx + manifest [+ envelope])
app.use(
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
