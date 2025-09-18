import assert from 'assert';
import {
  ascii,
  toHex,
  fromHex,
  pushData,
  buildOpReturnScript,
  buildOpReturnScriptMulti,
  composeTag,
  pushdataHeaderLen,
  opReturnScriptLen,
  varIntSize,
  opReturnOutputSize,
} from '../src/builders/opreturn';
import {
  findOpReturnOutputs,
  findFirstOpReturn,
} from '../src/utils/opreturn';

// Helper: encode Bitcoin varint (for test tx assembly)
function varInt(n: number): Uint8Array {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, (n >> 8) & 0xff);
  if (n <= 0xffffffff) {
    return Uint8Array.of(
      0xfe,
      n & 0xff,
      (n >> 8) & 0xff,
      (n >> 16) & 0xff,
      (n >> 24) & 0xff,
    );
  }
  // 8-byte not needed for tests
  throw new Error('too large');
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

// Build a minimal legacy raw tx with 1 vin, 1 vout (OP_RETURN script)
function buildTestTxWithScript(scriptHex: string): string {
  const version = Uint8Array.of(0x01, 0x00, 0x00, 0x00);

  // vin = 1
  const vinCount = varInt(1);
  const prevTxid = new Uint8Array(32); // 32 bytes 0x00
  const prevVout = Uint8Array.of(0x00, 0x00, 0x00, 0x00);
  const scriptSigLen = varInt(0);
  const sequence = Uint8Array.of(0xff, 0xff, 0xff, 0xff);

  // vout = 1
  const voutCount = varInt(1);
  const value0 = Uint8Array.of(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00); // 0 sat
  const scriptBytes = fromHex(scriptHex);
  const scriptLen0 = varInt(scriptBytes.length);

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
    scriptBytes,
    locktime,
  ]);

  return toHex(tx);
}

function expect(condition: any, msg: string) {
  assert.ok(condition, msg);
}

(function run() {
  // pushdata header lengths
  assert.strictEqual(pushdataHeaderLen(10), 1);
  assert.strictEqual(pushdataHeaderLen(0x4b), 1);
  assert.strictEqual(pushdataHeaderLen(0x4c), 2);
  assert.strictEqual(pushdataHeaderLen(0xff), 2);
  assert.strictEqual(pushdataHeaderLen(0x100), 3);
  assert.strictEqual(pushdataHeaderLen(0xffff), 3);
  assert.strictEqual(pushdataHeaderLen(0x10000), 5);

  // varInt sizing
  assert.strictEqual(varIntSize(10), 1);
  assert.strictEqual(varIntSize(0xfc), 1);
  assert.strictEqual(varIntSize(0xfd), 3);
  assert.strictEqual(varIntSize(0xffff), 3);
  assert.strictEqual(varIntSize(0x10000), 5);

  // Single-push OP_RETURN script with DLM1||payload
  const payload = new Uint8Array([0xa0]); // pretend CBOR map {}
  const tagged = composeTag('DLM1', payload);
  const scriptHex = buildOpReturnScript(tagged);

  // Check script starts with OP_FALSE OP_RETURN
  expect(scriptHex.startsWith('006a'), 'script must start with 00 6a');

  // Multi-push: ["DLM1", 0xa0]
  const scriptHexMulti = buildOpReturnScriptMulti([ascii('DLM1'), payload]);
  expect(scriptHexMulti.startsWith('006a'), 'multi script must start with 00 6a');

  // Build raw tx and parse it (single-push)
  const rawTx1 = buildTestTxWithScript(scriptHex);
  const outs1 = findOpReturnOutputs(rawTx1);
  assert.strictEqual(outs1.length, 1);
  const o1 = outs1[0];
  assert.strictEqual(o1.vout, 0);
  assert.strictEqual(o1.hasOpFalse, true);
  assert.strictEqual(o1.pushesAscii[0], 'DLM1');
  assert.ok(o1.pushesHex[0].toLowerCase() === Buffer.from('DLM1').toString('hex'));

  // Build raw tx and parse it (multi-push)
  const rawTx2 = buildTestTxWithScript(scriptHexMulti);
  const outs2 = findOpReturnOutputs(rawTx2);
  assert.strictEqual(outs2.length, 1);
  const o2 = outs2[0];
  assert.strictEqual(o2.hasOpFalse, true);
  assert.strictEqual(o2.pushesAscii[0], 'DLM1');
  assert.strictEqual(o2.pushesHex.length >= 2, true);

  // Plain OP_RETURN (no OP_FALSE) still detected
  const OP_RETURN = 0x6a;
  const trn1 = ascii('TRN1');
  const pushTrn1 = pushData(trn1);
  const plainScript = toHex(new Uint8Array([OP_RETURN, ...pushTrn1]));
  const rawTx3 = buildTestTxWithScript(plainScript);
  const outs3 = findOpReturnOutputs(rawTx3);
  assert.strictEqual(outs3.length, 1);
  assert.strictEqual(outs3[0].hasOpFalse, false);
  assert.strictEqual(outs3[0].tagAscii, 'TRN1');

  // Size estimators sanity
  const dLen = tagged.length;
  assert.strictEqual(opReturnScriptLen(dLen), 2 + pushdataHeaderLen(dLen) + dLen);
  assert.strictEqual(opReturnOutputSize(dLen), 8 + varIntSize(opReturnScriptLen(dLen)) + opReturnScriptLen(dLen));

  // Large payloads select correct push encodings
  const len4c = 0x4c; // PUSHDATA1 threshold
  const p4c = pushData(new Uint8Array(len4c));
  assert.strictEqual(p4c[0], 0x4c);

  const len2 = 0x100; // PUSHDATA2 threshold
  const p2 = pushData(new Uint8Array(len2));
  assert.strictEqual(p2[0], 0x4d);

  const len4 = 0x10000; // PUSHDATA4 threshold
  const p4 = pushData(new Uint8Array(len4));
  assert.strictEqual(p4[0], 0x4e);

  console.log('OK: OP_RETURN builder and parser tests passed.');
})();
