#!/usr/bin/env tsx
import fs from 'node:fs/promises';
import path from 'node:path';

type Header = { raw: string; hash: string; prevHash: string; merkleRoot: string; height: number; time: number };

function isHex(s: string, len?: number) {
  const ss = s?.startsWith('0x') ? s.slice(2) : s;
  if (!/^[0-9a-fA-F]+$/.test(ss)) return false;
  return len == null ? true : ss.length === len;
}
function isHeader(h: any): h is Header {
  return h && typeof h === 'object' &&
    isHex(h.raw,160) && isHex(h.hash,64) && isHex(h.prevHash,64) && isHex(h.merkleRoot,64) &&
    Number.isInteger(h.height) && Number.isInteger(h.time);
}
function validateChain(headers: Header[]) {
  if (!Array.isArray(headers) || !headers.length) throw new Error('empty');
  for (let i=1;i<headers.length;i++){
    const a = headers[i-1], b = headers[i];
    if (!isHeader(a) || !isHeader(b)) throw new Error(`invalid header ${i}`);
    if (b.prevHash.toLowerCase() !== a.hash.toLowerCase()) throw new Error(`chain break ${i}`);
    if (b.height !== a.height + 1) throw new Error(`height break ${i}`);
  }
}

async function main() {
  const url = process.env.HEADERS_URL!;
  const out = process.env.HEADERS_FILE!;
  const min = parseInt(process.env.HEADERS_MIN_LENGTH || '64', 10);
  if (!url || !out) { console.error('HEADERS_URL and HEADERS_FILE required'); process.exit(1); }
  const res = await fetch(url, { signal: AbortSignal.timeout(parseInt(process.env.TIMEOUT_MS || '10000',10)) });
  if (!res.ok) { console.error('fetch status', res.status); process.exit(2); }
  const arr = await res.json();
  if (!Array.isArray(arr)) { console.error('payload not array'); process.exit(3); }
  arr.forEach((h,i)=>{ if(!isHeader(h)) { console.error('bad header', i); process.exit(4);} });
  validateChain(arr);
  if (arr.length < min) { console.error('too few headers', arr.length); process.exit(5); }
  const txt = JSON.stringify(arr);
  const prev = await fs.readFile(out).then(b=>b.toString()).catch(()=> '');
  if (prev === txt) { console.log('no change'); return; }
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out + '.tmp', txt);
  await fs.rename(out + '.tmp', out);
  console.log('headers updated', arr.length, arr.at(-1)?.hash);
}
main().catch(e=>{ console.error('fatal', e?.message || String(e)); process.exit(99); });
