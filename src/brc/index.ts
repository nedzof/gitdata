/**
 * BRC standards: minimal, vendor-neutral types and helper guards
 * Keep this as the single import for protocol shapes so Cursor doesn't hallucinate.
 */

export namespace BRC22 {
  /** Submit envelope (subset used by our overlay) */
  export type SubmitEnvelope = {
    rawTx: string; // hex
    inputs?: Record<string, unknown>;
    mapiResponses?: Array<Record<string, unknown>>;
    proof?: {
      merklePath?: string;
      blockHeader?: string;
    };
    topics?: string[];
    manifest?: unknown; // optional off-chain manifest (DLM1)
  };

  export function isSubmitEnvelope(v: any): v is SubmitEnvelope {
    return !!v && typeof v.rawTx === 'string';
  }
}

export namespace BRC31 {
  /** Identity-signed request headers (recommended for /producers/*) */
  export type IdentityHeaders = {
    'X-Identity-Key': string; // hex compressed pubkey
    'X-Nonce': string; // uuid or timestamp nonce
    'X-Signature': string; // signature over body + nonce
  };

  /** Minimal header builder (the actual sign implementation lives in your wallet/identity module) */
  export function buildIdentityHeaders(
    identityKeyHex: string,
    nonce: string,
    signatureHex: string,
  ): IdentityHeaders {
    return {
      'X-Identity-Key': identityKeyHex,
      'X-Nonce': nonce,
      'X-Signature': signatureHex,
    };
  }
}

export namespace BRC36 {
  /** SPV transaction envelope (what we embed in /bundle.proofs[].envelope) */
  export type SPVEnvelope = {
    rawTx: string; // tx hex
    inputs?: Record<string, unknown>;
    mapiResponses?: Array<Record<string, unknown>>;
    proof: {
      merklePath?: string; // hex or compact encoding (overlay-defined)
      blockHeader?: string; // 80-byte header hex
      // You may add additional headers for reorg resistance or header chains
    };
  };

  export function isSPVEnvelope(v: any): v is SPVEnvelope {
    return !!v && typeof v.rawTx === 'string' && !!v.proof && typeof v.proof === 'object';
  }
}

export namespace BRC64 {
  /** Resolve paging semantics */
  export type CursorPage<T> = {
    items: T[];
    nextCursor?: string | null;
  };

  export type VersionNode = {
    versionId: string;
    manifestHash: string;
    txo: string; // txid:vout
    parents?: string[];
    createdAt?: string;
  };
}

export namespace BRC100 {
  /** Minimal wallet client surface for build-and-sign and generic fetch-with-identity */
  export interface WalletClient {
    buildAndSign(outputs: { scriptHex: string; satoshis: number }[]): Promise<{ rawTx: string }>;
    signMessage?(messageHex: string): Promise<string>; // identity signing (optional)
    getIdentityKeyHex?(): Promise<string>;
  }

  /** Attach identity headers for BRC-31 */
  export async function withIdentityHeaders(
    wallet: WalletClient,
    bodyOrEmpty: string,
    extraHeaders?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const nonce = cryptoRandomLike(); // replace with real uuid/nonce if preferred
    const identityKey = (await wallet.getIdentityKeyHex?.()) || '';
    let signature = '';
    if (wallet.signMessage && identityKey) {
      // sign(body + nonce) as hex; message encoding policy is your choice (document it!)
      signature = await wallet.signMessage(Buffer.from(bodyOrEmpty + nonce).toString('hex'));
    }
    return {
      'content-type': 'application/json',
      ...(identityKey ? { 'X-Identity-Key': identityKey } : {}),
      ...(nonce ? { 'X-Nonce': nonce } : {}),
      ...(signature ? { 'X-Signature': signature } : {}),
      ...(extraHeaders || {}),
    };
  }

  function cryptoRandomLike(): string {
    // Very small nonce helper (prefer crypto.randomUUID() in modern runtimes)
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
}
