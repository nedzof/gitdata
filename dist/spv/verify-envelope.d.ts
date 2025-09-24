export type Hex = string;
export type MerkleNode = {
    hash: Hex;
    position: 'left' | 'right';
};
export type SPVEnvelope = {
    rawTx: Hex;
    txid?: Hex;
    proof: {
        txid: Hex;
        merkleRoot: Hex;
        path: MerkleNode[];
    };
    block: {
        blockHeader: Hex;
    } | {
        blockHash: Hex;
        blockHeight: number;
    };
    headerChain?: Hex[];
    confirmations?: number;
    ts?: number;
};
export type HeaderRecord = {
    hash: Hex;
    prevHash: Hex;
    merkleRoot: Hex;
    height: number;
};
export type HeadersIndex = {
    bestHeight: number;
    tipHash: Hex;
    byHash: Map<string, HeaderRecord>;
    byHeight: Map<number, HeaderRecord>;
};
export declare function txidFromRawTx(rawTxHex: Hex): Hex;
export declare function parseBlockHeader(raw80Hex: Hex): {
    blockHash: Hex;
    merkleRoot: Hex;
    prevHash: Hex;
    version: number;
    time: number;
    bits: number;
    nonce: number;
};
export declare function verifyMerklePath(leafTxidHexBE: Hex, path: MerkleNode[], merkleRootHexBE: Hex): boolean;
export declare function loadHeaders(filePath: string): HeadersIndex;
export declare function getHeader(idx: HeadersIndex, blockHashBE: Hex): HeaderRecord | undefined;
export declare function getConfirmationCount(idx: HeadersIndex, blockHashBE: Hex): number;
export declare function verifyEnvelopeAgainstHeaders(env: SPVEnvelope, idx: HeadersIndex, minConfs: number): Promise<{
    ok: boolean;
    reason?: string;
    confirmations?: number;
}>;
