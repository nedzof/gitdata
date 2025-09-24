"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheTTLs = getCacheTTLs;
function getCacheTTLs() {
    try {
        const raw = process.env.CACHE_TTLS_JSON;
        if (raw) {
            const js = JSON.parse(raw);
            return {
                headers: Number(js.headers ?? 30000), // 30 seconds - D11H shorter for dynamic confirmations
                bundles: Number(js.bundles ?? 300000), // 5 minutes - D11H envelope cache
                assets: Number(js.assets ?? 300000), // 5 minutes
                listings: Number(js.listings ?? 180000), // 3 minutes
                lineage: Number(js.lineage ?? 120000), // 2 minutes
                sessions: Number(js.sessions ?? 1800000), // 30 minutes
                policies: Number(js.policies ?? 600000), // 10 minutes
                prices: Number(js.prices ?? 120000), // 2 minutes
                staleWhileRevalidate: Number(js.staleWhileRevalidate ?? 60000), // 1 minute
                neg404: Number(js.neg404 ?? 30000), // 30 seconds
                brcVerification: Number(js.brcVerification ?? 10000), // 10 seconds
                brcSignatures: Number(js.brcSignatures ?? 300000), // 5 minutes
                apiClient: Number(js.apiClient ?? 0), // 0 = no cache, force reload
            };
        }
    }
    catch {
        // ignore
    }
    return {
        headers: 30000, // 30 seconds - D11H
        bundles: 300000, // 5 minutes - D11H
        assets: 300000, // 5 minutes
        listings: 180000, // 3 minutes
        lineage: 120000, // 2 minutes
        sessions: 1800000, // 30 minutes
        policies: 600000, // 10 minutes
        prices: 120000, // 2 minutes
        staleWhileRevalidate: 60000, // 1 minute
        neg404: 30000, // 30 seconds
        brcVerification: 10000, // 10 seconds
        brcSignatures: 300000, // 5 minutes
        apiClient: 0, // No cache, force reload
    };
}
//# sourceMappingURL=ttls.js.map