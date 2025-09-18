// BRC-31: Identity-signed requests
export const BRC31_HEADERS = {
  IDENTITY_KEY: 'X-Identity-Key',
  NONCE: 'X-Nonce',
  SIGNATURE: 'X-Signature',
};

// BRC-22: Submit envelope shape
export interface BRC22_SubmitEnvelope {
  rawTx: string;
  inputs?: Record<string, any>;
  mapiResponses?: { payload: string; signature: string; publicKey: string }[];
  proof?: { merklePath: string; blockHeader: string };
  topics?: string[];
}

// BRC-36: SPV transaction envelope shape
export interface BRC36_SPVEnvelope {
  rawTx: string;
  proof: {
    merklePath: string;
    blockHeader: string;
  };
  inputs?: any;
  mapiResponses?: any[];
}

// Add other BRC shapes as needed
