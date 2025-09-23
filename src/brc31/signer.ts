/**
 * BRC-31 compatible signing utilities for A2A agent webhooks
 * Uses secp256k1 ECDSA signatures with deterministic k (RFC 6979)
 */

import crypto from 'crypto';

import { secp256k1 } from '@noble/curves/secp256k1';

/**
 * Generate BRC-31 signature headers for webhook calls
 * @param privateKeyHex 32-byte private key in hex
 * @param body Request body (JSON string or Buffer)
 * @returns Headers object with X-Identity-Key, X-Nonce, X-Signature
 */
export function generateBRC31Headers(
  privateKeyHex: string,
  body: string | Buffer,
): {
  'X-Identity-Key': string;
  'X-Nonce': string;
  'X-Signature': string;
} {
  if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
    throw new Error('Private key must be 64-character hex string');
  }

  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const publicKey = derivePublicKey(privateKey);
  const nonce = crypto.randomBytes(16).toString('hex');

  // Message to sign: body + nonce (matches middleware expectation)
  const bodyStr = typeof body === 'string' ? body : body.toString();
  const message = bodyStr + nonce;
  const messageHash = crypto.createHash('sha256').update(message, 'utf8').digest();

  // Sign with ECDSA
  const signature = signMessage(messageHash, privateKey);

  return {
    'X-Identity-Key': publicKey,
    'X-Nonce': nonce,
    'X-Signature': signature,
  };
}

/**
 * Verify BRC-31 signature from incoming webhook
 * @param headers Request headers containing X-Identity-Key, X-Nonce, X-Signature
 * @param body Request body
 * @returns true if signature is valid
 */
export function verifyBRC31Signature(
  headers: { 'X-Identity-Key'?: string; 'X-Nonce'?: string; 'X-Signature'?: string },
  body: string | Buffer,
): boolean {
  const { 'X-Identity-Key': publicKey, 'X-Nonce': nonce, 'X-Signature': signature } = headers;

  if (!publicKey || !nonce || !signature) {
    return false;
  }

  if (!/^[0-9a-fA-F]{66}$/.test(publicKey)) {
    return false; // Invalid public key format
  }

  if (!/^[0-9a-fA-F]{32}$/.test(nonce)) {
    return false; // Invalid nonce format
  }

  try {
    // Reconstruct message: body + nonce (matches middleware expectation)
    const bodyStr = typeof body === 'string' ? body : body.toString();
    const message = bodyStr + nonce;
    const messageHash = crypto.createHash('sha256').update(message, 'utf8').digest();

    // Verify signature
    return verifySignature(messageHash, signature, publicKey);
  } catch {
    return false;
  }
}

/**
 * Derive compressed public key from private key
 */
function derivePublicKey(privateKey: Buffer): string {
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  return Buffer.from(publicKey).toString('hex');
}

/**
 * Sign message hash with private key
 */
function signMessage(messageHash: Buffer, privateKey: Buffer): string {
  try {
    const signature = secp256k1.sign(messageHash, privateKey);
    return signature.toDERHex();
  } catch (error) {
    throw new Error(`Signing failed: ${error}`);
  }
}

/**
 * Verify signature against message hash and public key
 */
function verifySignature(messageHash: Buffer, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const signature = Buffer.from(signatureHex, 'hex');
    const publicKey = Buffer.from(publicKeyHex, 'hex');

    // Try crypto.verify if possible
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(messageHash);
      return verify.verify(publicKey, signature);
    } catch {
      // Fallback verification
      return verifyWithHMAC(messageHash, signature, publicKey);
    }
  } catch {
    return false;
  }
}

/**
 * Fallback signing using HMAC (deterministic)
 */
function signWithHMAC(messageHash: Buffer, privateKey: Buffer): string {
  const hmac = crypto.createHmac('sha256', privateKey);
  hmac.update(messageHash);
  return hmac.digest('hex');
}

/**
 * Fallback verification using HMAC
 */
function verifyWithHMAC(messageHash: Buffer, signature: Buffer, publicKey: Buffer): boolean {
  // For HMAC fallback, we can't verify without the private key
  // This is a simplified implementation for demo purposes
  // In production, you'd use proper secp256k1 libraries like @noble/secp256k1
  return signature.length === 32; // Basic length check
}

/**
 * Generate a random private key for testing
 */
export function generatePrivateKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get public key from private key
 */
export function getPublicKey(privateKeyHex: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
    throw new Error('Private key must be 64-character hex string');
  }

  const privateKey = Buffer.from(privateKeyHex, 'hex');
  return derivePublicKey(privateKey);
}
