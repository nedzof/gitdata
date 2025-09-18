import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDb, initSchema } from './src/db';
import { bundleRouter } from './src/routes/bundle';
import { readyRouter } from './src/routes/ready';
import { priceRouter } from './src/routes/price';
import { listingsRouter } from './src/routes/listings';
// Optionally mount your existing submit routes too
// import { submitDlm1Router } from './src/routes/submit-builder';
// import { submitHandlerFactory } from './src/routes/submit-receiver';

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
app.use(listingsRouter(db));

// UI (static)
app.use(express.static(path.join(__dirname, 'public')));

// Start
const PORT = Number(process.env.OVERLAY_PORT || 8788);
app.listen(PORT, () => console.log(`Overlay listening on :${PORT}`));
