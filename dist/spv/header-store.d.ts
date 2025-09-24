/**
 * HeaderStore: reads a compact headers.json (array of {raw,hash,prevHash,merkleRoot,height,time})
 * from HEADERS_FILE, validates linkage, and exposes bestHeight/confirmations/getHeader.
 *
 * Option 1 (MVP): keep HEADERS_FILE fresh via scripts/headers-mirror.ts (public relay → local file).
 */
export type CompactHeader = {
    raw: string;
    hash: string;
    prevHash: string;
    merkleRoot: string;
    height: number;
    time: number;
};
export declare function loadHeadersFile(file: string): Promise<void>;
export declare function getBestHeight(): number;
export declare function getTipHash(): string;
export declare function getHeaderByHash(hash: string): CompactHeader | undefined;
export declare function getConfirmations(blockHash: string): number;
/**
 * Hot reload on interval. Call from overlay bootstrap:
 *   await startHeaderHotReload(process.env.HEADERS_FILE!, 5000)
 */
export declare function startHeaderHotReload(file: string, intervalMs?: number): Promise<void>;
