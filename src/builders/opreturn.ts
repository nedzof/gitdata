// OP_RETURN script builder helpers

export function ascii(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

export function toHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

export function fromHex(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('invalid hex');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function pushData(data: Uint8Array): Uint8Array {
  const len = data.length;
  if (len < 0x4c) {
    const out = new Uint8Array(1 + len);
    out[0] = len;
    out.set(data, 1);
    return out;
  }
  if (len <= 0xff) {
    const out = new Uint8Array(2 + len);
    out[0] = 0x4c; // OP_PUSHDATA1
    out[1] = len;
    out.set(data, 2);
    return out;
  }
  if (len <= 0xffff) {
    const out = new Uint8Array(3 + len);
    out[0] = 0x4d; // OP_PUSHDATA2
    out[1] = len & 0xff;
    out[2] = (len >> 8) & 0xff;
    out.set(data, 3);
    return out;
  }
  const out = new Uint8Array(5 + len);
  out[0] = 0x4e; // OP_PUSHDATA4
  out[1] = len & 0xff;
  out[2] = (len >> 8) & 0xff;
  out[3] = (len >> 16) & 0xff;
  out[4] = (len >> 24) & 0xff;
  out.set(data, 5);
  return out;
}

export function buildOpReturnScript(blob: Uint8Array): string {
  const OP_FALSE = 0x00;
  const OP_RETURN = 0x6a;
  const pushed = pushData(blob);
  const script = new Uint8Array(2 + pushed.length);
  script[0] = OP_FALSE;
  script[1] = OP_RETURN;
  script.set(pushed, 2);
  return toHex(script);
}

export function buildOpReturnScriptMulti(blobs: Uint8Array[]): string {
  const OP_FALSE = 0x00;
  const OP_RETURN = 0x6a;
  const parts = blobs.map(pushData);
  const totalDataLen = parts.reduce((n, p) => n + p.length, 0);
  const script = new Uint8Array(2 + totalDataLen);
  script[0] = OP_FALSE;
  script[1] = OP_RETURN;
  let o = 2;
  for (const p of parts) {
    script.set(p, o);
    o += p.length;
  }
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

/** Script length for OP_FALSE OP_RETURN (single push) */
export function opReturnScriptLen(dataLen: number): number {
  const opcodes = 2; // OP_FALSE, OP_RETURN
  return opcodes + pushdataHeaderLen(dataLen) + dataLen;
}

/** Bitcoin varint size for N */
export function varIntSize(n: number): number {
  if (n < 0xfd) return 1;
  if (n <= 0xffff) return 3; // 0xfd + 2 bytes
  if (n <= 0xffffffff) return 5; // 0xfe + 4 bytes
  return 9; // 0xff + 8 bytes
}

/** Serialized output size: 8 (value) + varint(scriptLen) + scriptLen */
export function opReturnOutputSize(dataLen: number): number {
  const scriptLen = opReturnScriptLen(dataLen);
  return 8 + varIntSize(scriptLen) + scriptLen;
}
