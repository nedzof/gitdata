// BRC-100 Wallet Interface TypeScript Definitions
// Based on D01B-brc100.md specification

// Basic type definitions
export type DescriptionString5to50Characters = string;
export type LabelStringUnder300Characters = string;
export type OutputTagStringUnder300Characters = string;
export type BasketStringUnder300Characters = string;
export type ProtocolString5To400Characters = string;
export type HexString = string;
export type Base64String = string;
export type OutpointString = string;
export type BEEF = string;
export type PositiveIntegerOrZero = number;
export type BooleanDefaultTrue = boolean;

// Core wallet interface as defined in BRC-100
export interface Wallet {
  /**
   * Creates a new Bitcoin transaction based on the provided inputs, outputs, labels, locks, and other options.
   */
  createAction: (args: {
    description: DescriptionString5to50Characters;
    inputBEEF?: BEEF;
    inputs?: Array<{
      outpoint: OutpointString;
      unlockingScript: HexString;
      inputDescription: DescriptionString5to50Characters;
      sequenceNumber?: PositiveIntegerOrZero;
    }>;
    outputs?: Array<{
      script: HexString;
      satoshis: PositiveIntegerOrZero;
      description?: DescriptionString5to50Characters;
      basket?: BasketStringUnder300Characters;
      customInstructions?: string;
      tags?: OutputTagStringUnder300Characters[];
    }>;
    labels?: LabelStringUnder300Characters[];
    options?: {
      acceptDelayedBroadcast?: BooleanDefaultTrue;
      trustSelf?: 'known';
      knownTxids?: HexString[];
      resultFormat?: 'beef' | 'ef';
      noSend?: boolean;
      noSendChange?: OutputTagStringUnder300Characters[];
      sendWith?: HexString[];
    };
  }) => Promise<{
    txid?: HexString;
    tx?: BEEF;
    noSendChange?: Array<{
      vout: PositiveIntegerOrZero;
      satoshis: PositiveIntegerOrZero;
      script: HexString;
      description?: DescriptionString5to50Characters;
      basket?: BasketStringUnder300Characters;
      tags?: OutputTagStringUnder300Characters[];
    }>;
    sendWithResults?: Array<{ txid: HexString; status: string }>;
    signableTransaction?: {
      tx: BEEF;
      reference: Base64String;
    };
  }>;

  /**
   * Signs a transaction previously created using createAction.
   */
  signAction: (args: {
    spends: Record<
      PositiveIntegerOrZero,
      {
        unlockingScript: HexString;
        sequenceNumber?: PositiveIntegerOrZero;
      }
    >;
    reference: Base64String;
    options?: {
      acceptDelayedBroadcast?: BooleanDefaultTrue;
      trustSelf?: 'known';
      knownTxids?: HexString[];
      resultFormat?: 'beef' | 'ef';
      noSend?: boolean;
      noSendChange?: OutputTagStringUnder300Characters[];
      sendWith?: HexString[];
    };
  }) => Promise<{
    txid?: HexString;
    tx?: BEEF;
    noSendChange?: Array<{
      vout: PositiveIntegerOrZero;
      satoshis: PositiveIntegerOrZero;
      script: HexString;
      description?: DescriptionString5to50Characters;
      basket?: BasketStringUnder300Characters;
      tags?: OutputTagStringUnder300Characters[];
    }>;
    sendWithResults?: Array<{ txid: HexString; status: string }>;
  }>;

  /**
   * Aborts a transaction that was created but not yet completed.
   */
  abortAction: (args: { reference: Base64String }) => Promise<{
    aborted: boolean;
  }>;

