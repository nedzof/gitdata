export declare function ascii(s: string): Uint8Array;
export declare function toHex(b: Uint8Array): string;
export declare function fromHex(hex: string): Uint8Array;
export declare function pushData(data: Uint8Array): Uint8Array;
export declare function buildOpReturnScript(blob: Uint8Array): string;
export declare function buildOpReturnScriptMulti(blobs: Uint8Array[]): string;
/**
 * Compose a data blob as: ASCII TAG (4 bytes) || CBOR bytes
 * Example: tag='DLM1' | 'TRN1' | 'OTR1'
 */
export declare function composeTag(tag: 'DLM1' | 'TRN1' | 'OTR1', cborBytes: Uint8Array): Uint8Array;
/** Pushdata header length given len bytes */
export declare function pushdataHeaderLen(len: number): number;
/** Bitcoin varint size for N */
export declare function varIntSize(n: number): number;
/** Script length for OP_FALSE OP_RETURN (single push) */
export declare function opReturnScriptLen(dataLen: number): number;
/** Serialized output size: 8 (value) + varint(scriptLen) + scriptLen */
export declare function opReturnOutputSize(dataLen: number): number;
