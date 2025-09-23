// src/identity/verifier.ts
/**
 * Server-side identity header verification (BRC-31 style)
 * Rebuilds the canonical preimage and verifies the DER signature with the provided compressed pubkey.
 */

import type { BRC31 } from '../brc';

import { verifyIdentitySignature, buildPreimage } from './signer';

export type IdentityVerifyResult =
  | { ok: true; identityKey: string; nonce: string }
  | { ok: false; error: string };

export function verifyIdentityHeaders(
  headers: Partial<BRC31.IdentityHeaders> | Record<string, string>,
  body: string,
): IdentityVerifyResult {
  try {
    // Accept case-insensitive header names (Node's req.headers)
    const hk = (k: string) =>
      (headers as any)[k] ?? (headers as any)[k.toLowerCase()] ?? (headers as any)[k.toUpperCase()];

    const identityKey = String(hk('X-Identity-Key') || '');
    const nonce = String(hk('X-Nonce') || '');
    const signature = String(hk('X-Signature') || '');

    if (!identityKey || !nonce || !signature) {
      return { ok: false, error: 'missing_identity_headers' };
    }
    // Rebuild preimage for auditable debug/tracing (optional)
    // const preimage = buildPreimage(body ?? '', nonce);

    const valid = verifyIdentitySignature(identityKey, body ?? '', nonce, signature);
    if (!valid) return { ok: false, error: 'invalid_signature' };

    return { ok: true, identityKey, nonce };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'verify_error' };
  }
}

/**
 * Simple guard for use inside handlers:
 * const body = await readBody(req); const v = requireIdentity(req.headers, body); if (!v.ok) 401...
 */
export function requireIdentity(
  headers: Partial<BRC31.IdentityHeaders> | Record<string, string>,
  body: string,
): IdentityVerifyResult {
  const res = verifyIdentityHeaders(headers, body);
  return res.ok ? res : res; // kept for symmetry; you can throw here if preferred
}
