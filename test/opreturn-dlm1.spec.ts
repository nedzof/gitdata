import assert from 'assert';
import { anchorFromManifest, encodeDLM1, decodeDLM1, deriveVersionId, canonicalizeManifest, type DLM1Manifest } from '../src/dlm1/codec';
import { ascii, toHex, fromHex, pushData, buildOpReturnScript, buildOpReturnScriptMulti, composeTag } from '../src/builders/opreturn';
import { findOpReturnOutputs, findFirstOpReturn } from '../src/utils/opreturn';

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

(function run() {
  // Sample manifest per your schema (no explicit versionId; includes signatures to test canonicalize)
  const manifest: DLM1Manifest = {
    type: 'datasetVersionManifest',
    datasetId: 'open-images-50k',
    content: {
      contentHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      sizeBytes: 123456,
      mimeType: 'application/parquet',
      schema: { uri: 'https://schema.example/parquet', schemaHash: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' }
    },
    lineage: {
      parents: [
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      ],
      transforms: [{ name: 'filter', parametersHash: 'a1b2c3d4' }]
    },
    provenance: {
      createdAt: '2024-07-01T12:00:00Z',
      producer: { identityKey: '02'.padEnd(66, 'f') },
      locations: [{ type: 'http', uri: 'https://example.com/manifest.json' }]
    },
    policy: {
      license: 'cc-by-4.0',
      classification: 'public',
      pii_flags: []
    },
    signatures: {
      producer: { publicKey: '02'.padEnd(66, 'f'), signature: 'deadbeefcafebabe' },
      endorsements: [{ publicKey: '03'.padEnd(66, 'e'), signature: 'beadfeedfa11', role: 'auditor' }]
    }
  };

  // Derive versionId canonically (signatures must be ignored)
  const vId = deriveVersionId(manifest);
  assert.ok(/^[0-9a-fA-F]{64}$/.test(vId), 'derived versionId is 64-hex');

  // Build DLM1 anchor and CBOR
  const anchor = anchorFromManifest(manifest);
  assert.strictEqual(anchor.mh, vId.toLowerCase());
  assert.deepStrictEqual(anchor.p, ['bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']);

  const cbor = encodeDLM1(anchor);
  const decoded = decodeDLM1(cbor);
  assert.strictEqual(decoded.mh, anchor.mh);
  assert.deepStrictEqual(decoded.p, anchor.p);

  // Build OP_RETURN script with [ "DLM1" || cbor ]
  const scriptHex = buildOpReturnScript(composeTag('DLM1', cbor));
  assert.ok(scriptHex.startsWith('006a'), 'OP_FALSE OP_RETURN prefix');

  // Embed into a raw tx and parse back
  const raw = buildTxWithScript(scriptHex);
  const out = findFirstOpReturn(raw);
  assert.ok(out, 'OP_RETURN present');
  assert.strictEqual(out!.tagAscii, 'DLM1');

  // Extract CBOR from first push and decode again
  const pushedHex = out!.pushesHex[0]!;
  const cborHex = pushedHex.slice('DLM1'.length * 2);
  const decoded2 = decodeDLM1(fromHex(cborHex));
  assert.strictEqual(decoded2.mh, anchor.mh);
  assert.deepStrictEqual(decoded2.p, anchor.p);

  // Multi-push script also parses (["DLM1", cbor])
  const scriptHexMulti = buildOpReturnScriptMulti([ascii('DLM1'), cbor]);
  const raw2 = buildTxWithScript(scriptHexMulti);
  const out2 = findFirstOpReturn(raw2);
  assert.ok(out2);
  assert.strictEqual(out2!.tagAscii, 'DLM1');

  // If versionId provided explicitly, it must be respected
  const explicit = { ...manifest, versionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
  const vId2 = deriveVersionId(explicit as DLM1Manifest);
  assert.strictEqual(vId2, explicit.versionId.toLowerCase());

  console.log('OK: DLM1 OP_RETURN build/parse/round-trip with manifest schema');
})();
