import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

export type Hex = string;

export type MerkleNode = { hash: Hex; position: 'left' | 'right' };

export type SPVEnvelope = {
  rawTx: Hex;
  txid?: Hex;
  proof: {
    txid: Hex;          // big-endian
    merkleRoot: Hex;    // big-endian
    path: MerkleNode[]; // nodes are big-endian hex
  };
  block:
    | { blockHeader: Hex }              // raw 80-byte hex
    | { blockHash: Hex; blockHeight: number };
  headerChain?: Hex[];
  confirmations?: number;
  ts?: number;
};

export type HeaderRecord = {
  hash: Hex;        // big-endian hex
  prevHash: Hex;    // big-endian hex
  merkleRoot: Hex;  // big-endian hex
  height: number;
};

export type HeadersIndex = {
  bestHeight: number;
  tipHash: Hex;
  byHash: Map<string, HeaderRecord>;
  byHeight: Map<number, HeaderRecord>;
};

/* ------------------------ helpers ------------------------ */

function normHex(h: string): string {
  return (h || '').toLowerCase();
}
function hexToBytesBE(hex: Hex): Buffer {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) throw new Error('invalid hex');
  return Buffer.from(hex, 'hex');
}
function bytesToHexBE(buf: Buffer): Buffer {
  return buf.toString('hex');
}
function rev(buf: Buffer): Buffer {
  const c = Buffer.from(buf);
  c.reverse();
  return c;
}
function sha256d(buf: Buffer): Buffer {
  const a = createHash('sha256').update(buf).digest();
  const b = createHash('sha256').update(a).digest();
  return b;
}

/* ------------------------ txid & header parsing ------------------------ */

export function txidFromRawTx(rawTxHex: Hex): Hex {
  const raw = hexToBytesBE(normHex(rawTxHex));
  const le = sha256d(raw);
  return bytesToHexBE(rev(le)); // display big-endian
}

export function parseBlockHeader(raw80Hex: Hex): {
  blockHash: Hex;
  merkleRoot: Hex;
  prevHash: Hex;
  version: number;
  time: number;
  bits: number;
  nonce: number;
} {
  const raw = hexToBytesBE(normHex(raw80Hex));
  if (raw.length !== 80) throw new Error('blockHeader must be 80 bytes');

  const versionLE = raw.readInt32LE(0);
  const prevHashLE = raw.subarray(4, 36);
  const merkleRootLE = raw.subarray(36, 68);
  const timeLE = raw.readUInt32LE(68);
  const bitsLE = raw.readUInt32LE(72);
  const nonceLE = raw.readUInt32LE(76);

  const blockHashLE = sha256d(raw);
  return {
    blockHash: bytesToHexBE(rev(blockHashLE)),
    merkleRoot: bytesToHexBE(rev(merkleRootLE)),
    prevHash: bytesToHexBE(rev(prevHashLE)),
    version: versionLE,
    time: timeLE,
    bits: bitsLE,
    nonce: nonceLE,
  };
}

/* ------------------------ merkle verification ------------------------ */

export function verifyMerklePath(
  leafTxidHexBE: Hex,
  path: MerkleNode[],
  merkleRootHexBE: Hex,
): boolean {
  const leafBE = normHex(leafTxidHexBE);
  const rootBE = normHex(merkleRootHexBE);
  if (!/^[0-9a-fA-F]{64}$/.test(leafBE) || !/^[0-9a-fA-F]{64}$/.test(rootBE)) return false;

  // Start with LE bytes for hashing
  let accLE = rev(hexToBytesBE(leafBE));
  for (const step of path) {
    const nodeLE = rev(hexToBytesBE(normHex(step.hash)));
    const concat =
      step.position === 'left'
        ? Buffer.concat([nodeLE, accLE])
        : Buffer.concat([accLE, nodeLE]);
    accLE = sha256d(concat);
  }
  const accBE = bytesToHexBE(rev(accLE));
  return accBE === rootBE;
}

