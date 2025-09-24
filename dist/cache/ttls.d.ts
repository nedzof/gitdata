export type CacheTTLs = {
    headers: number;
    bundles: number;
    assets: number;
    listings: number;
    lineage: number;
    sessions: number;
    policies: number;
    prices: number;
    staleWhileRevalidate: number;
    neg404: number;
    brcVerification: number;
    brcSignatures: number;
    apiClient: number;
};
export declare function getCacheTTLs(): CacheTTLs;
