import assert from 'assert';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';

import { initSchema } from '../../src/db';
import { submitDlm1Router } from '../../src/routes/submit-builder';
import { submitReceiverRouter } from '../../src/routes/submit-receiver';
import { fromHex, toHex } from '../../src/builders/opreturn';

// -------- Minimal in-memory repo for the test --------
type Decl = {
  id: string;
  versionId?: string;
  txid: string;
  type: 'DLM1' | 'TRN1' | 'UNKNOWN';
  txHex: string;
  createdAt: number;
  metadata?: any;
};

function makeRepo() {
  const byVersion = new Map<string, Decl>();
  const byTxid = new Map<string, Decl>();

  return {
    async createOrGet({
      versionId,
      txid,
      type,
      txHex,
      metadata,
    }: {
      versionId?: string;
      txid: string;
      type: 'DLM1' | 'TRN1' | 'UNKNOWN';
      txHex: string;
      metadata?: any;
    }): Promise<{ id: string; created: boolean }> {
      // Idempotency: prefer versionId if present, else txid
      const key = (versionId || txid).toLowerCase();

      // Already exists by versionId
      if (versionId && byVersion.has(versionId.toLowerCase())) {
        return { id: key, created: false };
      }
      // Already exists by txid
      if (byTxid.has(txid.toLowerCase())) {
        return { id: key, created: false };
      }

      const rec: Decl = {
        id: key,
        versionId: versionId?.toLowerCase(),
        txid: txid.toLowerCase(),
        type,
        txHex,
        createdAt: Math.floor(Date.now() / 1000),
        metadata,
      };
      byTxid.set(rec.txid, rec);
      if (rec.versionId) byVersion.set(rec.versionId, rec);
      return { id: key, created: true };
    },

    // Test-only helpers
    _getByVersion(versionId: string) {
      return byVersion.get(versionId.toLowerCase());
    },
    _getByTxid(txid: string) {
      return byTxid.get(txid.toLowerCase());
    },
  };
}

// -------- Helpers to assemble a minimal legacy raw tx (non-segwit) --------
function varInt(n: number): Uint8Array {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, (n >> 8) & 0xff);
  if (n <= 0xffffffff)
    return Uint8Array.of(
      0xfe,
      n & 0xff,
      (n >> 8) & 0xff,
      (n >> 16) & 0xff,
      (n >> 24) & 0xff
    );
  // 8-byte not needed here
  throw new Error('too large for test');
}

function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

// Embed an OP_RETURN script into a 1-in / 1-out raw tx
function buildTxWithScript(scriptHex: string): string {
  const version = Uint8Array.of(0x01, 0x00, 0x00, 0x00);

  // vin = 1
  const vinCount = varInt(1);
  const prevTxid = new Uint8Array(32); // 32 zero bytes
  const prevVout = Uint8Array.of(0x00, 0x00, 0x00, 0x00);
  const scriptSigLen = varInt(0);
  const sequence = Uint8Array.of(0xff, 0xff, 0xff, 0xff);

  // vout = 1 (value 0, our OP_RETURN script)
  const voutCount = varInt(1);
  const value0 = new Uint8Array(8); // 0 satoshis
  const script = fromHex(scriptHex);
  const scriptLen0 = varInt(script.length);

  const locktime = Uint8Array.of(0x00, 0x00, 0x00, 0x00);

  const tx = concatBytes([
    version,
    vinCount,
    prevTxid,
    prevVout,
    scriptSigLen,
    sequence,
    voutCount,
    value0,
    scriptLen0,
    script,
    locktime,
  ]);

  return toHex(tx);
}

// -------- Build an in-memory Express app --------
function makeApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // In-memory DB and schema
  const db = new Database(':memory:');
  initSchema(db);

  // Mount routes (no prefix to match D01)
  app.use(submitDlm1Router());
  app.use(submitReceiverRouter(db, { bodyMaxSize: 1_000_000 }));

  return { app, db };
}

// -------- Test scenario --------
(async function run() {
  const { app, db } = makeApp();

  const manifest = {
    type: 'datasetVersionManifest',
    datasetId: 'open-images-50k',
    description: 'Integration test dataset',
    content: { contentHash: 'c'.repeat(64), sizeBytes: 123, mimeType: 'application/parquet' },
    lineage: { parents: ['b'.repeat(64)] },
    provenance: { createdAt: '2024-05-01T00:00:00Z' },
    policy: { license: 'cc-by-4.0', classification: 'public' }
  };

  // 1) Builder: get outputs + versionId
  const buildResp = await request(app).post('/submit/dlm1').send({ manifest }).set('content-type','application/json');
  assert.strictEqual(buildResp.status, 200, `builder status ${buildResp.status}`);
  const versionId = buildResp.body.versionId as string;
  const scriptHex = buildResp.body.outputs[0].scriptHex as string;
  assert.ok(scriptHex.startsWith('006a'), 'OP_FALSE OP_RETURN expected');
  assert.ok(/^[0-9a-fA-F]{64}$/.test(versionId), 'versionId must be 64-hex');

  // 2) Craft a synthetic rawTx and submit to receiver
  const rawTx = buildTxWithScript(scriptHex);
  const recv = await request(app).post('/submit').send({ rawTx, manifest }).set('content-type','application/json');
  assert.strictEqual(recv.status, 200, `receiver status ${recv.status}`);
  assert.strictEqual(recv.body.status, 'success');
  assert.strictEqual(recv.body.type, 'DLM1');
  assert.strictEqual((recv.body.versionId || '').toLowerCase(), versionId.toLowerCase());

  console.log('OK: /submit/dlm1 → craft rawTx → /submit flow passed.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
