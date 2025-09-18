import express from 'express';
import bodyParser from 'body-parser';
import { submitHandlerFactory } from './routes/submit';

const app = express();
app.use(bodyParser.json({ limit: '1mb' })); // align with BODY_MAX_SIZE

// Provide your real repo and headers file:
const repo = {
  async createOrGet({ txid }: any) {
    // Implement with your DB: unique(versionId), unique(txid), idempotency on conflict.
    return { id: txid, created: true };
  },
};

app.post(
  '/submit',
  submitHandlerFactory({
    repo,
    headersFile: './data/headers.json',
    policy: { BODY_MAX_SIZE: 1_000_000, POLICY_MIN_CONFS: 1 },
  }),
);

app.listen(3000, () => console.log('listening on 3000'));
