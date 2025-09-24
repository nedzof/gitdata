"use strict";
/**
 * Identity (BRC-31 style) verifier middleware
 *
 * Policy:
 * - Enabled via ENV IDENTITY_REQUIRED=true|false (default false).
 * - Required for sensitive producer endpoints (POST /submit/dlm1, POST /price, POST/DELETE /price/rules).
 *
 * Signature:
 * - Headers: X-Identity-Key (33-byte compressed pubkey hex), X-Nonce, X-Signature (hex)
 * - Message = sha256( utf8( JSON.stringify(body) + nonce ) )
 * - Verify ECDSA (secp256k1). Accept DER or 64-byte compact (r||s) signatures.
 * - Replay protection: Nonce stored in-memory with TTL (NONCE_TTL_SEC, default 120s).
 *
 * On success: attaches req.identityKey = <hex>.
 * On failure: 401 { error: 'unauthorized', hint }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireIdentity = requireIdentity;
const crypto_1 = require("crypto");
const secp256k1_1 = require("@noble/curves/secp256k1");
const IDENTITY_REQUIRED = /^true$/i.test(process.env.IDENTITY_REQUIRED || 'false');
const NONCE_TTL_SEC = Number(process.env.NONCE_TTL_SEC || 120);
const nonceStore = new Map();
function nowSec() {
    return Math.floor(Date.now() / 1000);
}
function sha256Hex(buf) {
    return (0, crypto_1.createHash)('sha256').update(buf).digest('hex');
}
function normalizeHex(h) {
    return (h || '').toLowerCase();
}
function isCompressedPubKey(hex) {
    return /^[0-9a-fA-F]{66}$/.test(hex) && (hex.startsWith('02') || hex.startsWith('03'));
}
async function verifySigEcdsa(sigHex, msgHashHex, pubKeyHex) {
    try {
        const msg = Buffer.from(msgHashHex, 'hex');
        const pub = Buffer.from(pubKeyHex, 'hex');
        const sig = Buffer.from(sigHex, 'hex');
        // Try DER first (variable length)
        try {
            return secp256k1_1.secp256k1.verify(sig, msg, pub);
        }
        catch {
            // ignore; try compact
        }
        // Try compact 64-byte r||s
        try {
            if (sig.length === 64) {
                return secp256k1_1.secp256k1.verify(sig, msg, pub);
            }
        }
        catch {
            // ignore
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Verify signature middleware factory.
 * If required=false, it will only verify when headers are present; otherwise, it continues (best-effort).
 * If required=true, missing/invalid signature → 401.
 */
function requireIdentity(required = IDENTITY_REQUIRED) {
    return async function identityMiddleware(req, res, next) {
        try {
            const idKey = normalizeHex(String(req.headers['x-identity-key'] || ''));
            const nonce = String(req.headers['x-nonce'] || '');
            const sigHex = normalizeHex(String(req.headers['x-signature'] || ''));
            if (!required && !idKey && !nonce && !sigHex) {
                // Not required and not provided: pass through
                return next();
            }
            if (!isCompressedPubKey(idKey)) {
                return res.status(401).json({
                    error: 'unauthorized',
                    hint: 'missing/invalid X-Identity-Key (compressed pubkey hex)',
                });
            }
            if (!nonce || nonce.length < 8) {
                return res.status(401).json({ error: 'unauthorized', hint: 'missing/invalid X-Nonce' });
            }
            if (!/^[0-9a-fA-F]+$/.test(sigHex) || sigHex.length < 64) {
                return res.status(401).json({ error: 'unauthorized', hint: 'missing/invalid X-Signature' });
            }
            // Replay protection
            // - Nonce must be unused; once seen, it is stored for NONCE_TTL_SEC
            const existing = nonceStore.get(nonce);
            const now = nowSec();
            if (existing && existing.exp >= now) {
                return res.status(401).json({ error: 'unauthorized', hint: 'nonce-reused' });
            }
            // Compute message hash: sha256( JSON.stringify(body) + nonce )
            // body may be undefined → use empty object {} for determinism
            const bodyStr = JSON.stringify(req.body ?? {});
            const msgHashHex = sha256Hex(Buffer.from(bodyStr + nonce, 'utf8'));
            const ok = await verifySigEcdsa(sigHex, msgHashHex, idKey);
            if (!ok) {
                return res.status(401).json({ error: 'unauthorized', hint: 'signature-invalid' });
            }
            // Store nonce
            nonceStore.set(nonce, { exp: now + NONCE_TTL_SEC, key: idKey });
            // Attach identity to request
            req.identityKey = idKey;
            return next();
        }
        catch (e) {
            return res.status(401).json({ error: 'unauthorized', hint: String(e?.message || e) });
        }
    };
}
//# sourceMappingURL=identity.js.map