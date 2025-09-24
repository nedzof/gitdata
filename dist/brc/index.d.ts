/**
 * BRC standards: minimal, vendor-neutral types and helper guards
 * Keep this as the single import for protocol shapes so Cursor doesn't hallucinate.
 */
export declare namespace BRC22 {
    /** Submit envelope (subset used by our overlay) */
    type SubmitEnvelope = {
        rawTx: string;
        inputs?: Record<string, unknown>;
        mapiResponses?: Array<Record<string, unknown>>;
        proof?: {
            merklePath?: string;
            blockHeader?: string;
        };
        topics?: string[];
        manifest?: unknown;
    };
    function isSubmitEnvelope(v: any): v is SubmitEnvelope;
}
export declare namespace BRC31 {
    /** Identity-signed request headers (recommended for /producers/*) */
    type IdentityHeaders = {
        'X-Identity-Key': string;
        'X-Nonce': string;
        'X-Signature': string;
    };
    /** Minimal header builder (the actual sign implementation lives in your wallet/identity module) */
    function buildIdentityHeaders(identityKeyHex: string, nonce: string, signatureHex: string): IdentityHeaders;
}
export declare namespace BRC36 {
    /** SPV transaction envelope (what we embed in /bundle.proofs[].envelope) */
    type MerkleNode = {
        hash: string;
        position: 'left' | 'right';
    };
    type SPVEnvelope = {
        rawTx: string;
        txid?: string;
        proof: {
            txid: string;
            merkleRoot: string;
            path: MerkleNode[];
        };
        block: {
            blockHeader: string;
        } | {
            blockHash: string;
            blockHeight: number;
        };
        headerChain?: string[];
        confirmations?: number;
        ts?: number;
    };
    function isSPVEnvelope(v: any): v is SPVEnvelope;
}
export declare namespace BRC64 {
    /** Resolve paging semantics */
    type CursorPage<T> = {
        items: T[];
        nextCursor?: string | null;
    };
    type VersionNode = {
        versionId: string;
        manifestHash: string;
        txo: string;
        parents?: string[];
        createdAt?: string;
    };
}
export declare namespace BRC100 {
    /** Minimal wallet client surface for build-and-sign and generic fetch-with-identity */
    interface WalletClient {
        buildAndSign(outputs: {
            scriptHex: string;
            satoshis: number;
        }[]): Promise<string>;
        signMessage?(messageHex: string): Promise<string>;
        getIdentityKeyHex?(): Promise<string>;
    }
    /** Attach identity headers for BRC-31 */
    function withIdentityHeaders(wallet: WalletClient, bodyOrEmpty: string, extraHeaders?: Record<string, string>): Promise<Record<string, string>>;
}
