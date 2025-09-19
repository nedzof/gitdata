/**
 * Producer Onboard CLI (D15)
 * Flow:
 *  - Build manifest (datasetId, contentHash, provenance.producer with identityKey/name/website)
 *  - POST /submit/dlm1 → get OP_RETURN scriptHex (Wallet-ready)
 *  - Build a minimal rawTx embedding OP_RETURN (dev/demo)
 *  - POST /submit with { rawTx, manifest } → index declaration + producer mapping
 *  - POST /price to set per-version price
 *  - Print shareable links (ready, bundle, price, producer lookup)
 *
 * Note:
 *  - In production, you should broadcast a real signed transaction with your wallet instead of the synthetic TX here.
 *  - This CLI is intended to get you from zero to a working listing quickly on a dev/staging overlay.
 */

import crypto from 'crypto';

type Hex = string;

function exitErr(msg: string, code = 2): never {
  console.error('[onboard] ERROR:', msg);
  process.exit(code);
}

function isHex64(s: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(s);
}
function isPubkey66(s: string): boolean {
  return /^[0-9a-fA-F]{66}$/.test(s);
}

async function httpJson(method: 'GET'|'POST', url: string, body?: any, timeoutMs = 8000): Promise<any> {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method,
      signal: ctl.signal as any,
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      let errBody: any = null;
      try { errBody = await r.json(); } catch {}
      exitErr(`HTTP ${r.status} ${r.statusText} on ${method} ${url} ${errBody ? JSON.stringify(errBody) : ''}`, 1);
    }
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const raw = await r.text();
      return { raw };
    }
    return await r.json();
  } finally {
    clearTimeout(tm);
  }
}

// ---- Minimal TX builder for OP_RETURN-only (dev demo) ----
function varInt(n: number): Uint8Array {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, (n >> 8) & 0xff);
  return Uint8Array.of(0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
}
function fromHex(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) throw new Error('invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function toHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}
function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const a of arrays) { out.set(a, o); o += a.length; }
  return out;
}
/**
 * Build a synthetic raw transaction with one input (null prevout) and one OP_RETURN-only output.
 * Use only for dev/staging indexing; for production, broadcast a real wallet tx embedding the scriptHex.
 */
function buildRawTxWithOpReturn(scriptHex: string): string {
  const version = Uint8Array.of(1,0,0,0);
  const vinCount = varInt(1);
  const prevTxid = new Uint8Array(32); // null
  const prevVout = Uint8Array.of(0xff,0xff,0xff,0xff); // -1 (coinbase-like)
  const scriptSigLen = varInt(0);
  const sequence = Uint8Array.of(0xff,0xff,0xff,0xff);

  const voutCount = varInt(1);
  const value0 = new Uint8Array(8); // 0 satoshis
  const script = fromHex(scriptHex);
  const scriptLen = varInt(script.length);

  const locktime = new Uint8Array(4);
  const tx = concatBytes([version, vinCount, prevTxid, prevVout, scriptSigLen, sequence, voutCount, value0, scriptLen, script, locktime]);
  return toHex(tx);
}

// ---- CLI ----
async function main() {
  const host = (process.env.OVERLAY_URL || 'http://localhost:8788').replace(/\/+$/, '');
  const datasetId = process.env.DATASET_ID || '';
  const contentHash = (process.env.CONTENT_HASH || '').toLowerCase();
  const priceSat = Number(process.env.PRICE_SATS || '0');
  const producerName = process.env.PRODUCER_NAME || '';
  const producerWebsite = process.env.PRODUCER_WEBSITE || '';
  const identityKey = (process.env.IDENTITY_KEY || '').toLowerCase();
  const title = process.env.TITLE || '';
  const minConfs = Number(process.env.POLICY_MIN_CONFS || '1');

  if (!datasetId) exitErr('set DATASET_ID');
  if (contentHash && !isHex64(contentHash)) exitErr('CONTENT_HASH must be 64-hex');
  if (identityKey && !isPubkey66(identityKey)) exitErr('IDENTITY_KEY must be 66-hex compressed pubkey');
  if (!priceSat || priceSat <= 0) exitErr('set PRICE_SATS > 0');

  const ch = contentHash || crypto.randomBytes(32).toString('hex'); // fallback demo content hash

  // 1) Build manifest (off-chain)
  const nowIso = new Date().toISOString();
  const manifest: any = {
    type: 'datasetVersionManifest',
    datasetId,
    description: title || `Dataset ${datasetId}`,
    content: { contentHash: ch },
    provenance: {
      createdAt: nowIso,
      producer: {
        ...(identityKey ? { identityKey } : {}),
        ...(producerName ? { name: producerName } : {}),
        ...(producerWebsite ? { website: producerWebsite } : {}),
      },
      locations: [
        { type: 's3', uri: `s3://your-bucket/${datasetId}/${ch}` }
      ]
    },
    policy: { license: 'cc-by-4.0', classification: 'public' },
    lineage: { parents: [] }
  };

  console.log('[onboard] manifest prepared');

  // 2) Builder → OP_RETURN
  const build = await httpJson('POST', `${host}/submit/dlm1`, { manifest });
  const versionId: Hex = build.versionId;
  const scriptHex: string = build.opReturnScriptHex || build.outputs?.[0]?.scriptHex;
  if (!isHex64(versionId) || !scriptHex) exitErr('builder did not return expected fields');

  console.log('[onboard] versionId:', versionId);
  console.log('[onboard] OP_RETURN scriptHex:', scriptHex.slice(0, 24) + '...');

  // 3) Create synthetic rawTx for demo/staging and submit
  const rawTx = buildRawTxWithOpReturn(scriptHex);
  const submit = await httpJson('POST', `${host}/submit`, { rawTx, manifest });
  const txid = submit.txid;
  console.log('[onboard] indexed txid:', txid);

  // 4) Set price (per-version override)
  const priceResp = await httpJson('POST', `${host}/price`, { versionId, satoshis: priceSat });
  if (priceResp?.status !== 'ok') exitErr('failed to set price');

  // 5) Verify price and ready
  const quote = await httpJson('GET', `${host}/price?versionId=${versionId}`, undefined);
  const ready = await httpJson('GET', `${host}/ready?versionId=${versionId}`, undefined);

  // 6) Producer lookup (mapping by datasetId)
  const prod = await httpJson('GET', `${host}/producers?datasetId=${encodeURIComponent(datasetId)}`, undefined);

  // 7) Links to share
  const links = {
    listing: `${host}/listings`,
    ready: `${host}/ready?versionId=${versionId}`,
    bundle: `${host}/bundle?versionId=${versionId}`,
    price: `${host}/price?versionId=${versionId}`,
    producer: `${host}/producers?datasetId=${encodeURIComponent(datasetId)}`,
  };

  console.log('---');
  console.log('[onboard] SUCCESS');
  console.log(JSON.stringify({
    producerId: prod?.producerId || null,
    datasetId,
    versionId,
    txid,
    price: { satoshis: quote?.unitSatoshis ?? quote?.satoshis, expiresAt: quote?.expiresAt },
    ready,
    links
  }, null, 2));
}

main().catch((e) => exitErr(String(e?.message || e)));