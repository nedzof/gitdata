import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { describe, test, expect } from 'vitest';

import { initSchema, upsertManifest, upsertDeclaration, replaceEdges } from '../../src/db';
import { txidFromRawTx } from '../../src/spv/verify-envelope';
import { readyRouter } from '../../src/routes/ready';

function rev(b: Buffer) { const c = Buffer.from(b); c.reverse(); return c; }
function sha256d(b: Buffer) {
  const crypto = require('crypto') as typeof import('crypto');
  const a = crypto.createHash('sha256').update(b).digest();
  return crypto.createHash('sha256').update(a).digest();
}

/** Build raw 80-byte header; return header hex + block hash (big-endian) */
function buildHeaderWithRoot(merkleRootBE: string): { headerHex: string; blockHash: string } {
  const versionLE = Buffer.alloc(4); versionLE.writeInt32LE(1, 0);
  const prevHashLE = Buffer.alloc(32);
  const merkleRootLE = rev(Buffer.from(merkleRootBE, 'hex'));
  const timeLE = Buffer.alloc(4); timeLE.writeUInt32LE(1700000000, 0);
  const bitsLE = Buffer.alloc(4); bitsLE.writeUInt32LE(0x1d00ffff, 0);
  const nonceLE = Buffer.alloc(4); nonceLE.writeUInt32LE(0x00000042, 0);
  const header = Buffer.concat([versionLE, prevHashLE, merkleRootLE, timeLE, bitsLE, nonceLE]);
  const blockHashBE = rev(sha256d(header)).toString('hex');
  return { headerHex: header.toString('hex'), blockHash: blockHashBE };
}

/** Create a minimal headers index file with two blocks at heights hParent and hChild */
function writeHeadersIndex(headersPath: string, records: Array<{ blockHash: string; merkleRoot: string; height: number }>, bestHeight: number, tipHash: string) {
  const byHash: any = {};
  for (const r of records) {
    byHash[r.blockHash.toLowerCase()] = {
      prevHash: '00'.repeat(32),
      merkleRoot: r.merkleRoot.toLowerCase(),
      height: r.height,
    };
  }
  fs.writeFileSync(headersPath, JSON.stringify({ bestHeight, tipHash, byHash }, null, 2));
}

