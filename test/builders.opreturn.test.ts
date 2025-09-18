// test/builders.opreturn.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildOpReturnScript,
  buildOpReturnScriptMulti,
  composeTag,
  opReturnScriptLen,
  opReturnOutputSize,
  varIntSize,
} from '../src/builders/opreturn';

function hex(u8: Uint8Array): string {
  return Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('OP_RETURN builders', () => {
  it('builds a single-push OP_RETURN with expected hex', () => {
    // Minimal CBOR for empty map = 0xa0
    const cborEmptyMap = new Uint8Array([0xa0]);
    const blob = composeTag('DLM1', cborEmptyMap); // 4 ASCII + 1 CBOR = 5 bytes
    // Expect script = 00 6a <len=05> 44 4c 4d 31 a0
    const expected = '006a05' + '444c4d31' + 'a0';
    const scriptHex = buildOpReturnScript(blob);
    expect(scriptHex.toLowerCase()).toBe(expected);
    // Size checks
    expect(opReturnScriptLen(blob.length)).toBe(2 + 1 + 5); // OP_FALSE+OP_RETURN + pushhdr + payload
    expect(opReturnOutputSize(blob.length)).toBe(8 + varIntSize(8) + 8); // 8 val + varint(script) + script
  });

  it('builds a multi-push OP_RETURN with two pushes', () => {
    const cbor = new Uint8Array([0xa0]);
    const a = composeTag('DLM1', cbor); // 5 bytes
    const b = composeTag('TRN1', cbor); // 5 bytes
    const scriptHex = buildOpReturnScriptMulti([a, b]);
    // 00 6a 05 44 4c 4d 31 a0 05 54 52 4e 31 a0
    const expected = '006a05' + '444c4d31' + 'a0' + '05' + '54524e31' + 'a0';
    expect(scriptHex.toLowerCase()).toBe(expected);
  });
});
