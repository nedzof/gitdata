export declare function ingestSubmission(opts: {
    manifest: any;
    txid: string;
    rawTx: string;
    envelopeJson?: any;
}): Promise<{
    versionId: string;
    opretVout: number | null;
    tag: 'DLM1' | 'TRN1' | 'UNKNOWN';
}>;
