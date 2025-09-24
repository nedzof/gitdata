/**
 * BRC-31 Authrite Mutual Authentication Types
 *
 * This module defines all types and interfaces for complete BRC-31 compliance
 * based on the official specification.
 */
export type IdentityLevel = 'anonymous' | 'public-key' | 'verified' | 'certified';
export interface BRC31Headers {
    'X-Authrite': string;
    'X-Authrite-Identity-Key': string;
    'X-Authrite-Signature': string;
    'X-Authrite-Nonce': string;
    'X-Authrite-YourNonce': string;
    'X-Authrite-Certificates': string;
}
export interface BRC31Nonce {
    value: string;
    created: number;
    expires: number;
}
export interface BRC31Certificate {
    type: string;
    subject: string;
    validationKey: string;
    serialNumber: string;
    fields: Record<string, string>;
    certifier: string;
    revocationOutpoint: string;
    signature: string;
    keyring?: Record<string, string>;
}
export interface RequestedCertificateSet {
    certifiers: string[];
    types: Record<string, string[]>;
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
        trustLevel: number;
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
export interface BRC31InitialRequest {
    authrite: string;
    messageType: 'initialRequest';
    identityKey: string;
    nonce: string;
    requestedCertificates?: RequestedCertificateSet;
}
export interface BRC31InitialResponse {
    authrite: string;
    messageType: 'initialResponse';
    identityKey: string;
    nonce: string;
    certificates?: BRC31Certificate[];
    requestedCertificates?: RequestedCertificateSet;
    signature: string;
}
export interface BRC31GeneralMessage {
    authrite: string;
    identityKey: string;
    nonce: string;
    yourNonce: string;
    certificates?: BRC31Certificate[];
    payload: any;
    signature: string;
}
export interface BRC31RescopingTrigger {
    authrite: string;
    messageType: 'rescopingTrigger';
    message: string;
}
export interface BRC31IdentityRecord {
    identity_key: string;
    certificate_chain: BRC31Certificate[];
    identity_level: IdentityLevel;
    first_seen: Date;
    last_seen: Date;
    request_count: number;
    reputation_score: number;
    trust_metrics: {
        successful_auths: number;
        failed_auths: number;
        certificate_validity_score: number;
        behavioral_score: number;
    };
}
export interface BRC31NonceRecord {
    nonce: string;
    identity_key: string;
    created_at: Date;
    expires_at: Date;
    used: boolean;
    purpose: 'client' | 'server';
}
export interface BRC31AuthenticationService {
    extractHeaders(headers: Record<string, string>): Partial<BRC31Headers>;
    generateNonce(): BRC31Nonce;
    verifyIdentity(headers: BRC31Headers, body: any): Promise<BRC31AuthenticationResult>;
    validateCertificateChain(certificates: BRC31Certificate[]): Promise<boolean>;
    checkCertificateRevocation(certificate: BRC31Certificate): Promise<boolean>;
    computeIdentityLevel(certificates: BRC31Certificate[]): IdentityLevel;
    createSignature(data: any, privateKey: string, nonces: {
        client: string;
        server: string;
    }): string;
    verifySignature(signature: string, data: any, publicKey: string, nonces: {
        client: string;
        server: string;
    }): boolean;
    storeNonce(nonce: BRC31Nonce, identityKey: string): Promise<void>;
    validateNonce(nonce: string, identityKey: string): Promise<boolean>;
    cleanupExpiredNonces(): Promise<number>;
    recordAuthentication(result: BRC31AuthenticationResult): Promise<void>;
    updateIdentityReputation(identityKey: string, success: boolean): Promise<void>;
    getIdentityLevel(identityKey: string): Promise<IdentityLevel>;
}
export declare const BRC31_VERSION = "0.1";
export declare const BRC31_PROTOCOL_ID = "authrite message signature";
export declare const BRC31_SECURITY_LEVEL = 2;
export declare const DEFAULT_BRC31_OPTIONS: BRC31AuthenticationOptions;
export declare class BRC31Error extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode?: number);
}
export declare class BRC31ValidationError extends BRC31Error {
    field: string;
    constructor(message: string, field: string);
}
export declare class BRC31AuthenticationError extends BRC31Error {
    reason: string;
    constructor(message: string, reason: string);
}
export declare class BRC31CertificateError extends BRC31Error {
    certificateType?: string | undefined;
    constructor(message: string, certificateType?: string | undefined);
}
