#!/usr/bin/env tsx
/**
 * headers-mirror.ts
 * Pull → Validate → Atomic write of Bitcoin headers (compact JSON) for SPV.
 *
 * ENV:
 *  - HEADERS_URL   (required) e.g., https://relay.example.com/headers.json
 *  - HEADERS_FILE  (required) e.g., /opt/genius-overlay/data/headers.json
 *  - HEADERS_MIN_LENGTH (optional, default 64) - minimum number of headers expected
 *  - TIMEOUT_MS    (optional, default 10000)
 *  - BACKUP        (optional, default "true") - write timestamped backup if changed
 *
 * exit 0: success (written or no change)
 * exit 1+: error (network/validation/fs)
 */

import fs from 'node:fs/promises';
import path from 'node:path';

type Header = {
  raw: string;         // 80-byte header hex
  hash: string;        // block hash (big-endian hex)
  prevHash: string;    // previous block hash (big-endian hex)
  merkleRoot: string;  // merkle root (big-endian hex)
  height: number;      // block height
  time: number;        // unix timestamp (sec)
};

function nowIso() {
  return new Date().toISOString();
}
function tsStamp() {
  const d = new Date();
  const p = (n: number, w = 2) => n.toString().padStart(w, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(
    d.getUTCHours(),
  )}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function log(msg: string, extra?: Record<string, unknown>) {
  const out = { t: nowIso(), msg, ...(extra || {}) };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out));
}

function isHex(s: string, len?: number) {
  const ss = s?.startsWith('0x') ? s.slice(2) : s;
  if (!/^[0-9a-fA-F]+$/.test(ss)) return false;
  if (len != null && ss.length !== len) return false;
  return true;
}

function isHeader(h: any): h is Header {
  return (
    h &&
    typeof h === 'object' &&
    typeof h.raw === 'string' &&
    typeof h.hash === 'string' &&
    typeof h.prevHash === 'string' &&
    typeof h.merkleRoot === 'string' &&
    Number.isInteger(h.height) &&
    Number.isInteger(h.time) &&
    isHex(h.raw, 160) && // 80 bytes = 160 hex chars
    isHex(h.hash, 64) &&
    isHex(h.prevHash, 64) &&
    isHex(h.merkleRoot, 64)
  );
}

function validateChain(headers: Header[], minLen: number) {
  if (!Array.isArray(headers)) throw new Error('headers must be an array');
  if (headers.length < minLen) throw new Error(`insufficient headers: ${headers.length}`);
  for (let i = 1; i < headers.length; i++) {
    const cur = headers[i];
    const prev = headers[i - 1];
    if (!isHeader(prev) || !isHeader(cur)) {
      throw new Error(`invalid header at index ${i}`);
    }
    if (cur.prevHash.toLowerCase() !== prev.hash.toLowerCase()) {
      throw new Error(`chain break at i=${i}: ${cur.prevHash} != ${prev.hash}`);
    }
    if (!(cur.height === prev.height + 1)) {
      throw new Error(`non-monotonic height at i=${i}: ${cur.height} vs ${prev.height}`);
    }
  }
}

async function readFileOrEmpty(p: string) {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return '';
  }
}

async function main() {
  const HEADERS_URL = process.env.HEADERS_URL || '';
  const HEADERS_FILE = process.env.HEADERS_FILE || '';
  const MIN = parseInt(process.env.HEADERS_MIN_LENGTH || '64', 10);
  const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '10000', 10);
  const BACKUP = (process.env.BACKUP || 'true').toLowerCase() !== 'false';

  if (!HEADERS_URL || !HEADERS_FILE) {
    log('missing env', { error: 'HEADERS_URL and HEADERS_FILE required' });
    process.exit(1);
  }

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  log('fetching headers', { url: HEADERS_URL });
  let res: Response;
  try {
    res = await fetch(HEADERS_URL, { signal: ctrl.signal });
  } catch (e: any) {
    clearTimeout(to);
    log('fetch error', { error: e?.message || String(e) });
    process.exit(2);
  }
  clearTimeout(to);

  if (!res.ok) {
    log('bad status', { status: res.status, statusText: res.statusText });
    process.exit(3);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (e: any) {
    log('json parse error', { error: e?.message || String(e) });
    process.exit(4);
  }

  if (!Array.isArray(json)) {
    log('invalid payload: not array');
    process.exit(5);
  }

  const headers = json as Header[];
  // Validate individual headers
  for (let i = 0; i < headers.length; i++) {
    if (!isHeader(headers[i])) {
      log('invalid header at index', { index: i, header: headers[i] });
      process.exit(6);
    }
  }

  // Validate chain linkage + length
  try {
    validateChain(headers, MIN);
  } catch (e: any) {
    log('chain validation error', { error: e?.message || String(e) });
    process.exit(7);
  }

  // Stringify compact and compare with existing file
  const newStr = JSON.stringify(headers);
  const dir = path.dirname(HEADERS_FILE);
  await fs.mkdir(dir, { recursive: true });
  const prevStr = await readFileOrEmpty(HEADERS_FILE);

  if (prevStr === newStr) {
    log('no change', { count: headers.length, tip: headers.at(-1)?.hash });
    process.exit(0);
  }

  // Write atomically
  const tmp = HEADERS_FILE + '.tmp';
  await fs.writeFile(tmp, newStr, 'utf8');
  await fs.rename(tmp, HEADERS_FILE);

  // Backup (optional)
  if (BACKUP) {
    const backup = path.join(dir, `headers.${tsStamp()}.json`);
    try {
      await fs.writeFile(backup, newStr, 'utf8');
    } catch (e: any) {
      log('backup write error (non-fatal)', { error: e?.message || String(e) });
    }
  }

  log('headers updated', { count: headers.length, tip: headers.at(-1)?.hash });
  process.exit(0);
}

main().catch((e) => {
  log('fatal', { error: e?.message || String(e) });
  process.exit(99);
});
