import { type HeadersIndex } from '../spv/verify-envelope';
import type { LineageBundle } from './types';
export declare function fetchHeaders(headersUrl: string, f?: typeof fetch): Promise<HeadersIndex>;
/**
 * Verify all SPV envelopes in a bundle against headers (from local headersUrl or provided index).
 * Returns { ok, results, minConfirmations }.
 */
export declare function verifyBundleSPV(bundle: LineageBundle, opts: {
    headersUrl?: string;
    headersIdx?: HeadersIndex;
    minConfs?: number;
    fetchImpl?: typeof fetch;
}): Promise<{
    ok: boolean;
    results: {
        versionId: string;
        ok: boolean;
        reason?: string;
        confirmations?: number;
    }[];
    minConfirmations?: number;
}>;
