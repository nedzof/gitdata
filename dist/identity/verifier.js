"use strict";
// src/identity/verifier.ts
/**
 * Server-side identity header verification (BRC-31 style)
 * Rebuilds the canonical preimage and verifies the DER signature with the provided compressed pubkey.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyIdentityHeaders = verifyIdentityHeaders;
exports.requireIdentity = requireIdentity;
const signer_1 = require("./signer");
function verifyIdentityHeaders(headers, body) {
    try {
        // Accept case-insensitive header names (Node's req.headers)
        const hk = (k) => headers[k] ?? headers[k.toLowerCase()] ?? headers[k.toUpperCase()];
        const identityKey = String(hk('X-Identity-Key') || '');
        const nonce = String(hk('X-Nonce') || '');
        const signature = String(hk('X-Signature') || '');
        if (!identityKey || !nonce || !signature) {
            return { ok: false, error: 'missing_identity_headers' };
        }
        // Rebuild preimage for auditable debug/tracing (optional)
        // const preimage = buildPreimage(body ?? '', nonce);
        const valid = (0, signer_1.verifyIdentitySignature)(identityKey, body ?? '', nonce, signature);
        if (!valid)
            return { ok: false, error: 'invalid_signature' };
        return { ok: true, identityKey, nonce };
    }
    catch (e) {
        return { ok: false, error: e?.message || 'verify_error' };
    }
}
/**
 * Simple guard for use inside handlers:
 * const body = await readBody(req); const v = requireIdentity(req.headers, body); if (!v.ok) 401...
 */
function requireIdentity(headers, body) {
    const res = verifyIdentityHeaders(headers, body);
    return res.ok ? res : res; // kept for symmetry; you can throw here if preferred
}
//# sourceMappingURL=verifier.js.map