describe('/ready endpoint comprehensive tests', () => {
  test('ready endpoint handles lineage verification with confirmations', async () => {
    // Prepare temp headers file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-'));
    const headersPath = path.join(tmpDir, 'headers.json');
    process.env.HEADERS_FILE = headersPath;

    // Express app with in-memory DB
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    const db = new Database(':memory:');
    initSchema(db);
    app.use(readyRouter(db));

    // Build synthetic txids with different raw transactions
    const rawTxChild = '01'; // Different raw tx for child
    const rawTxParent = '02'; // Different raw tx for parent
    const txidChild = txidFromRawTx(rawTxChild);
    const txidParent = txidFromRawTx(rawTxParent);

    // Construct a simple two-leaf merkle root: root = sha256d(LE(txid) || LE(sibling))
    const sibling = Buffer.alloc(32, 0x11).toString('hex');
    const leafChildLE = rev(Buffer.from(txidChild, 'hex'));
    const leafParentLE = rev(Buffer.from(txidParent, 'hex'));
    const siblingLE = rev(Buffer.from(sibling, 'hex'));
    const rootChild = rev(sha256d(Buffer.concat([leafChildLE, siblingLE]))).toString('hex');
    const rootParent = rev(sha256d(Buffer.concat([leafParentLE, siblingLE]))).toString('hex');

    // Create two block headers
    const { blockHash: blockChild } = buildHeaderWithRoot(rootChild);
    const { blockHash: blockParent } = buildHeaderWithRoot(rootParent);

    // Headers: parent height 100, child height 101; tip is child; bestHeight 101
    writeHeadersIndex(headersPath, [
      { blockHash: blockParent, merkleRoot: rootParent, height: 100 },
      { blockHash: blockChild, merkleRoot: rootChild, height: 101 },
    ], 101, blockChild);

    // Manifests
    const vidParent = 'b'.repeat(64);
    const vidChild = 'a'.repeat(64);

    const manifestParent = {
      type: 'datasetVersionManifest',
      datasetId: 'ds-parent',
      content: { contentHash: 'c'.repeat(64) },
      provenance: { createdAt: '2024-05-01T00:00:00Z' },
      policy: { license: 'cc-by-4.0', classification: 'public' }
    };
    const manifestChild = {
      type: 'datasetVersionManifest',
      datasetId: 'ds-child',
      content: { contentHash: 'd'.repeat(64) },
      lineage: { parents: [vidParent] },
      provenance: { createdAt: '2024-05-02T00:00:00Z' },
      policy: { license: 'cc-by-4.0', classification: 'public' }
    };

    // DB insert minimal rows
    upsertManifest(db, {
      version_id: vidParent, manifest_hash: vidParent, content_hash: manifestParent.content.contentHash,
      title: null, license: 'cc-by-4.0', classification: 'public',
      created_at: manifestParent.provenance.createdAt, manifest_json: JSON.stringify(manifestParent)
    });
    upsertManifest(db, {
      version_id: vidChild, manifest_hash: vidChild, content_hash: manifestChild.content.contentHash,
      title: null, license: 'cc-by-4.0', classification: 'public',
      created_at: manifestChild.provenance.createdAt, manifest_json: JSON.stringify(manifestChild)
    });
    await replaceEdges(vidChild, [vidParent]);

    // SPV envelopes (blockHash/height path for both)
    const envChild = {
      rawTx: rawTxChild,
      proof: { txid: txidChild, merkleRoot: rootChild, path: [{ hash: sibling, position: 'right' }] },
      block: { blockHash: blockChild, blockHeight: 101 },
    };
    const envParent = {
      rawTx: rawTxParent,
      proof: { txid: txidParent, merkleRoot: rootParent, path: [{ hash: sibling, position: 'right' }] },
      block: { blockHash: blockParent, blockHeight: 100 },
    };
    upsertDeclaration(db, { version_id: vidChild, txid: 'c'.repeat(64), type: 'DLM1', status: 'pending', created_at: Math.floor(Date.now()/1000), block_hash: null, height: null, opret_vout: 0, raw_tx: rawTxChild, proof_json: JSON.stringify(envChild) } as any);
    upsertDeclaration(db, { version_id: vidParent, txid: 'p'.repeat(64), type: 'DLM1', status: 'pending', created_at: Math.floor(Date.now()/1000), block_hash: null, height: null, opret_vout: 0, raw_tx: rawTxParent, proof_json: JSON.stringify(envParent) } as any);

    // 1) With minConfs = 1 (default), child has 1 conf, parent has 2 => ready true
    process.env.POLICY_MIN_CONFS = '1';
    const r1 = await request(app).get(`/ready?versionId=${vidChild}`);
    expect(r1.status).toBe(200);
    expect(r1.body.ready).toBe(true);

    // 2) With minConfs = 2, child has only 1 => ready false with insufficient-confs
    process.env.POLICY_MIN_CONFS = '2';
    const r2 = await request(app).get(`/ready?versionId=${vidChild}`);
    expect(r2.status).toBe(200);
    expect(r2.body.ready).toBe(false);
    expect(r2.body.reason).toBe('insufficient-confs');
    expect(typeof r2.body.confirmations).toBe('number');

    // 3) Reorg/height increase: bestHeight -> 102 makes child confs = 2 => ready true
    writeHeadersIndex(headersPath, [
      { blockHash: blockParent, merkleRoot: rootParent, height: 100 },
      { blockHash: blockChild, merkleRoot: rootChild, height: 101 },
    ], 102, blockChild);
    const r3 = await request(app).get(`/ready?versionId=${vidChild}`);
    expect(r3.status).toBe(200);
    expect(r3.body.ready).toBe(true);

    // 4) Missing envelope on parent -> ready false
    // Remove parent's proof envelope by setting it to null
    const { getPostgreSQLClient } = await import('../../src/db/postgresql');
    const pgClient = getPostgreSQLClient();
    await pgClient.query('UPDATE declarations SET proof_json = NULL WHERE version_id = $1', [vidParent]);
    const r4 = await request(app).get(`/ready?versionId=${vidChild}`);
    expect(r4.status).toBe(200);
    expect(r4.body.ready).toBe(false);
    expect(String(r4.body.reason).startsWith('missing-envelope:')).toBe(true);
  });
});