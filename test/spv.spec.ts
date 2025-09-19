import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  verifyMerklePath,
  verifyEnvelopeAgainstHeaders,
  txidFromRawTx,
  parseBlockHeader,
  loadHeaders,
  type HeadersIndex,
  type SPVEnvelope,
} from '../src/spv/verify-envelope';

// Helper: sha256d over hex bytes (Node's crypto not needed here as we don't re-implement)
function concat(...parts: Buffer[]) { return Buffer.concat(parts); }
function hexToBuf(h: string) { return Buffer.from(h, 'hex'); }
function bufToHex(b: Buffer) { return b.toString('hex'); }
function rev(b: Buffer) { const c = Buffer.from(b); c.reverse(); return c; }
function sha256d(b: Buffer) {
  const crypto = require('crypto') as typeof import('crypto');
  const a = crypto.createHash('sha256').update(b).digest();
  return crypto.createHash('sha256').update(a).digest();
}

/** Build a raw 80-byte header with given merkleRootBE; returns { headerHex, blockHashBE } */
function buildHeaderWithRoot(merkleRootBE: string): { headerHex: string; blockHash: string } {
  const versionLE = Buffer.alloc(4); versionLE.writeInt32LE(1, 0);
  const prevHashLE = Buffer.alloc(32); // zeros
  const merkleRootLE = rev(hexToBuf(merkleRootBE));
  const timeLE = Buffer.alloc(4); timeLE.writeUInt32LE(1700000000, 0);
  const bitsLE = Buffer.alloc(4); bitsLE.writeUInt32LE(0x1d00ffff, 0);
  const nonceLE = Buffer.alloc(4); nonceLE.writeUInt32LE(0x00000042, 0);
  const header = concat(versionLE, prevHashLE, merkleRootLE, timeLE, bitsLE, nonceLE);
  const hashBE = bufToHex(rev(sha256d(header)));
  return { headerHex: bufToHex(header), blockHash: hashBE };
}

/** Temp headers index writer */
function writeHeadersIndex(headersPath: string, blockHash: string, merkleRoot: string, height: number, bestHeight: number) {
  const json = {
    bestHeight,
    tipHash: blockHash.toLowerCase(),
    byHash: {
      [blockHash.toLowerCase()]: {
        prevHash: '00'.repeat(32),
        merkleRoot: merkleRoot.toLowerCase(),
        height,
      },
    },
  };
  fs.writeFileSync(headersPath, JSON.stringify(json, null, 2));
}

(async function run() {
  // Leaf tx (raw hex can be any; txidFromRawTx will hash bytes)
  const rawTx = '00';
  const txid = txidFromRawTx(rawTx); // big-endian display
  assert.strictEqual(txid.length, 64);

  // Good path (two-leaf tree): root = sha256d(LE(txid) || LE(sibling)) when sibling is on the right
  const sibling = '11'.repeat(32);
  const txidLE = rev(hexToBuf(txid));
  const siblingLE = rev(hexToBuf(sibling));
  const rootBE = bufToHex(rev(sha256d(concat(txidLE, siblingLE))));

  // verifyMerklePath positive
  const ok = verifyMerklePath(txid, [{ hash: sibling, position: 'right' }], rootBE);
  assert.strictEqual(ok, true, 'verifyMerklePath must accept correct right-sibling');

  // verifyMerklePath negative (wrong order/direction)
  const bad = verifyMerklePath(txid, [{ hash: sibling, position: 'left' }], rootBE);
  assert.strictEqual(bad, false, 'verifyMerklePath must reject wrong direction');

  // Build header for that root
  const { headerHex, blockHash } = buildHeaderWithRoot(rootBE);
  const parsed = parseBlockHeader(headerHex);
  assert.strictEqual(parsed.merkleRoot.toLowerCase(), rootBE.toLowerCase());
  assert.strictEqual(parsed.blockHash.toLowerCase(), blockHash.toLowerCase());

  // Create temp headers file
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spv-'));
  const headersPath = path.join(tmpDir, 'headers.json');
  writeHeadersIndex(headersPath, blockHash, rootBE, 100, 105);

  const idx: HeadersIndex = loadHeaders(headersPath);

  // Envelope using blockHeader (confirms via headers index using blockHash)
  const envA: SPVEnvelope = {
    rawTx,
    proof: { txid, merkleRoot: rootBE, path: [{ hash: sibling, position: 'right' }] },
    block: { blockHeader: headerHex },
  };
  const resA = await verifyEnvelopeAgainstHeaders(envA, idx, 0);
  assert.strictEqual(resA.ok, true, `envA should verify: ${resA.reason || ''}`);

  // Envelope using blockHash+height
  const envB: SPVEnvelope = {
    rawTx,
    proof: { txid, merkleRoot: rootBE, path: [{ hash: sibling, position: 'right' }] },
    block: { blockHash, blockHeight: 100 },
  };
  const resB = await verifyEnvelopeAgainstHeaders(envB, idx, 0);
  assert.strictEqual(resB.ok, true, `envB should verify: ${resB.reason || ''}`);

  // Unknown block hash -> fail
  const envC: SPVEnvelope = {
    rawTx,
    proof: { txid, merkleRoot: rootBE, path: [{ hash: sibling, position: 'right' }] },
    block: { blockHash: 'aa'.repeat(32), blockHeight: 100 },
  };
  const resC = await verifyEnvelopeAgainstHeaders(envC, idx, 0);
  assert.strictEqual(resC.ok, false);
  assert.strictEqual(resC.reason, 'unknown-block-hash');

  // Insufficient confirmations
  const resBMin = await verifyEnvelopeAgainstHeaders(envB, idx, 10_000);
  assert.strictEqual(resBMin.ok, false);
  assert.strictEqual(resBMin.reason, 'insufficient-confs');

  // Reorg simulation: tip moves (bestHeight increases -> more confirmations)
  writeHeadersIndex(headersPath, blockHash, rootBE, 100, 110);
  const idx2 = loadHeaders(headersPath);
  const resB2 = await verifyEnvelopeAgainstHeaders(envB, idx2, 0);
  assert.strictEqual(resB2.ok, true);
  assert.ok((resB2.confirmations || 0) > (resB.confirmations || 0));

  console.log('OK: SPV unit/integration tests passed.');
})().catch((e) => {
  console.error('SPV tests failed:', e);
  process.exit(1);
});