import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// Endianness policy: JSON/API hex are big-endian; hashing is done over little-endian bytes (byte-reversed).
// We reverse inputs before hashing and reverse the final hash back to compare with big-endian targets.

type Hex = string;

export type MerkleNode = { hash: Hex; position: 'left' | 'right' };

export type SPVEnvelope = {
  rawTx: Hex;
  txid?: Hex; // big-endian hex; if missing, we derive from rawTx
  proof: {
    txid: Hex; // big-endian hex
    merkleRoot: Hex; // big-endian hex (when provided)
    path: MerkleNode[]; // node.hash are big-endian hex
  };
  block:
    | { blockHeader: Hex } // raw 80-byte header hex
    | { blockHash: Hex; blockHeight: number }; // display big-endian hex
  headerChain?: Hex[]; // optional list of raw 80-byte headers (hex), oldest->newest
  confirmations?: number;
  ts?: number;
};

export type HeaderRecord = {
  hash: Hex;        // big-endian display hex
  prevHash: Hex;    // big-endian display hex
  merkleRoot: Hex;  // big-endian display hex
  height: number;
};

export type HeadersIndex = {
  bestHeight: number;
  tipHash: Hex;
  byHash: Map<string, HeaderRecord>;
  byHeight: Map<number, HeaderRecord>;
};

/* ------------------------ Hex/Bytes helpers ------------------------ */

function normalizeHex(h: string): string {
  return (h || '').toLowerCase();
}

function hexToBytesBE(hex: Hex): Buffer {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('Invalid hex');
  }
  return Buffer.from(hex, 'hex');
}

function bytesToHexBE(buf: Buffer): Hex {
  return buf.toString('hex');
}

function reverseBytes(buf: Buffer): Buffer {
  const c = Buffer.from(buf);
  c.reverse();
  return c;
}

function sha256d(buf: Buffer): Buffer {
  const h1 = createHash('sha256').update(buf).digest();
  const h2 = createHash('sha256').update(h1).digest();
  return h2;
}

/* ------------------------ TXID helpers ------------------------ */

// txidFromRawTx returns big-endian hex display string.
// Internally: txid bytes = sha256d(rawTxBytes), then reversed for display.
export function txidFromRawTx(rawTxHex: Hex): Hex {
  const raw = hexToBytesBE(normalizeHex(rawTxHex));
  const hashLE = sha256d(raw);           // little-endian bytes
  const hashBE = reverseBytes(hashLE);   // display big-endian
  return bytesToHexBE(hashBE);
}

/* ------------------------ Block header parsing ------------------------ */

// Parse a raw 80-byte block header hex; return big-endian display fields and block hash.
export function parseBlockHeader(raw80Hex: Hex): {
  blockHash: Hex;      // big-endian
  merkleRoot: Hex;     // big-endian
  prevHash: Hex;       // big-endian
  version: number;
  time: number;
  bits: number;
  nonce: number;
} {
  const raw = hexToBytesBE(normalizeHex(raw80Hex));
  if (raw.length !== 80) throw new Error('blockHeader must be 80 bytes');

  const versionLE = raw.readInt32LE(0);

  const prevHashLE = raw.subarray(4, 36);
  const merkleRootLE = raw.subarray(36, 68);

  const timeLE = raw.readUInt32LE(68);
  const bitsLE = raw.readUInt32LE(72);
  const nonceLE = raw.readUInt32LE(76);

  const blockHashLE = sha256d(raw);
  const blockHashBE = bytesToHexBE(reverseBytes(blockHashLE));
  const prevHashBE = bytesToHexBE(reverseBytes(prevHashLE));
  const merkleRootBE = bytesToHexBE(reverseBytes(merkleRootLE));

  return {
    blockHash: blockHashBE,
    merkleRoot: merkleRootBE,
    prevHash: prevHashBE,
    version: versionLE,
    time: timeLE,
    bits: bitsLE,
    nonce: nonceLE,
  };
}

/* ------------------------ Merkle verification ------------------------ */

// verifyMerklePath implements big-endian-at-API, little-endian-for-hashing policy.
// - leafTxidHex, node.hash, and merkleRootHex are big-endian display hex.
// - We reverse to LE for hashing, fold, then reverse final accumulator to compare to merkleRootHex.
export function verifyMerklePath(
  leafTxidHex: Hex,
  path: MerkleNode[],
  merkleRootHex: Hex,
): boolean {
  const leafBE = normalizeHex(leafTxidHex);
  const rootBE = normalizeHex(merkleRootHex);
  if (!/^[0-9a-fA-F]{64}$/.test(leafBE)) return false;
  if (!/^[0-9a-fA-F]{64}$/.test(rootBE)) return false;

  let accLE = reverseBytes(hexToBytesBE(leafBE)); // start in LE bytes
  for (const step of path) {
    const nodeBE = normalizeHex(step.hash);
    if (!/^[0-9a-fA-F]{64}$/.test(nodeBE)) return false;
    const nodeLE = reverseBytes(hexToBytesBE(nodeBE));
    const concat =
      step.position === 'left'
        ? Buffer.concat([nodeLE, accLE])
        : Buffer.concat([accLE, nodeLE]);
    accLE = sha256d(concat);
  }
  const accBE = bytesToHexBE(reverseBytes(accLE));
  return accBE === rootBE;
}

/* ------------------------ Headers mirror loader ------------------------ */

