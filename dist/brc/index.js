"use strict";
/**
 * BRC standards: minimal, vendor-neutral types and helper guards
 * Keep this as the single import for protocol shapes so Cursor doesn't hallucinate.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRC100 = exports.BRC36 = exports.BRC31 = exports.BRC22 = void 0;
/* eslint-disable @typescript-eslint/no-namespace */
var BRC22;
(function (BRC22) {
    function isSubmitEnvelope(v) {
        return !!v && typeof v.rawTx === 'string';
    }
    BRC22.isSubmitEnvelope = isSubmitEnvelope;
})(BRC22 || (exports.BRC22 = BRC22 = {}));
var BRC31;
(function (BRC31) {
    /** Minimal header builder (the actual sign implementation lives in your wallet/identity module) */
    function buildIdentityHeaders(identityKeyHex, nonce, signatureHex) {
        return {
            'X-Identity-Key': identityKeyHex,
            'X-Nonce': nonce,
            'X-Signature': signatureHex,
        };
    }
    BRC31.buildIdentityHeaders = buildIdentityHeaders;
})(BRC31 || (exports.BRC31 = BRC31 = {}));
var BRC36;
(function (BRC36) {
    function isSPVEnvelope(v) {
        if (!v || typeof v !== 'object')
            return false;
        if (typeof v.rawTx !== 'string')
            return false;
        if (!v.proof || typeof v.proof !== 'object')
            return false;
        if (typeof v.proof.txid !== 'string')
            return false;
        if (typeof v.proof.merkleRoot !== 'string')
            return false;
        if (!Array.isArray(v.proof.path))
            return false;
        const hasHeader = v.block && typeof v.block.blockHeader === 'string';
        const hasHashHeight = v.block && typeof v.block.blockHash === 'string' && Number.isInteger(v.block.blockHeight);
        return !!(hasHeader || hasHashHeight);
    }
    BRC36.isSPVEnvelope = isSPVEnvelope;
})(BRC36 || (exports.BRC36 = BRC36 = {}));
var BRC100;
(function (BRC100) {
    /** Attach identity headers for BRC-31 */
    async function withIdentityHeaders(wallet, bodyOrEmpty, extraHeaders) {
        const nonce = cryptoRandomLike(); // replace with real uuid/nonce if preferred
        const identityKey = (await wallet.getIdentityKeyHex?.()) || '';
        let signature = '';
        if (wallet.signMessage && identityKey) {
            // sign(body + nonce) as hex; message encoding policy is your choice (document it!)
            signature = await wallet.signMessage(Buffer.from(bodyOrEmpty + nonce).toString('hex'));
        }
        return {
            'content-type': 'application/json',
            ...(identityKey ? { 'X-Identity-Key': identityKey } : {}),
            ...(nonce ? { 'X-Nonce': nonce } : {}),
            ...(signature ? { 'X-Signature': signature } : {}),
            ...(extraHeaders || {}),
        };
    }
    BRC100.withIdentityHeaders = withIdentityHeaders;
    function cryptoRandomLike() {
        // Very small nonce helper (prefer crypto.randomUUID() in modern runtimes)
        return Math.random().toString(16).slice(2) + Date.now().toString(16);
    }
})(BRC100 || (exports.BRC100 = BRC100 = {}));
//# sourceMappingURL=index.js.map