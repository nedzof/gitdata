import assert from 'assert';
import { describe, test, expect } from 'vitest';
import { encodeDLM1, decodeDLM1, buildDlm1AnchorFromManifest, deriveManifestIds } from '../src/dlm1/codec';
import { composeTag, buildOpReturnScript, buildOpReturnScriptMulti, pushData, pushdataHeaderLen, opReturnScriptLen, opReturnOutputSize, ascii, toHex, fromHex } from '../src/builders/opreturn';
import { findFirstOpReturn } from '../src/utils/opreturn';

// Helpers to assemble a minimal raw tx (legacy)
function varInt(n: number): Uint8Array {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, (n >> 8) & 0xff);
  if (n <= 0xffffffff)
    return Uint8Array.of(0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
  throw new Error('too large');
}
function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) { out.set(a, o); o += a.length; }
  return out;
}
function buildTxWithScript(scriptHex: string): string {
  const version = Uint8Array.of(0x01, 0x00, 0x00, 0x00);
  const vinCount = varInt(1);
  const prevTxid = new Uint8Array(32);
  const prevVout = Uint8Array.of(0x00, 0x00, 0x00, 0x00);
  const scriptSigLen = varInt(0);
  const sequence = Uint8Array.of(0xff, 0xff, 0xff, 0xff);
  const voutCount = varInt(1);
  const value0 = new Uint8Array(8); // 0 sat
  const script = fromHex(scriptHex);
  const scriptLen = varInt(script.length);
  const locktime = new Uint8Array(4);

  const tx = concatBytes([
    version, vinCount, prevTxid, prevVout, scriptSigLen, sequence,
    voutCount, value0, scriptLen, script, locktime,
  ]);
  return toHex(tx);
}

describe('DLM1 encode/decode and OP_RETURN tests', () => {
  test('DLM1 encoding and decoding works correctly', () => {
    // Manifest for tests
    const manifest = {
      type: 'datasetVersionManifest',
      datasetId: 'open-images-50k',
      description: 'Test dataset',
      content: { contentHash: 'c'.repeat(64), sizeBytes: 123, mimeType: 'application/parquet' },
      lineage: { parents: ['b'.repeat(64)] },
      provenance: { createdAt: '2024-05-01T00:00:00Z' },
      policy: { license: 'cc-by-4.0', classification: 'public' },
      signatures: { producer: { publicKey: '02'.padEnd(66,'a'), signature: 'dead' } }
    };

    const ids = deriveManifestIds(manifest);
    expect(/^[0-9a-fA-F]{64}$/.test(ids.versionId)).toBe(true);

    const built = buildDlm1AnchorFromManifest(manifest);
    expect(built.versionId).toBe(ids.versionId);

    const cbor = encodeDLM1({ mh: built.versionId, p: built.parents });
    const dec = decodeDLM1(cbor);
    expect(dec.mh).toBe(built.versionId);
    expect(dec.p).toEqual(built.parents);
  });

  test('OP_RETURN script building and parsing works', () => {
    const manifest = {
      type: 'datasetVersionManifest',
      datasetId: 'open-images-50k',
      description: 'Test dataset',
      content: { contentHash: 'c'.repeat(64), sizeBytes: 123, mimeType: 'application/parquet' },
      lineage: { parents: ['b'.repeat(64)] },
      provenance: { createdAt: '2024-05-01T00:00:00Z' },
      policy: { license: 'cc-by-4.0', classification: 'public' },
      signatures: { producer: { publicKey: '02'.padEnd(66,'a'), signature: 'dead' } }
    };

    const built = buildDlm1AnchorFromManifest(manifest);
    const cbor = encodeDLM1({ mh: built.versionId, p: built.parents });

    // Single-push [ "DLM1" || cbor ]
    const blob = composeTag('DLM1', cbor);
    const scriptHex = buildOpReturnScript(blob);
    expect(scriptHex.startsWith('006a')).toBe(true);

    const rawTx = buildTxWithScript(scriptHex);
    const out = findFirstOpReturn(rawTx);
    expect(out).toBeTruthy();
    expect(out!.tagAscii).toBe('DLM1');

    // Extract CBOR and decode
    const pushedHex = out!.pushesHex[0]!;
    const cborHex = pushedHex.slice('DLM1'.length * 2);
    const dec2 = decodeDLM1(fromHex(cborHex));
    expect(dec2.mh).toBe(built.versionId);

    // Multi-push [ "DLM1", cbor ]
    const scriptHexMulti = buildOpReturnScriptMulti([ascii('DLM1'), cbor]);
    const rawTx2 = buildTxWithScript(scriptHexMulti);
    const out2 = findFirstOpReturn(rawTx2);
    expect(out2).toBeTruthy();
    expect(out2!.tagAscii).toBe('DLM1');
  });

  test('PUSHDATA thresholds work correctly', () => {
    const pd1 = pushData(new Uint8Array(0x4c));
    expect(pd1[0]).toBe(0x4c);

    const pd2 = pushData(new Uint8Array(0x100));
    expect(pd2[0]).toBe(0x4d);

    const pd4 = pushData(new Uint8Array(0x10000));
    expect(pd4[0]).toBe(0x4e);
  });

  test('size helpers work correctly', () => {
    const manifest = {
      type: 'datasetVersionManifest',
      datasetId: 'open-images-50k',
      description: 'Test dataset',
      content: { contentHash: 'c'.repeat(64), sizeBytes: 123, mimeType: 'application/parquet' },
      lineage: { parents: ['b'.repeat(64)] },
      provenance: { createdAt: '2024-05-01T00:00:00Z' },
      policy: { license: 'cc-by-4.0', classification: 'public' },
      signatures: { producer: { publicKey: '02'.padEnd(66,'a'), signature: 'dead' } }
    };

    const built = buildDlm1AnchorFromManifest(manifest);
    const cbor = encodeDLM1({ mh: built.versionId, p: built.parents });
    const blob = composeTag('DLM1', cbor);

    const sLen = opReturnScriptLen(blob.length);
    expect(opReturnOutputSize(blob.length)).toBe(8 + (sLen < 0xfd ? 1 : sLen <= 0xffff ? 3 : 5) + sLen);
  });
});
