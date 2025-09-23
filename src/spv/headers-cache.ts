import fs from 'fs';
import path from 'path';

import { getCacheTTLs } from '../cache/ttls';

import { loadHeaders, type HeadersIndex } from './verify-envelope';

let memo: {
  file: string;
  idx: HeadersIndex;
  loadedAtMs: number;
  mtimeMs: number;
} | null = null;

/**
 * Get a headers snapshot with simple TTL + mtime invalidation.
 * If the file's mtime changes or TTL expires, reload via loadHeaders().
 */
export function getHeadersSnapshot(headersFile: string): HeadersIndex {
  const abs = path.resolve(headersFile);
  const ttl = getCacheTTLs().headers;

  const now = Date.now();
  const stat = fs.statSync(abs);
  const mtimeMs = stat.mtimeMs;

  if (!memo || memo.file !== abs || now - memo.loadedAtMs > ttl || memo.mtimeMs !== mtimeMs) {
    const idx = loadHeaders(abs);
    memo = { file: abs, idx, loadedAtMs: now, mtimeMs };
  }
  return memo.idx;
}

/** Force invalidate the memoized headers snapshot (used in tests if needed) */
export function invalidateHeadersSnapshot() {
  memo = null;
}
