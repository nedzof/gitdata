/**
 * Server-side identity header verification (BRC-31 style)
 * Rebuilds the canonical preimage and verifies the DER signature with the provided compressed pubkey.
 */
import type { BRC31 } from '../brc';
export type IdentityVerifyResult = {
    ok: true;
    identityKey: string;
    nonce: string;
} | {
    ok: false;
    error: string;
};
export declare function verifyIdentityHeaders(headers: Partial<BRC31.IdentityHeaders> | Record<string, string>, body: string): IdentityVerifyResult;
/**
 * Simple guard for use inside handlers:
 * const body = await readBody(req); const v = requireIdentity(req.headers, body); if (!v.ok) 401...
 */
export declare function requireIdentity(headers: Partial<BRC31.IdentityHeaders> | Record<string, string>, body: string): IdentityVerifyResult;