  /**
   * Lists actions (transactions) based on labels and other criteria.
   */
  listActions: (args: {
    labels: LabelStringUnder300Characters[];
    labelQueryMode?: 'any' | 'all';
    includeLabels?: boolean;
    includeInputs?: boolean;
    includeInputSourceLockingScripts?: boolean;
    includeInputUnlockingScripts?: boolean;
    includeOutputs?: boolean;
    includeOutputLockingScripts?: boolean;
    limit?: PositiveIntegerOrZero;
    offset?: PositiveIntegerOrZero;
  }) => Promise<{
    totalActions: PositiveIntegerOrZero;
    actions: Array<{
      txid: HexString;
      satoshis: number;
      status: string;
      isOutgoing: boolean;
      description: DescriptionString5to50Characters;
      labels?: LabelStringUnder300Characters[];
      version: PositiveIntegerOrZero;
      lockTime: PositiveIntegerOrZero;
      inputs?: Array<{
        outpoint: OutpointString;
        unlockingScript?: HexString;
        unlockingScriptLength: PositiveIntegerOrZero;
        inputDescription: DescriptionString5to50Characters;
        sequenceNumber: PositiveIntegerOrZero;
        sourceLockingScript?: HexString;
        sourceSatoshis: PositiveIntegerOrZero;
      }>;
      outputs?: Array<{
        vout: PositiveIntegerOrZero;
        satoshis: PositiveIntegerOrZero;
        lockingScript?: HexString;
        lockingScriptLength: PositiveIntegerOrZero;
        description?: DescriptionString5to50Characters;
        basket?: BasketStringUnder300Characters;
        tags?: OutputTagStringUnder300Characters[];
        customInstructions?: string;
      }>;
    }>;
  }>;

  /**
   * Internalizes an action by accepting and managing incoming transactions.
   */
  internalizeAction: (args: {
    tx: BEEF;
    outputs: Array<{
      outputIndex: PositiveIntegerOrZero;
      protocol: 'wallet payment' | 'basket insertion';
      paymentRemittance?: {
        derivationPrefix: Base64String;
        derivationSuffix: Base64String;
      };
      insertionRemittance?: {
        basket: BasketStringUnder300Characters;
        customInstructions?: string;
        tags?: OutputTagStringUnder300Characters[];
      };
    }>;
    description: DescriptionString5to50Characters;
    labels?: LabelStringUnder300Characters[];
  }) => Promise<{
    accepted: boolean;
  }>;

  /**
   * Lists outputs based on basket and other criteria.
   */
  listOutputs: (args: {
    basket: BasketStringUnder300Characters;
    tags?: OutputTagStringUnder300Characters[];
    tagQueryMode?: 'any' | 'all';
    include?: 'locking scripts' | 'entire transactions';
    includeCustomInstructions?: boolean;
    includeTags?: boolean;
    includeLabels?: boolean;
    limit?: PositiveIntegerOrZero;
    offset?: PositiveIntegerOrZero;
  }) => Promise<{
    totalOutputs: PositiveIntegerOrZero;
    outputs: Array<{
      outpoint: OutpointString;
      satoshis: PositiveIntegerOrZero;
      lockingScript?: HexString;
      lockingScriptLength: PositiveIntegerOrZero;
      customInstructions?: string;
      tags?: OutputTagStringUnder300Characters[];
      labels?: LabelStringUnder300Characters[];
      transaction?: {
        txid: HexString;
        tx: BEEF;
      };
    }>;
  }>;

  /**
   * Relinquishes an output from a basket tracked by the wallet.
   */
  relinquishOutput: (args: {
    basket: BasketStringUnder300Characters;
    output: OutpointString;
  }) => Promise<{
    relinquished: boolean;
  }>;

  /**
   * Retrieves public keys for identity or protocol-specific purposes.
   */
  getPublicKey: (args: {
    identityKey?: true;
    protocolID?: [0 | 1 | 2, ProtocolString5To400Characters];
    keyID?: string;
    privileged?: boolean;
    privilegedReason?: DescriptionString5to50Characters;
    counterparty?: 'self' | 'anyone' | HexString;
    forSelf?: boolean;
  }) => Promise<{
    publicKey: HexString;
  }>;

  /**
   * Reveals counterparty key linkage information.
   */
  revealCounterpartyKeyLinkage: (args: {
    counterparty: HexString;
    verifier: HexString;
    privilegedReason?: DescriptionString5to50Characters;
  }) => Promise<{
    prover: HexString;
    verifier: HexString;
    counterparty: HexString;
    revelationTime: string;
    encryptedLinkage: Base64String;
    encryptedLinkageProof: Base64String;
  }>;

