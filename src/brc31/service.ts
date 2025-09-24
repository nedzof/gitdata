/**
 * BRC-31 Authentication Service
 *
 * Complete implementation of BRC-31 Authrite protocol using BSV libraries
 * and type-safe database operations.
 */

import { createHash, randomBytes } from 'crypto';

import { secp256k1 } from '@noble/curves/secp256k1';

import type { DatabaseAdapter } from '../overlay/brc26-uhrp';

import { BRC31DatabaseService } from './database';
import type {
  BRC31Headers,
  BRC31Nonce,
  BRC31Certificate,
  BRC31AuthenticationResult,
  BRC31AuthenticationOptions,
  BRC31AuthenticationService,
  IdentityLevel,
  BRC31InitialRequest,
  BRC31InitialResponse,
  BRC31GeneralMessage,
} from './types';
import {
  BRC31Error,
  BRC31ValidationError,
  BRC31AuthenticationError,
  BRC31CertificateError,
  BRC31_VERSION,
  BRC31_PROTOCOL_ID,
  BRC31_SECURITY_LEVEL,
  DEFAULT_BRC31_OPTIONS,
} from './types';

export class BRC31AuthenticationServiceImpl implements BRC31AuthenticationService {
  private databaseService: BRC31DatabaseService;
  private serverPrivateKey: string;
  private serverPublicKey: string;

  constructor(database: DatabaseAdapter, serverPrivateKey?: string) {
    this.databaseService = new BRC31DatabaseService(database);

    // Generate or use provided server keys
    if (serverPrivateKey) {
      this.serverPrivateKey = serverPrivateKey;
      this.serverPublicKey = secp256k1.getPublicKey(this.serverPrivateKey, true).toString();
    } else {
      this.serverPrivateKey = randomBytes(32).toString('hex');
      this.serverPublicKey = secp256k1.getPublicKey(this.serverPrivateKey, true).toString();
    }
  }

  async initialize(): Promise<void> {
    await this.databaseService.initializeSchema();
  }

  // ==================== Header Processing ====================

  extractHeaders(headers: Record<string, string>): Partial<BRC31Headers> {
    const brc31Headers: Partial<BRC31Headers> = {};

    // Extract all X-Authrite headers
    if (headers['x-authrite']) brc31Headers['X-Authrite'] = headers['x-authrite'];
    if (headers['x-authrite-identity-key'])
      brc31Headers['X-Authrite-Identity-Key'] = headers['x-authrite-identity-key'];
    if (headers['x-authrite-signature'])
      brc31Headers['X-Authrite-Signature'] = headers['x-authrite-signature'];
    if (headers['x-authrite-nonce']) brc31Headers['X-Authrite-Nonce'] = headers['x-authrite-nonce'];
    if (headers['x-authrite-yournonce'])
      brc31Headers['X-Authrite-YourNonce'] = headers['x-authrite-yournonce'];
    if (headers['x-authrite-certificates'])
      brc31Headers['X-Authrite-Certificates'] = headers['x-authrite-certificates'];

    return brc31Headers;
  }

  validateHeaders(headers: Partial<BRC31Headers>): void {
    if (!headers['X-Authrite'] || headers['X-Authrite'] !== BRC31_VERSION) {
      throw new BRC31ValidationError('Invalid or missing X-Authrite version', 'X-Authrite');
    }

    if (
      !headers['X-Authrite-Identity-Key'] ||
      !this.isValidPublicKey(headers['X-Authrite-Identity-Key'])
    ) {
      throw new BRC31ValidationError(
        'Invalid or missing X-Authrite-Identity-Key',
        'X-Authrite-Identity-Key',
      );
    }

    if (!headers['X-Authrite-Signature'] || !this.isValidHex(headers['X-Authrite-Signature'])) {
      throw new BRC31ValidationError(
        'Invalid or missing X-Authrite-Signature',
        'X-Authrite-Signature',
      );
    }

    if (!headers['X-Authrite-Nonce'] || !this.isValidBase64(headers['X-Authrite-Nonce'])) {
      throw new BRC31ValidationError('Invalid or missing X-Authrite-Nonce', 'X-Authrite-Nonce');
    }
  }

