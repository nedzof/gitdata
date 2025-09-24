export declare function runPaymentsMigrations(db?: Database.Database): Promise<void>;
export type PaymentTemplateQuote = {
    outputScript: string;
    satoshis: number;
    expiresAt: number;
    templateHash: string;
};
export type PaymentSubmission = {
    rawTx: string;
    templateHash: string;
    outputs: Array<{
        script: string;
        value: number;
    }>;
};
export type PaymentReceiptRow = {
    receipt_id: string;
    version_id: string;
    status: 'pending' | 'quoted' | 'paid' | 'confirmed' | 'expired' | 'failed';
    satoshis: number;
    payment_txid?: string | null;
    fee_sat?: number | null;
    paid_at?: number | null;
    payment_outputs_json?: string | null;
    producer_id: string;
    payout_script_hex?: string | null;
};
export type PaymentProducerRow = {
    producer_id: string;
    identity_key: string;
    name?: string | null;
    website?: string | null;
    created_at: number;
    producer_id: string;
    payout_script_hex?: string | null;
};
export declare function generateQuote(versionId: string, satoshis?: number): Promise<PaymentTemplateQuote | null>;
export declare function submitPayment(receiptId: string, submission: PaymentSubmission): Promise<{
    success: boolean;
    txid?: string;
    error?: string;
}>;
export declare function reconcilePayments(): Promise<void>;
