/**
 * Identity signer (BRC-31 style) for protected requests.
 * - secp256k1 compressed keys (hex)
 * - Signature over a domain-separated preimage: "Gitdata-Req|v1|" + nonce + "|" + sha256hex(body)
 *
 * Notes:
 * - Keep the preimage stable to avoid header replay ambiguity.
 * - On server side, re-build the same preimage and verify the signature with the provided public key.
 */
/**
 * Build a canonical preimage we sign/verify.
 * Any change here must be mirrored on the server verify path.
 */
export declare function buildPreimage(body: string, nonce: string): string;
export declare class IdentitySigner {
    private sk;
    private pkCompressedHex;
    constructor(privateKeyHex: string);
    getPublicKeyHex(): string;
    /**
     * Sign an arbitrary message (domain-separated preimage preferred).
     * Returns DER-encoded signature hex.
     */
    signMessage(preimage: string): string;
    /**
     * Build identity headers for a JSON request body (BRC-31 style).
     * If nonce not provided, generates a random one.
     */
    buildIdentityHeaders(body: string, nonce?: string): Record<string, string>;
}
export declare function verifyIdentitySignature(publicKeyCompressedHex: string, body: string, nonce: string, signatureDerHex: string): boolean;