  /**
   * Reveals specific key linkage information.
   */
  revealSpecificKeyLinkage: (args: {
    counterparty: HexString;
    verifier: HexString;
    protocolID: [0 | 1 | 2, ProtocolString5To400Characters];
    keyID: string;
    privilegedReason?: DescriptionString5to50Characters;
  }) => Promise<{
    prover: HexString;
    verifier: HexString;
    counterparty: HexString;
    protocolID: [0 | 1 | 2, ProtocolString5To400Characters];
    keyID: string;
    encryptedLinkage: Base64String;
    encryptedLinkageProof: Base64String;
    provenTxid: HexString;
    provenTxSatoshis: PositiveIntegerOrZero;
    keyOffset: HexString;
  }>;

  /**
   * Encrypts data using the wallet's encryption capabilities.
   */
  encrypt: (args: {
    plaintext: Base64String;
    protocolID: [0 | 1 | 2, ProtocolString5To400Characters];
    keyID: string;
    privilegedReason?: DescriptionString5to50Characters;
    counterparty?: 'self' | 'anyone' | HexString;
    privileged?: boolean;
  }) => Promise<{
    ciphertext: Base64String;
  }>;

  /**
   * Decrypts data using the wallet's decryption capabilities.
   */
  decrypt: (args: {
    ciphertext: Base64String;
    protocolID: [0 | 1 | 2, ProtocolString5To400Characters];
    keyID: string;
    privilegedReason?: DescriptionString5to50Characters;
    counterparty?: 'self' | 'anyone' | HexString;
    privileged?: boolean;
  }) => Promise<{
    plaintext: Base64String;
  }>;

  /**
   * Creates an HMAC for message authentication.
   */
  createHmac: (args: {
    data: Base64String;
    protocolID: [0 | 1 | 2, ProtocolString5To400Characters];
    keyID: string;
    privilegedReason?: DescriptionString5to50Characters;
    counterparty?: 'self' | 'anyone' | HexString;
    privileged?: boolean;
  }) => Promise<{
    hmac: Base64String;
  }>;

  /**
   * Verifies an HMAC for message authentication.
   */
  verifyHmac: (args: {
    data: Base64String;
    hmac: Base64String;
    protocolID: [0 | 1 | 2, ProtocolString5To400Characters];
    keyID: string;
    privilegedReason?: DescriptionString5to50Characters;
    counterparty?: 'self' | 'anyone' | HexString;
    privileged?: boolean;
  }) => Promise<{
    valid: boolean;
  }>;

  /**
   * Creates a digital signature.
   */
  createSignature: (args: {
    data?: Base64String;
    hashToDirectlySign?: HexString;
    protocolID: [0 | 1 | 2, ProtocolString5To400Characters];
    keyID: string;
    privilegedReason?: DescriptionString5to50Characters;
    counterparty?: 'self' | 'anyone' | HexString;
    privileged?: boolean;
  }) => Promise<{
    signature: Base64String;
  }>;

  /**
   * Verifies a digital signature.
   */
  verifySignature: (args: {
    data?: Base64String;
    hashToDirectlyVerify?: HexString;
    signature: Base64String;
    protocolID: [0 | 1 | 2, ProtocolString5To400Characters];
    keyID: string;
    privilegedReason?: DescriptionString5to50Characters;
    counterparty?: 'self' | 'anyone' | HexString;
    privileged?: boolean;
    forSelf?: boolean;
  }) => Promise<{
    valid: boolean;
  }>;

  /**
   * Acquires a certificate for proving key ownership.
   */
  acquireCertificate: (args: {
    type: HexString;
    certifier: HexString;
    acquisitionProtocol: ProtocolString5To400Characters;
    fields: Record<string, string>;
    serialNumber?: Base64String;
    revocationOutpoint?: OutpointString;
    signature?: HexString;
    privilegedReason?: DescriptionString5to50Characters;
  }) => Promise<{
    type: HexString;
    subject: HexString;
    certifier: HexString;
    serialNumber: Base64String;
    revocationOutpoint: OutpointString;
    signature: HexString;
    fields?: Record<string, string>;
  }>;