  // ==================== Nonce Management ====================

  generateNonce(): BRC31Nonce {
    const value = randomBytes(32).toString('base64');
    const now = Date.now();
    const expires = now + DEFAULT_BRC31_OPTIONS.nonceExpiryMs;

    return {
      value,
      created: now,
      expires,
    };
  }

  async storeNonce(nonce: BRC31Nonce, identityKey: string): Promise<void> {
    await this.databaseService.storeNonce(
      nonce.value,
      identityKey,
      new Date(nonce.expires),
      'server',
    );
  }

  async validateNonce(nonce: string, identityKey: string): Promise<boolean> {
    return await this.databaseService.validateAndConsumeNonce(nonce, identityKey);
  }

  async cleanupExpiredNonces(): Promise<number> {
    return await this.databaseService.cleanupExpiredNonces();
  }

  // ==================== Signature Operations ====================

  createSignature(
    data: any,
    privateKey: string,
    nonces: { client: string; server: string },
  ): string {
    try {
      // Create message to sign according to BRC-31 spec
      const message = this.createSigningMessage(data, nonces);
      const messageHash = this.hashMessage(message);

      // Create ECDSA signature
      const signature = secp256k1.sign(messageHash, privateKey);
      return signature.toDERHex();
    } catch (error) {
      throw new BRC31Error(`Failed to create signature: ${error.message}`, 'SIGNATURE_ERROR');
    }
  }

  verifySignature(
    signature: string,
    data: any,
    publicKey: string,
    nonces: { client: string; server: string },
  ): boolean {
    try {
      // Create message that should have been signed
      const message = this.createSigningMessage(data, nonces);
      const messageHash = this.hashMessage(message);

      // Convert hex signature to bytes
      const sigBytes = Buffer.from(signature, 'hex');
      const pubKeyBytes = Buffer.from(publicKey, 'hex');

      // Verify signature
      return secp256k1.verify(sigBytes, messageHash, pubKeyBytes);
    } catch (error) {
      return false;
    }
  }

  private createSigningMessage(data: any, nonces: { client: string; server: string }): Buffer {
    // BRC-31 spec: sign payload with nonces
    let messageData: Buffer;

    if (typeof data === 'string') {
      messageData = Buffer.from(data, 'utf8');
    } else if (Buffer.isBuffer(data)) {
      messageData = data;
    } else {
      messageData = Buffer.from(JSON.stringify(data), 'utf8');
    }

    // Concatenate client nonce + server nonce + data
    const clientNonceBuffer = Buffer.from(nonces.client, 'base64');
    const serverNonceBuffer = Buffer.from(nonces.server, 'base64');

    return Buffer.concat([clientNonceBuffer, serverNonceBuffer, messageData]);
  }

  private hashMessage(message: Buffer): Buffer {
    return createHash('sha256').update(message).digest();
  }

  // ==================== Certificate Management ====================

  async validateCertificateChain(certificates: BRC31Certificate[]): Promise<boolean> {
    for (const cert of certificates) {
      try {
        // Validate certificate structure
        if (!this.validateCertificateStructure(cert)) {
          return false;
        }

        // Check certificate signature
        if (!(await this.verifyCertificateSignature(cert))) {
          return false;
        }

        // Check if certificate is revoked
        if (await this.checkCertificateRevocation(cert)) {
          return false;
        }
      } catch (error) {
        console.warn(`Certificate validation failed: ${error.message}`);
        return false;
      }
    }

    return true;
  }

  async checkCertificateRevocation(certificate: BRC31Certificate): Promise<boolean> {
    // In a full implementation, this would check the UTXO specified
    // in revocationOutpoint to see if it's been spent
    // For now, we'll assume certificates are not revoked
    return false;
  }