// We support two formats for your mirror file to reduce coupling:
// A) { bestHeight, tipHash, headers: [{ hash, prevHash, merkleRoot, height }, ...] }
// B) { bestHeight, tipHash, byHash: { [hash]: { height, merkleRoot, prevHash } } }
// All hashes are expected in big-endian display hex.
export function loadHeaders(filePath: string): HeadersIndex {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const json = JSON.parse(raw);

  const byHash = new Map<string, HeaderRecord>();
  const byHeight = new Map<number, HeaderRecord>();

  const bestHeight =
    typeof json.bestHeight === 'number'
      ? json.bestHeight
      : (() => {
          // If not provided, infer from max height found.
          const heights: number[] = [];
          if (Array.isArray(json.headers)) {
            for (const h of json.headers) heights.push(h.height);
          } else if (json.byHash && typeof json.byHash === 'object') {
            for (const k of Object.keys(json.byHash)) heights.push(json.byHash[k].height);
          }
          return Math.max(...heights, -1);
        })();

  const tipHash: string =
    typeof json.tipHash === 'string'
      ? normalizeHex(json.tipHash)
      : '';

  if (Array.isArray(json.headers)) {
    for (const h of json.headers as HeaderRecord[]) {
      const rec: HeaderRecord = {
        hash: normalizeHex(h.hash),
        prevHash: normalizeHex(h.prevHash),
        merkleRoot: normalizeHex(h.merkleRoot),
        height: h.height,
      };
      byHash.set(rec.hash, rec);
      byHeight.set(rec.height, rec);
    }
  } else if (json.byHash && typeof json.byHash === 'object') {
    for (const [hash, v] of Object.entries<any>(json.byHash)) {
      const rec: HeaderRecord = {
        hash: normalizeHex(hash),
        prevHash: normalizeHex(v.prevHash),
        merkleRoot: normalizeHex(v.merkleRoot),
        height: v.height,
      };
      byHash.set(rec.hash, rec);
      byHeight.set(rec.height, rec);
    }
  } else {
    throw new Error('Unsupported headers format');
  }

  // Continuity sanity checks (light)
  // - tipHash exists if provided
  if (tipHash && !byHash.has(tipHash)) {
    throw new Error('tipHash not present in headers set');
  }

  return { bestHeight, tipHash, byHash, byHeight };
}

export function getHeader(idx: HeadersIndex, blockHash: Hex): HeaderRecord | undefined {
  return idx.byHash.get(normalizeHex(blockHash));
}

export function getConfirmationCount(idx: HeadersIndex, blockHash: Hex): number {
  const h = getHeader(idx, blockHash);
  if (!h) return 0;
  return idx.bestHeight - h.height + 1;
}

/* ------------------------ High-level envelope verification ------------------------ */

export async function verifyEnvelopeAgainstHeaders(
  env: SPVEnvelope,
  idx: HeadersIndex,
  minConfs: number,
): Promise<{ ok: boolean; reason?: string; confirmations?: number }> {
  // 1) txid consistency
  const derivedTxid = txidFromRawTx(env.rawTx);
  const proofTxid = normalizeHex(env.proof.txid);
  if (env.txid && normalizeHex(env.txid) !== proofTxid) {
    return { ok: false, reason: 'txid-mismatch-top-level-vs-proof' };
  }
  if (derivedTxid !== proofTxid) {
    return { ok: false, reason: 'txid-mismatch-rawtx-vs-proof' };
  }

  // 2) Resolve merkleRoot (big-endian hex)
  let merkleRootBE: Hex | undefined;

  if ('blockHeader' in env.block && env.block.blockHeader) {
    try {
      const parsed = parseBlockHeader(env.block.blockHeader);
      merkleRootBE = normalizeHex(parsed.merkleRoot);
      // Optionally, you can also check parsed.blockHash against headers index if present there.
    } catch {
      return { ok: false, reason: 'invalid-block-header' };
    }
  } else if ('blockHash' in env.block) {
    const rec = getHeader(idx, env.block.blockHash);
    if (!rec) return { ok: false, reason: 'unknown-block-hash' };
    // Optional: if blockHeight provided, check consistency with mirror
    if (
      typeof env.block.blockHeight === 'number' &&
      env.block.blockHeight !== rec.height
    ) {
      return { ok: false, reason: 'block-height-mismatch' };
    }
    merkleRootBE = rec.merkleRoot;
  }

  if (!merkleRootBE) return { ok: false, reason: 'merkle-root-unavailable' };

  // 3) Verify Merkle inclusion
  const ok = verifyMerklePath(proofTxid, env.proof.path, merkleRootBE);
  if (!ok) return { ok: false, reason: 'invalid-merkle-path' };

  // 4) Compute confirmations via headers index
  let blockHashForConf: string | undefined;
  if ('blockHeader' in env.block && env.block.blockHeader) {
    // Compute block hash from header and look it up
    try {
      const parsed = parseBlockHeader(env.block.blockHeader);
      blockHashForConf = parsed.blockHash;
    } catch {
      return { ok: false, reason: 'invalid-block-header' };
    }
  } else if ('blockHash' in env.block) {
    blockHashForConf = normalizeHex(env.block.blockHash);
  }

  if (!blockHashForConf) return { ok: false, reason: 'no-block-hash' };
  const confs = getConfirmationCount(idx, blockHashForConf);

  if (confs < minConfs) return { ok: false, reason: 'insufficient-confs', confirmations: confs };

  return { ok: true, confirmations: confs };
}
