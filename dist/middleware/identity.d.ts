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
import type { Request, Response, NextFunction } from 'express';
/**
 * Verify signature middleware factory.
 * If required=false, it will only verify when headers are present; otherwise, it continues (best-effort).
 * If required=true, missing/invalid signature → 401.
 */
export declare function requireIdentity(required?: boolean): (req: Request & {
    identityKey?: string;
}, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
