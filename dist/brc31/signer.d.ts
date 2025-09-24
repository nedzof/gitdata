/**
 * BRC-31 compatible signing utilities for A2A agent webhooks
 * Uses secp256k1 ECDSA signatures with deterministic k (RFC 6979)
 */
/**
 * Generate BRC-31 signature headers for webhook calls
 * @param privateKeyHex 32-byte private key in hex
 * @param body Request body (JSON string or Buffer)
 * @returns Headers object with X-Identity-Key, X-Nonce, X-Signature
 */
export declare function generateBRC31Headers(privateKeyHex: string, body: string | Buffer): {
    'X-Identity-Key': string;
    'X-Nonce': string;
    'X-Signature': string;
};
/**
 * Verify BRC-31 signature from incoming webhook
 * @param headers Request headers containing X-Identity-Key, X-Nonce, X-Signature
 * @param body Request body
 * @returns true if signature is valid
 */
export declare function verifyBRC31Signature(headers: {
    'X-Identity-Key'?: string;
    'X-Nonce'?: string;
    'X-Signature'?: string;
}, body: string | Buffer): boolean;
/**
 * Generate a random private key for testing
 */
export declare function generatePrivateKey(): string;
/**
 * Get public key from private key
 */
export declare function getPublicKey(privateKeyHex: string): string;
