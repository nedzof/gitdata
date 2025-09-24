/**
 * BRC-31 Authentication Service
 *
 * Complete implementation of BRC-31 Authrite protocol using BSV libraries
 * and type-safe database operations.
 */
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
import type { BRC31Headers, BRC31Nonce, BRC31Certificate, BRC31AuthenticationResult, BRC31AuthenticationOptions, BRC31AuthenticationService, IdentityLevel, BRC31InitialRequest, BRC31InitialResponse } from './types';
export declare class BRC31AuthenticationServiceImpl implements BRC31AuthenticationService {
    private databaseService;
    private serverPrivateKey;
    private serverPublicKey;
    constructor(database: DatabaseAdapter, serverPrivateKey?: string);
    initialize(): Promise<void>;
    extractHeaders(headers: Record<string, string>): Partial<BRC31Headers>;
    validateHeaders(headers: Partial<BRC31Headers>): void;
    generateNonce(): BRC31Nonce;
    storeNonce(nonce: BRC31Nonce, identityKey: string): Promise<void>;
    validateNonce(nonce: string, identityKey: string): Promise<boolean>;
    cleanupExpiredNonces(): Promise<number>;
    createSignature(data: any, privateKey: string, nonces: {
        client: string;
        server: string;
    }): string;
    verifySignature(signature: string, data: any, publicKey: string, nonces: {
        client: string;
        server: string;
    }): boolean;
    private createSigningMessage;
    private hashMessage;
    validateCertificateChain(certificates: BRC31Certificate[]): Promise<boolean>;
    checkCertificateRevocation(certificate: BRC31Certificate): Promise<boolean>;
    computeIdentityLevel(certificates: BRC31Certificate[]): IdentityLevel;
    private validateCertificateStructure;
    private verifyCertificateSignature;
    private isTrustedCertificateType;
    private isTrustedCertifier;
    verifyIdentity(headers: BRC31Headers, body: any, options?: BRC31AuthenticationOptions): Promise<BRC31AuthenticationResult>;
    private isValidPublicKey;
    private isValidHex;
    private isValidBase64;
    private meetsMinimumLevel;
    private calculateTrustLevel;
    getIdentityLevel(identityKey: string): Promise<IdentityLevel>;
    recordAuthentication(result: BRC31AuthenticationResult): Promise<void>;
    updateIdentityReputation(identityKey: string, success: boolean): Promise<void>;
    createInitialResponse(request: BRC31InitialRequest, certificates?: BRC31Certificate[]): BRC31InitialResponse;
    createSignedResponse(data: any, clientNonce: string): string;
}
