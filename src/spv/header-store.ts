/**
 * HeaderStore: reads a compact headers.json (array of {raw,hash,prevHash,merkleRoot,height,time})
 * from HEADERS_FILE, validates linkage, and exposes bestHeight/confirmations/getHeader.
 *
 * Option 1 (MVP): keep HEADERS_FILE fresh via scripts/headers-mirror.ts (public relay → local file).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export type CompactHeader = {
  raw: string;       // 80-byte header hex
  hash: string;      // big-endian hex
  prevHash: string;  // big-endian hex
  merkleRoot: string;// big-endian hex
  height: number;
  time: number;
};

type State = {
  headers: CompactHeader[];
  byHash: Map<string, CompactHeader>;
  bestHeight: number;
  tipHash: string;
};

const state: State = { headers: [], byHash: new Map(), bestHeight: 0, tipHash: '' };

function isHex(s: string, len?: number) {
  const ss = s?.startsWith('0x') ? s.slice(2) : s;
  if (!/^[0-9a-fA-F]+$/.test(ss)) return false;
  return len == null ? true : ss.length === len;
}

function isHeader(h: any): h is CompactHeader {
  return (
    h &&
    typeof h === 'object' &&
    typeof h.raw === 'string' &&
    typeof h.hash === 'string' &&
    typeof h.prevHash === 'string' &&
    typeof h.merkleRoot === 'string' &&
    Number.isInteger(h.height) &&
    Number.isInteger(h.time) &&
    isHex(h.raw, 160) &&
    isHex(h.hash, 64) &&
    isHex(h.prevHash, 64) &&
    isHex(h.merkleRoot, 64)
  );
}

function validateChain(headers: CompactHeader[]) {
  if (!Array.isArray(headers) || headers.length === 0) throw new Error('empty headers');
  for (let i = 1; i < headers.length; i++) {
    const cur = headers[i], prev = headers[i - 1];
    if (!isHeader(prev) || !isHeader(cur)) throw new Error(`invalid header at ${i}`);
    if (cur.prevHash.toLowerCase() !== prev.hash.toLowerCase()) {
      throw new Error(`chain break at ${i}: ${cur.prevHash} != ${prev.hash}`);
    }
    if (cur.height !== prev.height + 1) throw new Error(`bad height at ${i}: ${cur.height} vs ${prev.height}`);
  }
}

export async function loadHeadersFile(file: string) {
  const txt = await fs.readFile(path.resolve(file), 'utf8');
  const arr = JSON.parse(txt) as unknown;
  if (!Array.isArray(arr)) throw new Error('headers.json not an array');
  arr.forEach((h, i) => {
    if (!isHeader(h)) throw new Error(`invalid header at ${i}`);
  });
  const headers = arr as CompactHeader[];
  validateChain(headers);
  // Index
  state.headers = headers;
  state.byHash = new Map(headers.map((h) => [h.hash.toLowerCase(), h]));
  const tip = headers[headers.length - 1];
  state.bestHeight = tip.height;
  state.tipHash = tip.hash.toLowerCase();
}

export function getBestHeight(): number {
  return state.bestHeight;
}
export function getTipHash(): string {
  return state.tipHash;
}
export function getHeaderByHash(hash: string): CompactHeader | undefined {
  return state.byHash.get(hash.toLowerCase());
}
export function getConfirmations(blockHash: string): number {
  const h = getHeaderByHash(blockHash);
  if (!h) return 0;
  return Math.max(0, state.bestHeight - h.height + 1);
}

/**
 * Hot reload on interval. Call from overlay bootstrap:
 *   await startHeaderHotReload(process.env.HEADERS_FILE!, 5000)
 */
export async function startHeaderHotReload(file: string, intervalMs = 5000) {
  let last = '';
  async function tick() {
    try {
      const txt = await fs.readFile(path.resolve(file), 'utf8');
      if (txt !== last) {
        // only parse/validate if changed
        const arr = JSON.parse(txt) as unknown;
        if (Array.isArray(arr) && arr.length) {
          (arr as any[]).forEach((h, i) => {
            if (!isHeader(h)) throw new Error(`invalid header at ${i}`);
          });
          validateChain(arr as CompactHeader[]);
          // commit
          await loadHeadersFile(file);
          last = txt;
          // eslint-disable-next-line no-console
          console.log(JSON.stringify({ t: new Date().toISOString(), msg: 'headers.reloaded', bestHeight: state.bestHeight, tip: state.tipHash }));
        }
      }
    } catch (e: any) {
      console.error(JSON.stringify({ t: new Date().toISOString(), msg: 'headers.reload.error', err: e?.message || String(e) }));
    } finally {
      setTimeout(tick, intervalMs).unref?.();
    }
  }
  // initial load
  await loadHeadersFile(file);
  setTimeout(tick, intervalMs).unref?.();
}
