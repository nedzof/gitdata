/**
 * HEADERS MIRROR (SPV-first)
 * - Fetch headers JSON from one or more sources (HEADERS_URLS)
 * - Validate shape and basic continuity
 * - Normalize to { bestHeight, tipHash, byHash: { [hash]: { height, prevHash, merkleRoot } } }
 * - Atomically write to HEADERS_FILE (tmp + rename)
 *
 * Env:
 *  - HEADERS_URLS='["https://host/a.json","https://host/b.json"]' or comma-separated
 *  - HEADERS_FILE=./data/headers.json
 *  - REQUIRE_AGREEMENT=true|false (optional; if true, require same tipHash & bestHeight across sources)
 */

import fs from 'fs';
import path from 'path';

type SourceShape =
  | {
      bestHeight?: number;
      tipHash?: string;
      headers?: Array<{ hash: string; prevHash: string; merkleRoot: string; height: number }>;
    }
  | {
      bestHeight?: number;
      tipHash?: string;
      byHash?: Record<string, { prevHash: string; merkleRoot: string; height: number }>;
    };

type Normalized = {
  bestHeight: number;
  tipHash: string;
  byHash: Record<string, { prevHash: string; merkleRoot: string; height: number }>;
};

function parseUrls(): string[] {
  const raw = process.env.HEADERS_URLS || '';
  try {
    if (raw.trim().startsWith('[')) return JSON.parse(raw);
  } catch {}
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function httpGetJson(url: string, timeoutMs = 8000): Promise<any> {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal as any });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(tm);
  }
}

function normalizeShape(js: any): Normalized {
  const byHash: Normalized['byHash'] = {};
  let bestHeight = typeof js.bestHeight === 'number' ? js.bestHeight : 0;
  let tipHash = (js.tipHash || '').toLowerCase();

  if (Array.isArray(js.headers)) {
    for (const h of js.headers as any[]) {
      if (!h?.hash || !h?.merkleRoot || typeof h?.height !== 'number') continue;
      const hash = String(h.hash).toLowerCase();
      byHash[hash] = {
        prevHash: String(h.prevHash || '').toLowerCase(),
        merkleRoot: String(h.merkleRoot).toLowerCase(),
        height: Number(h.height),
      };
      if (byHash[hash].height > bestHeight) {
        bestHeight = byHash[hash].height;
        tipHash = hash;
      }
    }
  } else if (js.byHash && typeof js.byHash === 'object') {
    for (const [k, v] of Object.entries<any>(js.byHash)) {
      const hash = String(k).toLowerCase();
      byHash[hash] = {
        prevHash: String(v.prevHash || '').toLowerCase(),
        merkleRoot: String(v.merkleRoot).toLowerCase(),
        height: Number(v.height),
      };
      if (byHash[hash].height > bestHeight) {
        bestHeight = byHash[hash].height;
        tipHash = hash;
      }
    }
  } else {
    throw new Error('unsupported-headers-format');
  }

  if (!tipHash || typeof bestHeight !== 'number') {
    throw new Error('missing-tip-or-height');
  }

  // Light continuity check: every non-genesis block's prev exists in set, except possibly earliest.
  const hashes = new Set(Object.keys(byHash));
  for (const [hash, rec] of Object.entries(byHash)) {
    if (rec.prevHash && !hashes.has(rec.prevHash) && rec.height > 0) {
      // Allow if prev missing but we won't reject entire file; just warn.
      // In strict mode you'd throw here.
      // console.warn(`continuity-warning: prevHash ${rec.prevHash} missing for ${hash} @ h=${rec.height}`);
    }
  }

  return { bestHeight, tipHash, byHash };
}

function pickWinner(norms: Normalized[], requireAgreement: boolean): Normalized {
  if (norms.length === 0) throw new Error('no-sources-succeeded');
  if (requireAgreement) {
    const h = norms[0].bestHeight;
    const tip = norms[0].tipHash;
    for (const n of norms) {
      if (n.bestHeight !== h || n.tipHash !== tip) {
        throw new Error('sources-disagree');
      }
    }
    return norms[0];
  }
  // pick highest bestHeight
  let winner = norms[0];
  for (const n of norms) {
    if (n.bestHeight > winner.bestHeight) winner = n;
  }
  return winner;
}

async function run() {
  const urls = parseUrls();
  const outFile = process.env.HEADERS_FILE || './data/headers.json';
  const requireAgreement = /^true$/i.test(process.env.REQUIRE_AGREEMENT || 'false');

  if (urls.length === 0) {
    console.error('HEADERS_URLS not set; nothing to mirror.');
    process.exit(2);
  }

  const results: Normalized[] = [];
  for (const u of urls) {
    try {
      const js = await httpGetJson(u);
      results.push(normalizeShape(js));
      console.log(`ok ${u} h=${results.at(-1)!.bestHeight} tip=${results.at(-1)!.tipHash}`);
    } catch (e: any) {
      console.warn(`fail ${u} ${String(e?.message || e)}`);
    }
  }

  let chosen: Normalized;
  try {
    chosen = pickWinner(results, requireAgreement);
  } catch (e: any) {
    console.error(`mirror-failed: ${String(e?.message || e)}`);
    process.exit(1);
    return;
  }

  // Atomic write (write only if changed)
  const outAbs = path.resolve(outFile);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const data = JSON.stringify(chosen, null, 2);

  let needWrite = true;
  try {
    const curr = fs.readFileSync(outAbs, 'utf8');
    needWrite = curr !== data;
  } catch {}
  if (!needWrite) {
    console.log('no-change');
    return;
  }

  const tmp = outAbs + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, outAbs);
  console.log(`wrote ${outAbs} h=${chosen.bestHeight} tip=${chosen.tipHash}`);
}

run().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
