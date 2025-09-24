"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitdataSDK = void 0;
const http_1 = require("./http");
const verify_1 = require("./verify");
class GitdataSDK {
    constructor(opts) {
        this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
        this.headersUrl = opts.headersUrl;
        this.f = opts.fetchImpl || fetch;
        this.timeoutMs = Number(opts.timeoutMs || 8000);
    }
    async ready(versionId) {
        const path = `/ready?versionId=${encodeURIComponent(versionId)}`;
        return await (0, http_1.getJson)(this.baseUrl, path, this.timeoutMs, this.f);
    }
    async bundle(versionId) {
        const path = `/bundle?versionId=${encodeURIComponent(versionId)}`;
        return await (0, http_1.getJson)(this.baseUrl, path, this.timeoutMs, this.f);
    }
    async verifyBundle(versionIdOrBundle, minConfs = 0) {
        const bundle = typeof versionIdOrBundle === 'string'
            ? await this.bundle(versionIdOrBundle)
            : versionIdOrBundle;
        const { ok, results, minConfirmations } = await (0, verify_1.verifyBundleSPV)(bundle, {
            headersUrl: this.headersUrl,
            minConfs,
            fetchImpl: this.f,
        });
        return { ok, minConfirmations, results };
    }
    async price(versionId, quantity = 1) {
        const q = `/price?versionId=${encodeURIComponent(versionId)}&quantity=${encodeURIComponent(String(quantity))}`;
        return await (0, http_1.getJson)(this.baseUrl, q, this.timeoutMs, this.f);
    }
    async pay(versionId, quantity = 1) {
        return await (0, http_1.postJson)(this.baseUrl, `/pay`, { versionId, quantity }, this.timeoutMs, this.f);
    }
    /**
     * streamData: returns a Uint8Array of content bytes (MVP).
     * In production, you may prefer to receive a presigned URL and fetch directly from CDN/storage.
     */
    async streamData(contentHash, receiptId) {
        const url = `${this.baseUrl}/v1/data?contentHash=${encodeURIComponent(contentHash)}&receiptId=${encodeURIComponent(receiptId)}`;
        const ctl = new AbortController();
        const tm = setTimeout(() => ctl.abort(), this.timeoutMs);
        try {
            const r = await this.f(url, { signal: ctl.signal });
            if (!r.ok)
                throw new Error(`HTTP ${r.status} ${r.statusText}`);
            const buf = new Uint8Array(await r.arrayBuffer());
            return buf;
        }
        finally {
            clearTimeout(tm);
        }
    }
}
exports.GitdataSDK = GitdataSDK;
//# sourceMappingURL=index.js.map