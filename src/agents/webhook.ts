import { createHash } from 'crypto';

import * as secp from '@noble/secp256k1';

const CALL_PRIV_HEX = (process.env.AGENT_CALL_PRIVKEY || '').toLowerCase();
let CALL_PUB_HEX = (process.env.AGENT_CALL_PUBKEY || '').toLowerCase();

function sha256hex(s: string) {
  return createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
}

function ensureKeys() {
  if (!CALL_PRIV_HEX) throw new Error('AGENT_CALL_PRIVKEY not set');
  if (!CALL_PUB_HEX) {
    const pub = secp.getPublicKey(Buffer.from(CALL_PRIV_HEX, 'hex'), true);
    CALL_PUB_HEX = Buffer.from(pub).toString('hex');
  }
}

export async function callAgentWebhook(
  url: string,
  body: any,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
) {
  ensureKeys();
  const nonce = Math.random().toString(16).slice(2) + Date.now().toString(16);
  const msgHash = sha256hex(JSON.stringify(body || {}) + nonce);
  const sigDer = Buffer.from(
    secp.signSync(msgHash, Buffer.from(CALL_PRIV_HEX, 'hex'), { der: true }),
  ).toString('hex');

  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(url, {
      method: 'POST',
      signal: ctl.signal as any,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'X-Identity-Key': CALL_PUB_HEX,
        'X-Nonce': nonce,
        'X-Signature': sigDer,
      },
      body: JSON.stringify(body || {}),
    });
    const txt = await r.text();
    let js: any;
    try {
      js = JSON.parse(txt);
    } catch {
      js = { raw: txt };
    }
    return { status: r.status, body: js };
  } finally {
    clearTimeout(tm);
  }
}
