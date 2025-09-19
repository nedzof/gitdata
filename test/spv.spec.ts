import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, test, expect } from 'vitest';
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

describe('SPV unit/integration tests', () => {
  test('merkle path verification works correctly', () => {
    // Leaf tx (raw hex can be any; txidFromRawTx will hash bytes)
    const rawTx = '00';
    const txid = txidFromRawTx(rawTx); // big-endian display
    expect(txid.length).toBe(64);

    // Good path (two-leaf tree): root = sha256d(LE(txid) || LE(sibling)) when sibling is on the right
    const sibling = '11'.repeat(32);
    const txidLE = rev(hexToBuf(txid));
    const siblingLE = rev(hexToBuf(sibling));
    const rootBE = bufToHex(rev(sha256d(concat(txidLE, siblingLE))));

    // verifyMerklePath positive
    const ok = verifyMerklePath(txid, [{ hash: sibling, position: 'right' }], rootBE);
    expect(ok).toBe(true);

    // verifyMerklePath negative (wrong order/direction)
    const bad = verifyMerklePath(txid, [{ hash: sibling, position: 'left' }], rootBE);
    expect(bad).toBe(false);
  });

  test('block header parsing works correctly', () => {
    const rawTx = '00';
    const txid = txidFromRawTx(rawTx);
    const sibling = '11'.repeat(32);
    const txidLE = rev(hexToBuf(txid));
    const siblingLE = rev(hexToBuf(sibling));
    const rootBE = bufToHex(rev(sha256d(concat(txidLE, siblingLE))));

    // Build header for that root
    const { headerHex, blockHash } = buildHeaderWithRoot(rootBE);
    const parsed = parseBlockHeader(headerHex);
    expect(parsed.merkleRoot.toLowerCase()).toBe(rootBE.toLowerCase());
    expect(parsed.blockHash.toLowerCase()).toBe(blockHash.toLowerCase());
  });

  test('envelope verification against headers works', async () => {
    const rawTx = '00';
    const txid = txidFromRawTx(rawTx);
    const sibling = '11'.repeat(32);
    const txidLE = rev(hexToBuf(txid));
    const siblingLE = rev(hexToBuf(sibling));
    const rootBE = bufToHex(rev(sha256d(concat(txidLE, siblingLE))));
    const { headerHex, blockHash } = buildHeaderWithRoot(rootBE);

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
    expect(resA.ok).toBe(true);

    // Envelope using blockHash+height
    const envB: SPVEnvelope = {
      rawTx,
      proof: { txid, merkleRoot: rootBE, path: [{ hash: sibling, position: 'right' }] },
      block: { blockHash, blockHeight: 100 },
    };
    const resB = await verifyEnvelopeAgainstHeaders(envB, idx, 0);
    expect(resB.ok).toBe(true);
  });

  test('envelope verification handles errors correctly', async () => {
    const rawTx = '00';
    const txid = txidFromRawTx(rawTx);
    const sibling = '11'.repeat(32);
    const txidLE = rev(hexToBuf(txid));
    const siblingLE = rev(hexToBuf(sibling));
    const rootBE = bufToHex(rev(sha256d(concat(txidLE, siblingLE))));
    const { headerHex, blockHash } = buildHeaderWithRoot(rootBE);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spv-'));
    const headersPath = path.join(tmpDir, 'headers.json');
    writeHeadersIndex(headersPath, blockHash, rootBE, 100, 105);
    const idx: HeadersIndex = loadHeaders(headersPath);

    // Unknown block hash -> fail
    const envC: SPVEnvelope = {
      rawTx,
      proof: { txid, merkleRoot: rootBE, path: [{ hash: sibling, position: 'right' }] },
      block: { blockHash: 'aa'.repeat(32), blockHeight: 100 },
    };
    const resC = await verifyEnvelopeAgainstHeaders(envC, idx, 0);
    expect(resC.ok).toBe(false);
    expect(resC.reason).toBe('unknown-block-hash');

    // Insufficient confirmations
    const envB: SPVEnvelope = {
      rawTx,
      proof: { txid, merkleRoot: rootBE, path: [{ hash: sibling, position: 'right' }] },
      block: { blockHash, blockHeight: 100 },
    };
    const resBMin = await verifyEnvelopeAgainstHeaders(envB, idx, 10_000);
    expect(resBMin.ok).toBe(false);
    expect(resBMin.reason).toBe('insufficient-confs');
  });

  test('reorg simulation works correctly', async () => {
    const rawTx = '00';
    const txid = txidFromRawTx(rawTx);
    const sibling = '11'.repeat(32);
    const txidLE = rev(hexToBuf(txid));
    const siblingLE = rev(hexToBuf(sibling));
    const rootBE = bufToHex(rev(sha256d(concat(txidLE, siblingLE))));
    const { headerHex, blockHash } = buildHeaderWithRoot(rootBE);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spv-'));
    const headersPath = path.join(tmpDir, 'headers.json');
    writeHeadersIndex(headersPath, blockHash, rootBE, 100, 105);
    const idx: HeadersIndex = loadHeaders(headersPath);

    const envB: SPVEnvelope = {
      rawTx,
      proof: { txid, merkleRoot: rootBE, path: [{ hash: sibling, position: 'right' }] },
      block: { blockHash, blockHeight: 100 },
    };
    const resB = await verifyEnvelopeAgainstHeaders(envB, idx, 0);

    // Reorg simulation: tip moves (bestHeight increases -> more confirmations)
    writeHeadersIndex(headersPath, blockHash, rootBE, 100, 110);
    const idx2 = loadHeaders(headersPath);
    const resB2 = await verifyEnvelopeAgainstHeaders(envB, idx2, 0);
    expect(resB2.ok).toBe(true);
    expect((resB2.confirmations || 0) > (resB.confirmations || 0)).toBe(true);
  });
});