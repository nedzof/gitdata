import { createHash } from 'crypto';

export type Hex = string;

// Minimal shape helpers for your schema
export type DLM1Manifest = {
  type: 'datasetVersionManifest';
  datasetId: string;
  versionId?: string; // optional 64-hex
  description?: string;
  content: {
    contentHash: Hex;
    sizeBytes?: number;
    mimeType?: string;
    schema?: { uri?: string; schemaHash?: Hex };
    [k: string]: unknown;
  };
  lineage?: {
    parents?: Hex[];
    transforms?: Array<{ name: string; parametersHash?: string; [k: string]: unknown }>;
    [k: string]: unknown;
  };
  provenance: {
    producer?: { identityKey?: string; [k: string]: unknown };
    createdAt: string; // ISO datetime
    locations?: Array<{ type: string; uri: string; [k: string]: unknown }>;
    [k: string]: unknown;
  };
  policy: {
    license: string;
    classification: 'public' | 'internal' | 'restricted' | 'clinical-research';
    pii_flags?: string[];
    [k: string]: unknown;
  };
  signatures?: {
    producer?: { publicKey: string; signature: string; [k: string]: unknown };
    endorsements?: Array<{
      role?: string;
      publicKey: string;
      signature: string;
      expiresAt?: string;
      [k: string]: unknown;
    }>;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

function toHex(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString('hex');
}

function fromHex(hex: string): Uint8Array {
  const h = hex.toLowerCase();
  if (!/^[0-9a-fA-F]*$/.test(h) || h.length % 2 !== 0) throw new Error('invalid hex');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function sha256HexUtf8(s: string): string {
  return createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
}


/**
 * Derive versionId:
 * - If manifest.versionId is a 64-hex, use it (lowercase).
 * - Else compute sha256(canonicalizeManifest(manifest)) as lower 64-hex.
 */
export function deriveVersionId(manifest: DLM1Manifest): Hex {
  const explicit = manifest.versionId;
  if (typeof explicit === 'string' && /^[0-9a-fA-F]{64}$/.test(explicit)) {
    return explicit.toLowerCase();
  }
  return sha256HexUtf8(canonicalizeManifest(manifest)).toLowerCase();
}

/**
 * Extract parents from manifest.lineage.parents (64-hex), unique + lowercase.
 */
export function extractParentsLegacy(manifest: any): Hex[] {
  const arr = manifest.lineage?.parents || [];
  const out = new Set<string>();
  for (const p of arr) {
    if (typeof p === 'string' && /^[0-9a-fA-F]{64}$/.test(p)) out.add(p.toLowerCase());
  }
  return Array.from(out);
}

// ----------------- DLM1 CBOR (on-chain) -----------------
// We encode { "mh": bytes32, "p": [bytes32, ...]? } as a small CBOR map.

function hdr(major: number, n: number): Uint8Array {
  if (n < 24) return Uint8Array.of((major << 5) | n);
  if (n <= 0xff) return Uint8Array.of((major << 5) | 24, n);
  if (n <= 0xffff) return Uint8Array.of((major << 5) | 25, (n >> 8) & 0xff, n & 0xff);
  if (n <= 0xffffffff)
    return Uint8Array.of((major << 5) | 26, (n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
  throw new Error('unsupported length');
}
function encodeText(s: string): Uint8Array {
  const b = Buffer.from(s, 'utf8');
  return concat([hdr(3, b.length), b]);
}
function encodeBytes(b: Uint8Array): Uint8Array {
  return concat([hdr(2, b.length), b]);
}
function encodeArray(items: Uint8Array[]): Uint8Array {
  return concat([hdr(4, items.length), ...items]);
}
function encodeMap(entries: [Uint8Array, Uint8Array][]): Uint8Array {
  return concat([hdr(5, entries.length), ...entries.flat()]);
}
function concat(chunks: Array<Uint8Array | Buffer>): Uint8Array {
  const total = chunks.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of chunks) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

export type Dlm1Anchor = { mh: Hex; p?: Hex[] };

export function encodeDLM1(anchor: Dlm1Anchor): Uint8Array {
  if (!/^[0-9a-fA-F]{64}$/.test(anchor.mh)) throw new Error('mh must be 64-hex');
  const entries: [Uint8Array, Uint8Array][] = [];
  entries.push([encodeText('mh'), encodeBytes(fromHex(anchor.mh))]);
  const parents = anchor.p?.filter(Boolean) || [];
  if (parents.length) {
    for (const h of parents) {
      if (!/^[0-9a-fA-F]{64}$/.test(h)) throw new Error('parent must be 64-hex');
    }
    entries.push([encodeText('p'), encodeArray(parents.map((h) => encodeBytes(fromHex(h))))]);
  }
  return encodeMap(entries);
}

// Decoder limited to our narrow shape (for tests/debug)
export function decodeDLM1(buf: Uint8Array): Dlm1Anchor {
  let i = 0;
  function need(n: number) {
    if (i + n > buf.length) throw new Error('EOF');
  }
  function read(n: number) {
    need(n);
    const out = buf.subarray(i, i + n);
    i += n;
    return out;
  }
  function readHdr(): { major: number; len: number } {
    need(1);
    const a = buf[i++];
    const major = a >> 5;
    const ai = a & 0x1f;
    if (ai < 24) return { major, len: ai };
    if (ai === 24) {
      need(1);
      return { major, len: buf[i++] };
    }
    if (ai === 25) {
      need(2);
      const hi = buf[i++], lo = buf[i++];
      return { major, len: (hi << 8) | lo };
    }
    if (ai === 26) {
      need(4);
      const b0 = buf[i++], b1 = buf[i++], b2 = buf[i++], b3 = buf[i++];
      return { major, len: (b0 << 24) | (b1 << 16) | (b2 << 8) | b3 };
    }
    throw new Error('len too large');
  }
  function readText(): string {
    const { major, len } = readHdr();
    if (major !== 3) throw new Error('expect text');
    return Buffer.from(read(len)).toString('utf8');
  }
  function readBytesHex(): string {
    const { major, len } = readHdr();
    if (major !== 2) throw new Error('expect bytes');
    return toHex(read(len));
  }
  function readArray<T>(fn: () => T, len: number): T[] {
    const out: T[] = [];
    for (let k = 0; k < len; k++) out.push(fn());
    return out;
  }

  const m = readHdr();
  if (m.major !== 5) throw new Error('expect map');
  const out: Dlm1Anchor = { mh: '' };
  for (let e = 0; e < m.len; e++) {
    const key = readText();
    if (key === 'mh') out.mh = readBytesHex();
    else if (key === 'p') {
      const a = readHdr();
      if (a.major !== 4) throw new Error('expect array');
      out.p = readArray(readBytesHex, a.len);
    } else {
      // skip unknown
      const skip = readHdr();
      read(skip.len);
    }
  }
  if (!/^[0-9a-fA-F]{64}$/.test(out.mh)) throw new Error('missing/invalid mh');
  return out;
}

/**
 * Convenience: build DLM1 anchor fields from a manifest per your schema.
 */
export function anchorFromManifest(manifest: any): Dlm1Anchor {
  const mh = deriveVersionId(manifest);
  const p = extractParents(manifest);
  return { mh, p: p.length ? p : undefined };
}

// D01 specification functions
const EXCLUDE_KEYS = new Set(['signatures', 'versionId']);

export function canonicalizeManifest(manifest: any): string {
  function sanitize(v: any): any {
    if (Array.isArray(v)) return v.map(sanitize);
    if (v && typeof v === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(v).sort()) {
        if (EXCLUDE_KEYS.has(k)) continue;
        out[k] = sanitize(v[k]);
      }
      return out;
    }
    return v;
  }
  return JSON.stringify(sanitize(manifest));
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
}

/** Derive versionId from canonical manifest; if explicit versionId is provided it must match or throw */
export function deriveManifestIds(manifest: any): { versionId: string; manifestHash: string } {
  const manifestHash = sha256Hex(canonicalizeManifest(manifest)).toLowerCase();
  const explicit = manifest?.versionId;
  if (typeof explicit === 'string' && /^[0-9a-fA-F]{64}$/.test(explicit)) {
    if (explicit.toLowerCase() !== manifestHash) throw new Error('versionId-mismatch: provided versionId does not match canonical manifest hash');
    return { versionId: explicit.toLowerCase(), manifestHash };
  }
  return { versionId: manifestHash, manifestHash };
}

export function extractParents(manifest: any): string[] {
  const parents = manifest?.lineage?.parents;
  if (!Array.isArray(parents)) return [];
  return parents
    .filter((x: any) => typeof x === 'string' && /^[0-9a-fA-F]{64}$/.test(x))
    .map((x: string) => x.toLowerCase());
}

export function buildDlm1AnchorFromManifest(manifest: any): { cbor: Uint8Array; versionId: string; parents: string[] } {
  const { versionId } = deriveManifestIds(manifest);
  const parents = extractParents(manifest);
  const cbor = encodeDLM1({ mh: versionId, p: parents });
  return { cbor, versionId, parents };
}
