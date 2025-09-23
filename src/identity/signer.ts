/**
 * Identity signer (BRC-31 style) for protected requests.
 * - secp256k1 compressed keys (hex)
 * - Signature over a domain-separated preimage: "Gitdata-Req|v1|" + nonce + "|" + sha256hex(body)
 *
 * Notes:
 * - Keep the preimage stable to avoid header replay ambiguity.
 * - On server side, re-build the same preimage and verify the signature with the provided public key.
 */

import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

// ---------- utils ----------
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
function fromHex(hex: string): Uint8Array {
  const s = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (s.length % 2) throw new Error('hex length must be even');
  return new Uint8Array(s.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}
function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
function sha256hex(bytes: Uint8Array): string {
  const h = sha256(bytes);
  return toHex(h);
}
function randomNonce(): string {
  // Prefer crypto.randomUUID() if available in your runtime
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// ---------- preimage ----------
/**
 * Build a canonical preimage we sign/verify.
 * Any change here must be mirrored on the server verify path.
 */
export function buildPreimage(body: string, nonce: string): string {
  const bodyHash = sha256hex(utf8(body ?? ''));
  return `Gitdata-Req|v1|${nonce}|${bodyHash}`;
}

// ---------- signer ----------
export class IdentitySigner {
  private sk: Uint8Array;
  private pkCompressedHex: string;

  constructor(privateKeyHex: string) {
    this.sk = fromHex(privateKeyHex);
    const pk = secp256k1.getPublicKey(this.sk, true);
    this.pkCompressedHex = toHex(pk);
  }

  getPublicKeyHex(): string {
    return this.pkCompressedHex;
  }

  /**
   * Sign an arbitrary message (domain-separated preimage preferred).
   * Returns DER-encoded signature hex.
   */
  signMessage(preimage: string): string {
    const digest = sha256(utf8(preimage));
    const sig = secp256k1.sign(digest, this.sk); // RFC6979 deterministic ECDSA
    return sig.toDERHex();
  }

  /**
   * Build identity headers for a JSON request body (BRC-31 style).
   * If nonce not provided, generates a random one.
   */
  buildIdentityHeaders(body: string, nonce?: string): Record<string, string> {
    const nn = nonce || randomNonce();
    const preimage = buildPreimage(body ?? '', nn);
    const signatureHex = this.signMessage(preimage);
    return {
      'content-type': 'application/json',
      'X-Identity-Key': this.pkCompressedHex,
      'X-Nonce': nn,
      'X-Signature': signatureHex,
    };
  }
}

// ---------- verification helpers ----------
export function verifyIdentitySignature(
  publicKeyCompressedHex: string,
  body: string,
  nonce: string,
  signatureDerHex: string,
): boolean {
  try {
    const preimage = buildPreimage(body ?? '', nonce);
    const digest = sha256(utf8(preimage));
    const pk = fromHex(publicKeyCompressedHex);
    const sig = secp256k1.Signature.fromDER(fromHex(signatureDerHex));
    return secp256k1.verify(sig, digest, pk);
  } catch {
    return false;
  }
}
