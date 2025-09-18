import Database from 'better-sqlite3';
import path from 'path';
import { openDb } from '../src/db';
import { setProofEnvelope } from '../src/db';
import {
  loadHeaders,
  verifyEnvelopeAgainstHeaders,
  type HeadersIndex,
  type SPVEnvelope,
} from '../src/spv/verify-envelope';

// Config (env or defaults)
const DB_PATH = process.env.DB_PATH || './data/overlay.db';
const HEADERS_FILE = process.env.HEADERS_FILE || './data/headers.json';
const MIN_CONFS = Number(process.env.POLICY_MIN_CONFS || 1);
const BATCH_LIMIT = Number(process.env.BATCH_LIMIT || 50);
const TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 8000);

// JSON array of base URLs. Each provider should accept GET /tx/:txid/proof and return a JSON.
const PROOF_PROVIDERS: string[] = (() => {
  try {
    if (process.env.PROOF_PROVIDERS_JSON) {
      return JSON.parse(process.env.PROOF_PROVIDERS_JSON);
    }
  } catch {}
  // Default: empty -> nothing to do (you should configure providers)
  return [];
})();

type MissingRow = {
  version_id: string;
  txid: string;
  raw_tx: string | null;
};

type ProviderProof = {
  txid?: string; // 64-hex
  blockHash?: string; // 64-hex
  blockHeight?: number;
  rawTx?: string; // hex
  merkleRoot?: string; // 64-hex (optional if we supply from headers)
  path?: Array<{ hash: string; position?: 'left' | 'right'; left?: boolean }>;
  merklePath?: Array<{ hash: string; position?: 'left' | 'right'; left?: boolean }>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function httpGetJson(url: string): Promise<any> {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(tm);
  }
}

function pick<T>(...vals: (T | undefined)[]): T | undefined {
  for (const v of vals) if (v !== undefined) return v;
  return undefined;
}

// Normalize various provider proof shapes to our envelope fields + path format
function normalizeProviderProof(js: any): {
  txid?: string;
  blockHash?: string;
  blockHeight?: number;
  rawTx?: string;
  path?: { hash: string; position: 'left' | 'right' }[];
} {
  const p = js as ProviderProof;
  const txid = p.txid?.toLowerCase();
  const blockHash = p.blockHash?.toLowerCase();
  const blockHeight = typeof p.blockHeight === 'number' ? p.blockHeight : undefined;
  const rawTx = p.rawTx && /^[0-9a-fA-F]+$/.test(p.rawTx) ? p.rawTx : undefined;

  const srcPath = pick(p.path, p.merklePath);
  let path: { hash: string; position: 'left' | 'right' }[] | undefined = undefined;

  if (Array.isArray(srcPath)) {
    path = srcPath
      .map((n) => {
        const hash = (n as any).hash?.toLowerCase();
        const position =
          (n as any).position ||
          ((typeof (n as any).left === 'boolean') ? ((n as any).left ? 'left' : 'right') : undefined);
        if (!hash || !/^[0-9a-fA-F]{64}$/.test(hash)) return null;
        if (position !== 'left' && position !== 'right') return null;
        return { hash, position };
      })
      .filter(Boolean) as any;
  }

  return { txid, blockHash, blockHeight, rawTx, path };
}

function buildEnvelopeFromProvider(
  row: MissingRow,
  norm: ReturnType<typeof normalizeProviderProof>,
  headersIdx: HeadersIndex,
): SPVEnvelope | null {
  if (!norm.txid || !norm.blockHash || !norm.path || norm.path.length === 0) return null;

  const rec = headersIdx.byHash.get(norm.blockHash);
  if (!rec) return null;

  const rawTx = (row.raw_tx && /^[0-9a-fA-F]+$/.test(row.raw_tx)) ? row.raw_tx : norm.rawTx;
  if (!rawTx) return null;

  const env: SPVEnvelope = {
    rawTx,
    proof: {
      txid: norm.txid,
      merkleRoot: rec.merkleRoot, // authoritative from headers mirror
      path: norm.path,
    },
    block: {
      blockHash: rec.hash,
      blockHeight: rec.height,
    },
  };
  return env;
}

async function fetchProofFromProviders(txid: string): Promise<ReturnType<typeof normalizeProviderProof> | null> {
  for (const base of PROOF_PROVIDERS) {
    const url = `${base.replace(/\/+$/, '')}/tx/${txid}/proof`;
    try {
      const js = await httpGetJson(url);
      const norm = normalizeProviderProof(js);
      if (norm.txid?.toLowerCase() === txid.toLowerCase()) return norm;
    } catch (e) {
      console.warn(`Provider failed ${url}: ${String((e as any)?.message || e)}`);
      continue;
    }
  }
  return null;
}

async function run() {
  if (PROOF_PROVIDERS.length === 0) {
    console.error('No PROOF_PROVIDERS_JSON configured. Nothing to do.');
    process.exit(1);
  }

  const db = openDb(DB_PATH);
  const headersIdx = loadHeaders(HEADERS_FILE);

  // Find declarations missing proof_json
  const sel = db.prepare<unknown[], MissingRow>(`
    SELECT version_id, txid, raw_tx
    FROM declarations
    WHERE (proof_json IS NULL OR proof_json = '')
      AND txid IS NOT NULL
    LIMIT ?
  `);
  const rows = sel.all(BATCH_LIMIT);
  if (!rows.length) {
    console.log('No declarations missing proofs.');
    process.exit(0);
  }

  let okCount = 0;
  let failCount = 0;

  for (const row of rows) {
    const txid = row.txid.toLowerCase();
    process.stdout.write(`txid ${txid} … `);

    try {
      const providerNorm = await fetchProofFromProviders(txid);
      if (!providerNorm) {
        console.log('no-proof-from-providers');
        failCount++;
        continue;
      }

      const env = buildEnvelopeFromProvider(row, providerNorm, headersIdx);
      if (!env) {
        console.log('normalize-failed');
        failCount++;
        continue;
      }

      const vr = await verifyEnvelopeAgainstHeaders(env, headersIdx, MIN_CONFS);
      if (!vr.ok) {
        console.log(`verify-failed:${vr.reason}`);
        failCount++;
        continue;
      }

      setProofEnvelope(db, row.version_id, JSON.stringify(env));
      console.log(`attached (confs=${vr.confirmations ?? 0})`);
      okCount++;

      // Be polite if providers rate-limit
      await sleep(50);
    } catch (e: any) {
      console.log(`error:${String(e?.message || e)}`);
      failCount++;
    }
  }

  console.log(`Done. ok=${okCount} fail=${failCount}`);
  process.exit(failCount > 0 && okCount === 0 ? 2 : 0);
}

run().catch((e) => {
  console.error('attach-proofs fatal:', e);
  process.exit(2);
});