/* ------------------------ headers loader ------------------------ */
/*
  Supported JSON mirror formats:
  A) {
       "bestHeight": 800000,
       "tipHash": "....",
       "headers": [
         { "hash": "...", "prevHash": "...", "merkleRoot": "...", "height": 799999 }
       ]
     }
  B) {
       "bestHeight": 800000,
       "tipHash": "...",
       "byHash": {
         "<hash>": { "prevHash": "...", "merkleRoot": "...", "height": 799999 }
       }
     }
*/
export function loadHeaders(filePath: string): HeadersIndex {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`headers file not found: ${abs}`);
  const json = JSON.parse(fs.readFileSync(abs, 'utf8'));

  const byHash = new Map<string, HeaderRecord>();
  const byHeight = new Map<number, HeaderRecord>();
  const tipHash = normHex(json.tipHash || '');
  const bestHeight =
    typeof json.bestHeight === 'number'
      ? json.bestHeight
      : 0;

  if (Array.isArray(json.headers)) {
    for (const h of json.headers) {
      const rec: HeaderRecord = {
        hash: normHex(h.hash),
        prevHash: normHex(h.prevHash),
        merkleRoot: normHex(h.merkleRoot),
        height: h.height,
      };
      byHash.set(rec.hash, rec);
      byHeight.set(rec.height, rec);
    }
  } else if (json.byHash && typeof json.byHash === 'object') {
    for (const [hash, v] of Object.entries<any>(json.byHash)) {
      const rec: HeaderRecord = {
        hash: normHex(hash),
        prevHash: normHex(v.prevHash),
        merkleRoot: normHex(v.merkleRoot),
        height: v.height,
      };
      byHash.set(rec.hash, rec);
      byHeight.set(rec.height, rec);
    }
  } else {
    throw new Error('unsupported headers format');
  }

  return { bestHeight, tipHash, byHash, byHeight };
}

export function getHeader(idx: HeadersIndex, blockHashBE: Hex): HeaderRecord | undefined {
  return idx.byHash.get(normHex(blockHashBE));
}

export function getConfirmationCount(idx: HeadersIndex, blockHashBE: Hex): number {
  const rec = getHeader(idx, blockHashBE);
  if (!rec) return 0;
  return idx.bestHeight - rec.height + 1;
}

/* ------------------------ envelope verification ------------------------ */

export async function verifyEnvelopeAgainstHeaders(
  env: SPVEnvelope,
  idx: HeadersIndex,
  minConfs: number,
): Promise<{ ok: boolean; reason?: string; confirmations?: number }> {
  // txid consistency
  const derived = txidFromRawTx(env.rawTx);
  const proofTxid = normHex(env.proof.txid);
  if (env.txid && normHex(env.txid) !== proofTxid) {
    return { ok: false, reason: 'txid-mismatch-top-level-vs-proof' };
  }
  if (derived !== proofTxid) {
    return { ok: false, reason: 'txid-mismatch-rawtx-vs-proof' };
  }

  // Resolve merkleRoot
  let merkleRootBE: Hex | undefined;
  let blockHashForConfs: Hex | undefined;

  if ('blockHeader' in env.block) {
    try {
      const parsed = parseBlockHeader(env.block.blockHeader);
      merkleRootBE = parsed.merkleRoot;
      blockHashForConfs = parsed.blockHash;
    } catch {
      return { ok: false, reason: 'invalid-block-header' };
    }
  } else if ('blockHash' in env.block) {
    const rec = getHeader(idx, env.block.blockHash);
    if (!rec) return { ok: false, reason: 'unknown-block-hash' };
    if (typeof env.block.blockHeight === 'number' && env.block.blockHeight !== rec.height) {
      return { ok: false, reason: 'block-height-mismatch' };
    }
    merkleRootBE = rec.merkleRoot;
    blockHashForConfs = rec.hash;
  }

  if (!merkleRootBE) return { ok: false, reason: 'merkle-root-unavailable' };

  // Merkle inclusion
  const ok = verifyMerklePath(proofTxid, env.proof.path, merkleRootBE);
  if (!ok) return { ok: false, reason: 'invalid-merkle-path' };

  // Confirmations
  const confs = blockHashForConfs ? getConfirmationCount(idx, blockHashForConfs) : 0;
  if (confs < minConfs) return { ok: false, reason: 'insufficient-confs', confirmations: confs };

  return { ok: true, confirmations: confs };
}
