import assert from 'assert';

// Extract TX building utilities from producer-onboard.ts for testing
function varInt(n: number): Uint8Array {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, (n >> 8) & 0xff);
  return Uint8Array.of(0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
}

function fromHex(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) throw new Error('invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function toHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const a of arrays) { out.set(a, o); o += a.length; }
  return out;
}

function buildRawTxWithOpReturn(scriptHex: string): string {
  const version = Uint8Array.of(1,0,0,0);
  const vinCount = varInt(1);
  const prevTxid = new Uint8Array(32); // null
  const prevVout = Uint8Array.of(0xff,0xff,0xff,0xff); // -1 (coinbase-like)
  const scriptSigLen = varInt(0);
  const sequence = Uint8Array.of(0xff,0xff,0xff,0xff);

  const voutCount = varInt(1);
  const value0 = new Uint8Array(8); // 0 satoshis
  const script = fromHex(scriptHex);
  const scriptLen = varInt(script.length);

  const locktime = new Uint8Array(4);
  const tx = concatBytes([version, vinCount, prevTxid, prevVout, scriptSigLen, sequence, voutCount, value0, scriptLen, script, locktime]);
  return toHex(tx);
}

(async function run() {
  console.log('Testing TX builder utilities...');

  // Test 1: varInt encoding
  console.log('1. Testing varInt encoding');
  assert.deepStrictEqual(varInt(0), Uint8Array.of(0));
  assert.deepStrictEqual(varInt(252), Uint8Array.of(252));
  assert.deepStrictEqual(varInt(253), Uint8Array.of(0xfd, 253, 0));
  assert.deepStrictEqual(varInt(65535), Uint8Array.of(0xfd, 0xff, 0xff));
  assert.deepStrictEqual(varInt(65536), Uint8Array.of(0xfe, 0x00, 0x00, 0x01, 0x00));
  console.log('✓ varInt encoding works correctly');

  // Test 2: hex conversion
  console.log('2. Testing hex conversion');
  const testBytes = Uint8Array.of(0x00, 0xff, 0x12, 0x34);
  const hexStr = toHex(testBytes);
  const backToBytes = fromHex(hexStr);
  assert.strictEqual(hexStr, '00ff1234');
  assert.deepStrictEqual(backToBytes, testBytes);
  console.log('✓ Hex conversion works correctly');

  // Test 3: TX building with simple OP_RETURN
  console.log('3. Testing TX building');
  const opReturnScript = '6a0444554d4d59'; // OP_RETURN "DUMY"
  const rawTx = buildRawTxWithOpReturn(opReturnScript);

  assert.ok(typeof rawTx === 'string', 'Should return hex string');
  assert.ok(rawTx.length > 0, 'Should not be empty');
  assert.ok(/^[0-9a-f]+$/.test(rawTx), 'Should be valid hex');

  // Basic structure validation
  const txBytes = fromHex(rawTx);
  assert.ok(txBytes.length > 50, 'TX should have reasonable size');

  // Check version (first 4 bytes, little endian)
  const version = txBytes.slice(0, 4);
  assert.deepStrictEqual(version, Uint8Array.of(1,0,0,0), 'Version should be 1');

  console.log('✓ TX building works correctly');
  console.log('  Raw TX length:', rawTx.length / 2, 'bytes');
  console.log('  Sample TX:', rawTx.slice(0, 32) + '...');

  // Test 4: Error handling
  console.log('4. Testing error handling');
  try {
    fromHex('invalid');
    assert.fail('Should have thrown for invalid hex');
  } catch (e: any) {
    assert.ok(e.message.includes('invalid hex'));
    console.log('✓ Correctly handles invalid hex');
  }

  try {
    fromHex('123'); // odd length
    assert.fail('Should have thrown for odd length hex');
  } catch (e: any) {
    assert.ok(e.message.includes('invalid hex'));
    console.log('✓ Correctly handles odd length hex');
  }

  console.log('');
  console.log('OK: All TX builder tests passed! ✓');
})().catch((e) => {
  console.error('TX builder tests failed:', e);
  process.exit(1);
});