  /**
   * Lists certificates held by the wallet.
   */
  listCertificates: (args: {
    certifiers: HexString[];
    types: HexString[];
    limit?: PositiveIntegerOrZero;
    offset?: PositiveIntegerOrZero;
    privileged?: boolean;
    privilegedReason?: DescriptionString5to50Characters;
  }) => Promise<{
    totalCertificates: PositiveIntegerOrZero;
    certificates: Array<{
      type: HexString;
      subject: HexString;
      certifier: HexString;
      serialNumber: Base64String;
      revocationOutpoint: OutpointString;
      signature: HexString;
      fields?: Record<string, string>;
    }>;
  }>;

  /**
   * Proves ownership of a certificate.
   */
  proveCertificate: (args: {
    certificate: {
      type: HexString;
      subject: HexString;
      certifier: HexString;
      serialNumber: Base64String;
      revocationOutpoint: OutpointString;
      signature: HexString;
      fields?: Record<string, string>;
    };
    fieldsToReveal: string[];
    verifier: HexString;
    privilegedReason?: DescriptionString5to50Characters;
  }) => Promise<{
    keyringForVerifier: Record<string, string>;
  }>;

  /**
   * Relinquishes a certificate from the wallet.
   */
  relinquishCertificate: (args: {
    type: HexString;
    serialNumber: Base64String;
    certifier: HexString;
  }) => Promise<{
    relinquished: boolean;
  }>;

  /**
   * Discovers certificates by identity key.
   */
  discoverByIdentityKey: (args: {
    identityKey: HexString;
    limit?: PositiveIntegerOrZero;
    offset?: PositiveIntegerOrZero;
  }) => Promise<{
    totalCertificates: PositiveIntegerOrZero;
    certificates: Array<{
      type: HexString;
      subject: HexString;
      certifier: HexString;
      serialNumber: Base64String;
      revocationOutpoint: OutpointString;
      signature: HexString;
      fields?: Record<string, string>;
    }>;
  }>;

  /**
   * Discovers certificates by their attributes.
   */
  discoverByAttributes: (args: {
    attributes: Record<string, string>;
    limit?: PositiveIntegerOrZero;
    offset?: PositiveIntegerOrZero;
  }) => Promise<{
    totalCertificates: PositiveIntegerOrZero;
    certificates: Array<{
      type: HexString;
      subject: HexString;
      certifier: HexString;
      serialNumber: Base64String;
      revocationOutpoint: OutpointString;
      signature: HexString;
      fields?: Record<string, string>;
    }>;
  }>;

  /**
   * Checks if a wallet is available and responds to BRC-100 calls.
   */
  isAvailable?: () => Promise<boolean>;

  /**
   * Gets information about the wallet implementation.
   */
  getVersion?: () => Promise<{
    version: string;
    implementation: string;
  }>;

  /**
   * Checks if the user is currently authenticated with the wallet.
   */
  isAuthenticated?: () => Promise<boolean>;

  /**
   * Waits for user authentication to complete.
   */
  waitForAuthentication?: () => Promise<boolean>;

  /**
   * Gets the current blockchain height.
   */
  getHeight?: () => Promise<number>;

  /**
   * Gets the block header for a specific height.
   */
  getHeaderForHeight?: (height: number) => Promise<{
    height: number;
    hash: HexString;
    version: number;
    previousHash: HexString;
    merkleRoot: HexString;
    time: number;
    bits: number;
    nonce: number;
  }>;

  /**
   * Gets the current network type.
   */
  getNetwork?: () => Promise<'mainnet' | 'testnet' | 'regtest'>;
}

// Global window interface extension for browser wallets
declare global {
  interface Window {
    bsv?: {
      wallet?: Wallet;
    };
    // Other potential wallet injection patterns
    wallet?: Wallet;
    // MetaNet Desktop Wallet patterns
    metanet?: Wallet;
    metaNet?: Wallet;
    MetaNet?: Wallet;
  }
}

// Wallet detection and access utilities
export class WalletError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export interface WalletConnection {
  wallet: Wallet;
  isConnected: boolean;
  publicKey?: string;
}
