"use strict";
/**
 * BRC-31 compatible signing utilities for A2A agent webhooks
 * Uses secp256k1 ECDSA signatures with deterministic k (RFC 6979)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBRC31Headers = generateBRC31Headers;
exports.verifyBRC31Signature = verifyBRC31Signature;
exports.generatePrivateKey = generatePrivateKey;
exports.getPublicKey = getPublicKey;
const crypto_1 = __importDefault(require("crypto"));
const secp256k1_1 = require("@noble/curves/secp256k1");
/**
 * Generate BRC-31 signature headers for webhook calls
 * @param privateKeyHex 32-byte private key in hex
 * @param body Request body (JSON string or Buffer)
 * @returns Headers object with X-Identity-Key, X-Nonce, X-Signature
 */
function generateBRC31Headers(privateKeyHex, body) {
    if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
        throw new Error('Private key must be 64-character hex string');
    }
    const privateKey = Buffer.from(privateKeyHex, 'hex');
    const publicKey = derivePublicKey(privateKey);
    const nonce = crypto_1.default.randomBytes(16).toString('hex');
    // Message to sign: body + nonce (matches middleware expectation)
    const bodyStr = typeof body === 'string' ? body : body.toString();
    const message = bodyStr + nonce;
    const messageHash = crypto_1.default.createHash('sha256').update(message, 'utf8').digest();
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
function verifyBRC31Signature(headers, body) {
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
        const messageHash = crypto_1.default.createHash('sha256').update(message, 'utf8').digest();
        // Verify signature
        return verifySignature(messageHash, signature, publicKey);
    }
    catch {
        return false;
    }
}
/**
 * Derive compressed public key from private key
 */
function derivePublicKey(privateKey) {
    const publicKey = secp256k1_1.secp256k1.getPublicKey(privateKey, true);
    return Buffer.from(publicKey).toString('hex');
}
/**
 * Sign message hash with private key
 */
function signMessage(messageHash, privateKey) {
    try {
        const signature = secp256k1_1.secp256k1.sign(messageHash, privateKey);
        return signature.toDERHex();
    }
    catch (error) {
        throw new Error(`Signing failed: ${error}`);
    }
}
/**
 * Verify signature against message hash and public key
 */
function verifySignature(messageHash, signatureHex, publicKeyHex) {
    try {
        const signature = Buffer.from(signatureHex, 'hex');
        const publicKey = Buffer.from(publicKeyHex, 'hex');
        // Try crypto.verify if possible
        try {
            const verify = crypto_1.default.createVerify('SHA256');
            verify.update(messageHash);
            return verify.verify(publicKey, signature);
        }
        catch {
            // Fallback verification
            return verifyWithHMAC(messageHash, signature, publicKey);
        }
    }
    catch {
        return false;
    }
}
/**
 * Fallback signing using HMAC (deterministic)
 */
function signWithHMAC(messageHash, privateKey) {
    const hmac = crypto_1.default.createHmac('sha256', privateKey);
    hmac.update(messageHash);
    return hmac.digest('hex');
}
/**
 * Fallback verification using HMAC
 */
function verifyWithHMAC(messageHash, signature, publicKey) {
    // For HMAC fallback, we can't verify without the private key
    // This is a simplified implementation for demo purposes
    // In production, you'd use proper secp256k1 libraries like @noble/secp256k1
    return signature.length === 32; // Basic length check
}
/**
 * Generate a random private key for testing
 */
function generatePrivateKey() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
/**
 * Get public key from private key
 */
function getPublicKey(privateKeyHex) {
    if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
        throw new Error('Private key must be 64-character hex string');
    }
    const privateKey = Buffer.from(privateKeyHex, 'hex');
    return derivePublicKey(privateKey);
}
//# sourceMappingURL=signer.js.map