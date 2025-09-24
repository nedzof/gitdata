"use strict";
/**
 * Identity signer (BRC-31 style) for protected requests.
 * - secp256k1 compressed keys (hex)
 * - Signature over a domain-separated preimage: "Gitdata-Req|v1|" + nonce + "|" + sha256hex(body)
 *
 * Notes:
 * - Keep the preimage stable to avoid header replay ambiguity.
 * - On server side, re-build the same preimage and verify the signature with the provided public key.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentitySigner = void 0;
exports.buildPreimage = buildPreimage;
exports.verifyIdentitySignature = verifyIdentitySignature;
const secp256k1_1 = require("@noble/curves/secp256k1");
const sha256_1 = require("@noble/hashes/sha256");
// ---------- utils ----------
function toHex(bytes) {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
function fromHex(hex) {
    const s = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (s.length % 2)
        throw new Error('hex length must be even');
    return new Uint8Array(s.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
}
function utf8(s) {
    return new TextEncoder().encode(s);
}
function sha256hex(bytes) {
    const h = (0, sha256_1.sha256)(bytes);
    return toHex(h);
}
function randomNonce() {
    // Prefer crypto.randomUUID() if available in your runtime
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
// ---------- preimage ----------
/**
 * Build a canonical preimage we sign/verify.
 * Any change here must be mirrored on the server verify path.
 */
function buildPreimage(body, nonce) {
    const bodyHash = sha256hex(utf8(body ?? ''));
    return `Gitdata-Req|v1|${nonce}|${bodyHash}`;
}
// ---------- signer ----------
class IdentitySigner {
    constructor(privateKeyHex) {
        this.sk = fromHex(privateKeyHex);
        const pk = secp256k1_1.secp256k1.getPublicKey(this.sk, true);
        this.pkCompressedHex = toHex(pk);
    }
    getPublicKeyHex() {
        return this.pkCompressedHex;
    }
    /**
     * Sign an arbitrary message (domain-separated preimage preferred).
     * Returns DER-encoded signature hex.
     */
    signMessage(preimage) {
        const digest = (0, sha256_1.sha256)(utf8(preimage));
        const sig = secp256k1_1.secp256k1.sign(digest, this.sk); // RFC6979 deterministic ECDSA
        return sig.toDERHex();
    }
    /**
     * Build identity headers for a JSON request body (BRC-31 style).
     * If nonce not provided, generates a random one.
     */
    buildIdentityHeaders(body, nonce) {
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
exports.IdentitySigner = IdentitySigner;
// ---------- verification helpers ----------
function verifyIdentitySignature(publicKeyCompressedHex, body, nonce, signatureDerHex) {
    try {
        const preimage = buildPreimage(body ?? '', nonce);
        const digest = (0, sha256_1.sha256)(utf8(preimage));
        const pk = fromHex(publicKeyCompressedHex);
        const sig = secp256k1_1.secp256k1.Signature.fromDER(fromHex(signatureDerHex));
        return secp256k1_1.secp256k1.verify(sig, digest, pk);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=signer.js.map