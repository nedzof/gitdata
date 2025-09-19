/**
 * Abortable fetch helpers for upstream calls (e.g., proof providers).
 */

export async function httpGetJson(url: string, timeoutMs = 8000): Promise<any> {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal as any });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error(`unexpected content-type: ${ct}`);
    }
    return await res.json();
  } finally {
    clearTimeout(tm);
  }
}