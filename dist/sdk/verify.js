"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchHeaders = fetchHeaders;
exports.verifyBundleSPV = verifyBundleSPV;
const verify_envelope_1 = require("../spv/verify-envelope");
async function fetchHeaders(headersUrl, f = fetch) {
    const res = await f(headersUrl);
    if (!res.ok)
        throw new Error(`headers fetch failed: ${res.status}`);
    const js = await res.json();
    // Reuse server-side loader to normalize into in-memory index
    // We write to a temp file not needed; instead emulate supported shapes:
    if (js.byHash || js.headers) {
        // Simple inliner: write to a temporary file is overkill; construct index similar to loadHeaders
        const byHash = new Map();
        const byHeight = new Map();
        const bestHeight = Number(js.bestHeight || 0);
        const tipHash = String(js.tipHash || '').toLowerCase();
        if (Array.isArray(js.headers)) {
            for (const h of js.headers) {
                const rec = {
                    hash: String(h.hash).toLowerCase(),
                    prevHash: String(h.prevHash || '').toLowerCase(),
                    merkleRoot: String(h.merkleRoot).toLowerCase(),
                    height: Number(h.height),
                };
                byHash.set(rec.hash, rec);
                byHeight.set(rec.height, rec);
            }
        }
        else if (js.byHash && typeof js.byHash === 'object') {
            for (const [k, v] of Object.entries(js.byHash)) {
                const rec = {
                    hash: String(k).toLowerCase(),
                    prevHash: String(v.prevHash || '').toLowerCase(),
                    merkleRoot: String(v.merkleRoot).toLowerCase(),
                    height: Number(v.height),
                };
                byHash.set(rec.hash, rec);
                byHeight.set(rec.height, rec);
            }
        }
        return { bestHeight, tipHash, byHash, byHeight };
    }
    throw new Error('unsupported headers shape');
}
/**
 * Verify all SPV envelopes in a bundle against headers (from local headersUrl or provided index).
 * Returns { ok, results, minConfirmations }.
 */
async function verifyBundleSPV(bundle, opts) {
    const f = opts.fetchImpl || fetch;
    const minConfs = Number(opts.minConfs ?? 0);
    const idx = opts.headersIdx || (opts.headersUrl ? await fetchHeaders(opts.headersUrl, f) : null);
    if (!idx)
        throw new Error('headers required: provide headersUrl or headersIdx');
    const results = [];
    let minC = Number.POSITIVE_INFINITY;
    for (const p of bundle.proofs) {
        const vr = await (0, verify_envelope_1.verifyEnvelopeAgainstHeaders)(p.envelope, idx, minConfs);
        results.push({
            versionId: p.versionId,
            ok: vr.ok,
            reason: vr.reason,
            confirmations: vr.confirmations,
        });
        if (vr.ok && typeof vr.confirmations === 'number')
            minC = Math.min(minC, vr.confirmations);
    }
    const ok = results.every((r) => r.ok);
    return { ok, results, minConfirmations: isFinite(minC) ? minC : undefined };
}
//# sourceMappingURL=verify.js.map