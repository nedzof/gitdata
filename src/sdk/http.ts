export async function getJson(
  base: string,
  path: string,
  timeoutMs = 8000,
  f: typeof fetch = fetch,
): Promise<any> {
  const url = base.replace(/\/+$/, '') + path;
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await f(url, { signal: ctl.signal as any, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) throw new Error(`unexpected content-type: ${ct}`);
    return await r.json();
  } finally {
    clearTimeout(tm);
  }
}

export async function postJson(
  base: string,
  path: string,
  body: any,
  timeoutMs = 8000,
  f: typeof fetch = fetch,
): Promise<any> {
  const url = base.replace(/\/+$/, '') + path;
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await f(url, {
      method: 'POST',
      signal: ctl.signal as any,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    return await r.json();
  } finally {
    clearTimeout(tm);
  }
}
