export type Hex = string;
export type OpReturnOutput = {
    vout: number;
    satoshis: bigint;
    scriptHex: string;
    hasOpFalse: boolean;
    pushesHex: string[];
    pushesAscii: (string | null)[];
    tagAscii?: string;
};
/**
 * Parse raw tx hex and return all OP_RETURN-bearing outputs.
 * BSV uses legacy serialization (no segwit). This parser assumes non-segwit format.
 */
export declare function findOpReturnOutputs(rawTxHex: Hex): OpReturnOutput[];
export declare function findFirstOpReturn(rawTxHex: Hex): OpReturnOutput | null;
export declare function detectDlm1OrTrn1(rawTxHex: Hex): {
    tag: 'DLM1' | 'TRN1' | null;
    vout: number | null;
};
