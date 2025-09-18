// src/example.ts
import { GeniusClient } from './sdk';
import { verifyBundle } from './sdk/verify';

const overlay = process.env.OVERLAY_URL || 'http://localhost:8788';
const client = new GeniusClient(overlay);

// Ready gate
const ready = await client.ready('aaaaaaaa...hex', { minConfs: 1, classificationAllowList: ['public'] });
if (!ready.ready) throw new Error(`not ready: ${ready.reasons?.join('; ')}`);

// Strict verify
const bundle = await client.bundle('aaaaaaaa...hex', 10);
const result = await verifyBundle(bundle, {
  verifyEnvelope: async (env) => {
    // TODO: call your SPV module here
    return !!env.rawTx && !!env.proof;
  },
  digestManifest: async (m) => {
    // TODO: canonicalize & sha256 manifest body as hex
    return 'deadbeef'.padStart(64, '0');
  },
});
if (!result.ok) throw new Error(`bundle invalid: ${result.errors.join('; ')}`);
