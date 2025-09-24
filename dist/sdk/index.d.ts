import type { SDKOptions, ReadyResult, PriceQuote, Receipt, LineageBundle } from './types';
export declare class GitdataSDK {
    private baseUrl;
    private headersUrl?;
    private f;
    private timeoutMs;
    constructor(opts: SDKOptions);
    ready(versionId: string): Promise<ReadyResult>;
    bundle(versionId: string): Promise<LineageBundle>;
    verifyBundle(versionIdOrBundle: string | LineageBundle, minConfs?: number): Promise<{
        ok: boolean;
        minConfirmations?: number;
        results: {
            versionId: string;
            ok: boolean;
            reason?: string;
            confirmations?: number;
        }[];
    }>;
    price(versionId: string, quantity?: number): Promise<PriceQuote>;
    pay(versionId: string, quantity?: number): Promise<Receipt>;
    /**
     * streamData: returns a Uint8Array of content bytes (MVP).
     * In production, you may prefer to receive a presigned URL and fetch directly from CDN/storage.
     */
    streamData(contentHash: string, receiptId: string): Promise<Uint8Array>;
}
