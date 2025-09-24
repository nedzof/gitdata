"use strict";
/**
 * Abortable fetch helpers for upstream calls (e.g., proof providers).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpGetJson = httpGetJson;
async function httpGetJson(url, timeoutMs = 8000) {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ctl.signal });
        if (!res.ok)
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            throw new Error(`unexpected content-type: ${ct}`);
        }
        return await res.json();
    }
    finally {
        clearTimeout(tm);
    }
}
//# sourceMappingURL=http.js.map