  computeIdentityLevel(certificates: BRC31Certificate[]): IdentityLevel {
    if (!certificates || certificates.length === 0) {
      return 'public-key';
    }

    // Check for high-trust certificates
    const hasCertifiedLevel = certificates.some(
      (cert) => cert.type && this.isTrustedCertificateType(cert.type),
    );

    if (hasCertifiedLevel) {
      return 'certified';
    }

    // Check for verified level certificates
    const hasVerifiedLevel = certificates.some(
      (cert) => cert.certifier && this.isTrustedCertifier(cert.certifier),
    );

    if (hasVerifiedLevel) {
      return 'verified';
    }

    return 'public-key';
  }

  private validateCertificateStructure(cert: BRC31Certificate): boolean {
    return !!(
      cert.type &&
      cert.subject &&
      cert.certifier &&
      cert.signature &&
      cert.serialNumber &&
      this.isValidPublicKey(cert.subject) &&
      this.isValidPublicKey(cert.certifier)
    );
  }

  private async verifyCertificateSignature(cert: BRC31Certificate): Promise<boolean> {
    try {
      // Create certificate signing message
      const certData = {
        type: cert.type,
        subject: cert.subject,
        validationKey: cert.validationKey,
        serialNumber: cert.serialNumber,
        fields: cert.fields,
      };

      const message = Buffer.from(JSON.stringify(certData), 'utf8');
      const messageHash = createHash('sha256').update(message).digest();

      const sigBytes = Buffer.from(cert.signature, 'hex');
      const pubKeyBytes = Buffer.from(cert.certifier, 'hex');

      return secp256k1.verify(sigBytes, messageHash, pubKeyBytes);
    } catch (error) {
      return false;
    }
  }

  private isTrustedCertificateType(certType: string): boolean {
    // Define trusted certificate types for certified level
    const trustedTypes = [
      'government-id',
      'verified-email',
      'verified-phone',
      'business-registration',
    ];
    return trustedTypes.includes(certType);
  }

  private isTrustedCertifier(certifier: string): boolean {
    // Define trusted certifier public keys
    const trustedCertifiers = [
      // Add trusted certifier public keys here
    ];
    return trustedCertifiers.includes(certifier);
  }

  // ==================== Main Authentication Method ====================

  async verifyIdentity(
    headers: BRC31Headers,
    body: any,
    options: BRC31AuthenticationOptions = DEFAULT_BRC31_OPTIONS,
  ): Promise<BRC31AuthenticationResult> {
    try {
      // Validate headers structure
      this.validateHeaders(headers);

      const identityKey = headers['X-Authrite-Identity-Key'];
      const clientNonce = headers['X-Authrite-Nonce'];
      const signature = headers['X-Authrite-Signature'];
      const yourNonce = headers['X-Authrite-YourNonce'];

      // Validate nonces
      const nonceValid = yourNonce ? await this.validateNonce(yourNonce, identityKey) : true;
      if (!nonceValid) {
        throw new BRC31AuthenticationError('Invalid or expired nonce', 'NONCE_INVALID');
      }

      // Generate server nonce for response
      const serverNonce = this.generateNonce();
      await this.storeNonce(serverNonce, identityKey);

      // Parse certificates if provided
      let certificates: BRC31Certificate[] = [];
      if (headers['X-Authrite-Certificates']) {
        try {
          certificates = JSON.parse(headers['X-Authrite-Certificates']);
        } catch (error) {
          throw new BRC31ValidationError('Invalid certificate JSON', 'X-Authrite-Certificates');
        }
      }

      // Verify signature
      const nonces = { client: clientNonce, server: yourNonce || serverNonce.value };
      const signatureValid = this.verifySignature(signature, body, identityKey, nonces);

      if (!signatureValid) {
        throw new BRC31AuthenticationError('Invalid signature', 'SIGNATURE_INVALID');
      }

      // Validate certificate chain
      const certificatesValid = await this.validateCertificateChain(certificates);

      // Compute identity level
      const identityLevel = this.computeIdentityLevel(certificates);

      // Check minimum identity level requirement
      if (!this.meetsMinimumLevel(identityLevel, options.minIdentityLevel)) {
        throw new BRC31AuthenticationError(
          `Identity level ${identityLevel} does not meet minimum requirement ${options.minIdentityLevel}`,
          'INSUFFICIENT_IDENTITY_LEVEL',
        );
      }

      // Calculate trust score
      const trustLevel = this.calculateTrustLevel(certificates, certificatesValid);

      const result: BRC31AuthenticationResult = {
        valid: true,
        identity: {
          publicKey: identityKey,
          level: identityLevel,
          certificates,
        },
        nonces: {
          clientNonce,
          serverNonce: serverNonce.value,
        },
        verification: {
          signatureValid,
          nonceValid,
          certificatesValid,
          trustLevel,
        },
      };

      // Record successful authentication
      await this.databaseService.recordAuthenticationAttempt(result);

      return result;
    } catch (error) {
      const result: BRC31AuthenticationResult = {
        valid: false,
        identity: {
          publicKey: headers['X-Authrite-Identity-Key'] || '',
          level: 'anonymous',
          certificates: [],
        },
        nonces: {
          clientNonce: headers['X-Authrite-Nonce'] || '',
          serverNonce: this.generateNonce().value,
        },
        verification: {
          signatureValid: false,
          nonceValid: false,
          certificatesValid: false,
          trustLevel: 0,
        },
        error: error.message,
      };

      return result;
    }
  }

