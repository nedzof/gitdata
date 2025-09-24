export type SDKOptions = {
    baseUrl: string;
    headersUrl?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
};
export type ReadyResult = {
    ready: boolean;
    reason?: string | null;
    confirmations?: number;
};
export type PriceQuote = {
    versionId: string;
    contentHash: string | null;
    unitSatoshis: number;
    quantity: number;
    totalSatoshis: number;
    ruleSource: 'version-rule' | 'version-override' | 'producer-rule' | 'default';
    tierFrom: number;
    expiresAt: number;
};
export type Receipt = {
    receiptId: string;
    versionId: string;
    contentHash: string | null;
    quantity: number;
    amountSat: number;
    status: 'pending' | 'paid' | 'consumed' | 'expired';
    createdAt: number;
    expiresAt: number;
};
export type LineageBundle = {
    bundleType: 'datasetLineageBundle';
    target: string;
    graph: {
        nodes: {
            versionId: string;
            manifestHash: string;
            txo: string;
        }[];
        edges: {
            child: string;
            parent: string;
        }[];
    };
    manifests: {
        manifestHash: string;
        manifest: any;
    }[];
    proofs: {
        versionId: string;
        envelope: any;
    }[];
};
export type HeadersIndex = import('../spv/verify-envelope').HeadersIndex;
