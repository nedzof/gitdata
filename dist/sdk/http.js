"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJson = getJson;
exports.postJson = postJson;
async function getJson(base, path, timeoutMs = 8000, f = fetch) {
    const url = base.replace(/\/+$/, '') + path;
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), timeoutMs);
    try {
        const r = await f(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
        if (!r.ok)
            throw new Error(`HTTP ${r.status} ${r.statusText}`);
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json'))
            throw new Error(`unexpected content-type: ${ct}`);
        return await r.json();
    }
    finally {
        clearTimeout(tm);
    }
}
async function postJson(base, path, body, timeoutMs = 8000, f = fetch) {
    const url = base.replace(/\/+$/, '') + path;
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), timeoutMs);
    try {
        const r = await f(url, {
            method: 'POST',
            signal: ctl.signal,
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(body),
        });
        if (!r.ok)
            throw new Error(`HTTP ${r.status} ${r.statusText}`);
        return await r.json();
    }
    finally {
        clearTimeout(tm);
    }
}
//# sourceMappingURL=http.js.map