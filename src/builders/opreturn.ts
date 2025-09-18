/**
 * OP_RETURN script builder helpers to match your current builders.
 * - Single push: buildOpReturnScript(blob)
 * - Multi-push: buildOpReturnScriptMulti([blob1, blob2, ...])
 * - Tagged CBOR: composeTag('DLM1'|'TRN1'|'OTR1', cborBytes)
 * - Size estimators for fee calculation
 */

export function pushData(data: Uint8Array): Uint8Array {
  const len = data.length;
  if (len < 0x4c) {
    return new Uint8Array([len, ...data]);
  }
  if (len <= 0xff) {
    return new Uint8Array([0x4c, len, ...data]); // OP_PUSHDATA1
  }
  if (len <= 0xffff) {
    const lo = len & 0xff,
      hi = (len >> 8) & 0xff;
    return new Uint8Array([0x4d, lo, hi, ...data]); // OP_PUSHDATA2 (LE)
  }
  const b0 = len & 0xff,
    b1 = (len >> 8) & 0xff,
    b2 = (len >> 16) & 0xff,
    b3 = (len >> 24) & 0xff;
  return new Uint8Array([0x4e, b0, b1, b2, b3, ...data]); // OP_PUSHDATA4 (LE)
}

export function buildOpReturnScript(blob: Uint8Array): string {
  const OP_FALSE = 0x00;
  const OP_RETURN = 0x6a;
  const pushed = pushData(blob);
  const script = new Uint8Array([OP_FALSE, OP_RETURN, ...pushed]);
  return toHex(script);
}

export function buildOpReturnScriptMulti(blobs: Uint8Array[]): string {
  const OP_FALSE = 0x00;
  const OP_RETURN = 0x6a;
  const parts: number[] = [];
  for (const b of blobs) {
    parts.push(...pushData(b));
  }
  const script = new Uint8Array([OP_FALSE, OP_RETURN, ...parts]);
  return toHex(script);
}

/**
 * Compose a data blob as: ASCII TAG (4 bytes) || CBOR bytes
 * Example: tag='DLM1' | 'TRN1' | 'OTR1'
 */
export function composeTag(tag: 'DLM1' | 'TRN1' | 'OTR1', cborBytes: Uint8Array): Uint8Array {
  const tagBytes = ascii(tag);
  const out = new Uint8Array(tagBytes.length + cborBytes.length);
  out.set(tagBytes, 0);
  out.set(cborBytes, tagBytes.length);
  return out;
}

// -------- size estimators (scripts & outputs) --------

/** Pushdata header length given len bytes */
export function pushdataHeaderLen(len: number): number {
  if (len < 0x4c) return 1;
  if (len <= 0xff) return 2;
  if (len <= 0xffff) return 3;
  return 5;
}

/** Script length for OP_FALSE OP_RETURN <data> (single push) */
export function opReturnScriptLen(dataLen: number): number {
  const opcodes = 2; // OP_FALSE, OP_RETURN
  return opcodes + pushdataHeaderLen(dataLen) + dataLen;
}

/** Serialized output size: 8 (value) + varint(scriptLen) + scriptLen */
export function opReturnOutputSize(dataLen: number): number {
  const scriptLen = opReturnScriptLen(dataLen);
  return 8 + varIntSize(scriptLen) + scriptLen;
}

/** Bitcoin varint size for N */
export function varIntSize(n: number): number {
  if (n < 0xfd) return 1;
  if (n <= 0xffff) return 3; // 0xfd + 2 bytes
  if (n <= 0xffffffff) return 5; // 0xfe + 4 bytes
  return 9; // 0xff + 8 bytes
}

// -------- helpers --------

function ascii(s: string): Uint8Array {
  if (s.length !== 4) throw new Error('tag must be 4 ASCII chars');
  return new TextEncoder().encode(s);
}
function toHex(u8: Uint8Array): string {
  return Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