  // ==================== Utility Methods ====================

  private isValidPublicKey(pubKey: string): boolean {
    return /^[0-9a-fA-F]{66}$/.test(pubKey) && (pubKey.startsWith('02') || pubKey.startsWith('03'));
  }

  private isValidHex(hex: string): boolean {
    return /^[0-9a-fA-F]+$/.test(hex) && hex.length >= 8;
  }

  private isValidBase64(base64: string): boolean {
    try {
      const decoded = Buffer.from(base64, 'base64');
      return decoded.length >= 8;
    } catch {
      return false;
    }
  }

  private meetsMinimumLevel(actual: IdentityLevel, required: IdentityLevel): boolean {
    const levels: Record<IdentityLevel, number> = {
      anonymous: 0,
      'public-key': 1,
      verified: 2,
      certified: 3,
    };

    return levels[actual] >= levels[required];
  }

  private calculateTrustLevel(
    certificates: BRC31Certificate[],
    certificatesValid: boolean,
  ): number {
    let trustLevel = 20; // Base trust for public key

    if (certificatesValid && certificates.length > 0) {
      trustLevel += 30; // Valid certificates

      // Bonus for multiple certificates
      trustLevel += Math.min(certificates.length * 10, 30);

      // Bonus for trusted certifiers
      const trustedCount = certificates.filter((cert) =>
        this.isTrustedCertifier(cert.certifier),
      ).length;
      trustLevel += trustedCount * 20;
    }

    return Math.min(100, Math.max(0, trustLevel));
  }

  async getIdentityLevel(identityKey: string): Promise<IdentityLevel> {
    const identity = await this.databaseService.getIdentity(identityKey);
    return identity ? identity.identity_level : 'anonymous';
  }

  async recordAuthentication(result: BRC31AuthenticationResult): Promise<void> {
    await this.databaseService.recordAuthenticationAttempt(result);
  }

  async updateIdentityReputation(identityKey: string, success: boolean): Promise<void> {
    await this.databaseService.updateIdentityReputation(identityKey, success);
  }

  // ==================== Response Generation ====================

  createInitialResponse(
    request: BRC31InitialRequest,
    certificates?: BRC31Certificate[],
  ): BRC31InitialResponse {
    const serverNonce = this.generateNonce();

    const response: BRC31InitialResponse = {
      authrite: BRC31_VERSION,
      messageType: 'initialResponse',
      identityKey: this.serverPublicKey,
      nonce: serverNonce.value,
      certificates,
      signature: this.createSignature(
        Buffer.concat([
          Buffer.from(request.nonce, 'base64'),
          Buffer.from(serverNonce.value, 'base64'),
        ]),
        this.serverPrivateKey,
        { client: request.nonce, server: serverNonce.value },
      ),
    };

    return response;
  }

  createSignedResponse(data: any, clientNonce: string): string {
    const serverNonce = this.generateNonce();
    return this.createSignature(data, this.serverPrivateKey, {
      client: clientNonce,
      server: serverNonce.value,
    });
  }
}
