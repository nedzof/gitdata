/**
 * Verify a BRC-36 SPV envelope against our local header store.
 * - Computes merkle root from txid and merklePath
 * - Confirms the blockHeader matches that root
 * - Returns { ok, confs, blockHash, height }
 *
 * NOTES:
 * - This assumes merklePath is a compact hex list joined with ':' or a JSON array of {hash,left:boolean}.
 *   Adjust parseMerklePath() to your envelope encoding.
 */

import { createHash } from 'node:crypto';
import { getHeaderByHash, getConfirmations } from './header-store';
import type { BRC36 } from '../brc';

function sha256dHexBE(hexA: string, hexB: string): string {
  // Double SHA-256, big-endian output
  const a = Buffer.from(hexA, 'hex');
  const b = Buffer.from(hexB, 'hex');
  const h1 = createHash('sha256').update(Buffer.concat([a, b])).digest();
  const h2 = createHash('sha256').update(h1).digest();
  // big-endian hex
  return Buffer.from(h2).reverse().toString('hex');
}
function txidFromRawTx(rawTxHex: string): string {
  const buf = Buffer.from(rawTxHex, 'hex');
  const h1 = createHash('sha256').update(buf).digest();
  const h2 = createHash('sha256').update(h1).digest();
  return Buffer.from(h2).reverse().toString('hex'); // big-endian txid
}

type PathStep = { hash: string; left: boolean };

/** Parse merkle path. Update this if your envelope uses a different encoding. */
function parseMerklePath(mp: string | PathStep[]): PathStep[] {
  if (Array.isArray(mp)) return mp;
  // assume "hash[:hash[:...]]" right-side siblings by default
  const parts = String(mp || '').split(':').filter(Boolean);
  return parts.map((h) => ({ hash: h, left: false }));
}

/** Extract merkleRoot from header hex (assumes big-endian inside 'merkleRoot' field of compact header if known). */
function merkleRootFromHeaderHex(headerHex: string): string {
  // Bitcoin header: 80 bytes LE fields. The merkle root sits at bytes 36..68 LE.
  // Convert to big-endian hex for comparison.
  const h = Buffer.from(headerHex, 'hex');
  if (h.length !== 80) throw new Error('header hex is not 80 bytes');
  const merkleLE = h.subarray(36, 68);
  return Buffer.from(merkleLE).reverse().toString('hex');
}

/** Block hash from header hex (big-endian) */
function blockHashFromHeaderHex(headerHex: string): string {
  const h1 = createHash('sha256').update(Buffer.from(headerHex, 'hex')).digest();
  const h2 = createHash('sha256').update(h1).digest();
  return Buffer.from(h2).reverse().toString('hex');
}

export async function verifyEnvelope(env: BRC36.SPVEnvelope): Promise<{ ok: boolean; confs: number; blockHash?: string; height?: number; reason?: string }> {
  try {
    if (!env?.rawTx || !env?.proof?.blockHeader) return { ok: false, confs: 0, reason: 'missing fields' };
    const txid = txidFromRawTx(env.rawTx);
    const steps = parseMerklePath(env.proof.merklePath || []);
    // Reconstruct merkle root (Bitcoin uses little-endian txids internally; we operate in BE by reversing at concat points)
    let curLE = Buffer.from(txid, 'hex').reverse().toString('hex');
    for (const s of steps) {
      const sibLE = Buffer.from(s.hash, 'hex').reverse().toString('hex');
      const left = s.left ? sibLE : curLE;
      const right = s.left ? curLE : sibLE;
      const nextBE = sha256dHexBE(left, right);  // result big-endian
      curLE = Buffer.from(nextBE, 'hex').reverse().toString('hex'); // keep LE for next round
    }
    const rootBE = Buffer.from(curLE, 'hex').reverse().toString('hex');
    const hdrHex = env.proof.blockHeader.replace(/^0x/, '');
    if (Buffer.from(hdrHex, 'hex').length !== 80) return { ok: false, confs: 0, reason: 'bad header size' };
    const rootFromHeader = merkleRootFromHeaderHex(hdrHex);
    if (rootBE.toLowerCase() !== rootFromHeader.toLowerCase()) {
      return { ok: false, confs: 0, reason: 'merkle mismatch' };
    }
    const blockHash = blockHashFromHeaderHex(hdrHex);
    const h = getHeaderByHash(blockHash);
    if (!h) return { ok: false, confs: 0, reason: 'unknown block header in local store' };
    const confs = getConfirmations(blockHash);
    return { ok: confs > 0, confs, blockHash, height: h.height };
  } catch (e: any) {
    return { ok: false, confs: 0, reason: e?.message || 'verify error' };
  }
}
