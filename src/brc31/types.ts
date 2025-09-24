/**
 * BRC-31 Authrite Mutual Authentication Types
 *
 * This module defines all types and interfaces for complete BRC-31 compliance
 * based on the official specification.
 */

// ==================== Core BRC-31 Types ====================

export type IdentityLevel = 'anonymous' | 'public-key' | 'verified' | 'certified';

export interface BRC31Headers {
  'X-Authrite': string; // Protocol version (e.g., "0.1")
  'X-Authrite-Identity-Key': string; // Public key (compressed, 33-byte hex)
  'X-Authrite-Signature': string; // Request signature (hex)
  'X-Authrite-Nonce': string; // Client nonce (base64)
  'X-Authrite-YourNonce': string; // Server nonce (base64)
  'X-Authrite-Certificates': string; // Certificate chain JSON
}

export interface BRC31Nonce {
  value: string; // Base64 encoded 32-byte random value
  created: number; // Timestamp when created
  expires: number; // Timestamp when expires
}

export interface BRC31Certificate {
  type: string; // Certificate type ID
  subject: string; // Subject public key
  validationKey: string; // Validation key for encrypted fields
  serialNumber: string; // Unique serial number
  fields: Record<string, string>; // Encrypted certificate fields
  certifier: string; // Certifier public key
  revocationOutpoint: string; // UTXO for revocation
  signature: string; // Certificate signature
  keyring?: Record<string, string>; // Field decryption keys
}

export interface RequestedCertificateSet {
  certifiers: string[]; // Trusted certifier public keys
  types: Record<string, string[]>; // Certificate type -> field list
}

export interface BRC31AuthenticationResult {
  valid: boolean;
  identity: {
    publicKey: string;
    level: IdentityLevel;
    certificates: BRC31Certificate[];
  };
  nonces: {
    clientNonce: string;
    serverNonce: string;
  };
  verification: {
    signatureValid: boolean;
    nonceValid: boolean;
    certificatesValid: boolean;
    trustLevel: number; // 0-100 trust score
  };
  error?: string;
}

export interface BRC31AuthenticationOptions {
  minIdentityLevel: IdentityLevel;
  requiredCertificates?: RequestedCertificateSet;
  nonceExpiryMs: number;
  maxCertificateAge: number;
  trustedCertifiers: string[];
}

// ==================== HTTP Message Types ====================

export interface BRC31InitialRequest {
  authrite: string; // Version "0.1"
  messageType: 'initialRequest';
  identityKey: string; // Client public key
  nonce: string; // Client nonce
  requestedCertificates?: RequestedCertificateSet;
}

export interface BRC31InitialResponse {
  authrite: string; // Version "0.1"
  messageType: 'initialResponse';
  identityKey: string; // Server public key
  nonce: string; // Server nonce
  certificates?: BRC31Certificate[];
  requestedCertificates?: RequestedCertificateSet;
  signature: string; // Response signature
}

export interface BRC31GeneralMessage {
  authrite: string; // Version "0.1"
  identityKey: string; // Sender public key
  nonce: string; // Sender nonce
  yourNonce: string; // Recipient's original nonce
  certificates?: BRC31Certificate[];
  payload: any; // Message payload
  signature: string; // Message signature
}

export interface BRC31RescopingTrigger {
  authrite: string; // Version "0.1"
  messageType: 'rescopingTrigger';
  message: string; // Error message
}

// ==================== Database Schema Types ====================

export interface BRC31IdentityRecord {
  identity_key: string; // Primary key - public key
  certificate_chain: BRC31Certificate[]; // JSON array of certificates
  identity_level: IdentityLevel; // Computed identity level
  first_seen: Date; // First authentication time
  last_seen: Date; // Last authentication time
  request_count: number; // Total requests made
  reputation_score: number; // Trust score (0-1)
  trust_metrics: {
    successful_auths: number;
    failed_auths: number;
    certificate_validity_score: number;
    behavioral_score: number;
  };
}

export interface BRC31NonceRecord {
  nonce: string; // Primary key - base64 nonce
  identity_key: string; // Associated identity
  created_at: Date; // Creation timestamp
  expires_at: Date; // Expiration timestamp
  used: boolean; // Whether nonce was consumed
  purpose: 'client' | 'server'; // Nonce source
}

// ==================== Service Interface ====================

export interface BRC31AuthenticationService {
  // Core authentication methods
  extractHeaders(headers: Record<string, string>): Partial<BRC31Headers>;
  generateNonce(): BRC31Nonce;
  verifyIdentity(headers: BRC31Headers, body: any): Promise<BRC31AuthenticationResult>;

  // Certificate management
  validateCertificateChain(certificates: BRC31Certificate[]): Promise<boolean>;
  checkCertificateRevocation(certificate: BRC31Certificate): Promise<boolean>;
  computeIdentityLevel(certificates: BRC31Certificate[]): IdentityLevel;

  // Signature operations
  createSignature(
    data: any,
    privateKey: string,
    nonces: { client: string; server: string },
  ): string;
  verifySignature(
    signature: string,
    data: any,
    publicKey: string,
    nonces: { client: string; server: string },
  ): boolean;

  // Nonce management
  storeNonce(nonce: BRC31Nonce, identityKey: string): Promise<void>;
  validateNonce(nonce: string, identityKey: string): Promise<boolean>;
  cleanupExpiredNonces(): Promise<number>;

  // Identity tracking
  recordAuthentication(result: BRC31AuthenticationResult): Promise<void>;
  updateIdentityReputation(identityKey: string, success: boolean): Promise<void>;
  getIdentityLevel(identityKey: string): Promise<IdentityLevel>;
}

// ==================== Constants ====================

export const BRC31_VERSION = '0.1';
export const BRC31_PROTOCOL_ID = 'authrite message signature';
export const BRC31_SECURITY_LEVEL = 2;

export const DEFAULT_BRC31_OPTIONS: BRC31AuthenticationOptions = {
  minIdentityLevel: 'public-key',
  nonceExpiryMs: 300000, // 5 minutes
  maxCertificateAge: 86400000, // 24 hours
  trustedCertifiers: [],
};

// ==================== Error Types ====================

export class BRC31Error extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = 'BRC31Error';
  }
}

export class BRC31ValidationError extends BRC31Error {
  constructor(
    message: string,
    public field: string,
  ) {
    super(message, 'BRC31_VALIDATION_ERROR', 400);
  }
}

export class BRC31AuthenticationError extends BRC31Error {
  constructor(
    message: string,
    public reason: string,
  ) {
    super(message, 'BRC31_AUTH_ERROR', 401);
  }
}

export class BRC31CertificateError extends BRC31Error {
  constructor(
    message: string,
    public certificateType?: string,
  ) {
    super(message, 'BRC31_CERT_ERROR', 401);
  }
}
