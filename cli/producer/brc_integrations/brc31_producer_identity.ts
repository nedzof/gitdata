/**
 * BRC-31 Producer Identity Authentication
 *
 * Manages producer identity creation, authentication, and cryptographic signing
 * for all producer operations on the BSV Overlay Network.
 *
 * Key Features:
 * - Cryptographic identity generation and management
 * - BRC-31 compliant signature creation
 * - Producer registration with overlay network
 * - Identity verification and reputation tracking
 * - Multi-key support for different service tiers
 */

import * as crypto from 'crypto';
import * as secp256k1 from 'secp256k1';

interface ProducerIdentityData {
  identityKey: string;
  displayName: string;
  description: string;
  contactInfo: any;
  capabilities: string[];
  regions: string[];
}

interface ProducerIdentity {
  producerId: string;
  publicKey: string;
  privateKey: string;
  displayName: string;
  capabilities: string[];
  createdAt: Date;
}

interface SignatureData {
  data: any;
  signature: string;
  publicKey: string;
  timestamp: string;
}

export class BRC31ProducerIdentity {
  private overlayUrl: string;
  private currentIdentity: ProducerIdentity | null = null;

  constructor(overlayUrl: string) {
    this.overlayUrl = overlayUrl;
  }

  /**
   * Authenticate producer with identity key
   */
  async authenticate(identityKey: string): Promise<ProducerIdentity> {
    try {
      console.log('[BRC-31] Authenticating producer identity...');

      // Generate key pair from identity key
      const privateKeyBuffer = Buffer.from(identityKey, 'hex');
      if (privateKeyBuffer.length !== 32) {
        throw new Error('Invalid identity key length. Must be 32 bytes.');
      }

      // Generate public key
      const publicKeyBuffer = secp256k1.publicKeyCreate(privateKeyBuffer);
      const publicKey = Buffer.from(publicKeyBuffer).toString('hex');

      // Generate producer ID from public key
      const producerId = this.generateProducerId(publicKey);

      const identity: ProducerIdentity = {
        producerId,
        publicKey,
        privateKey: identityKey,
        displayName: 'Unknown Producer',
        capabilities: [],
        createdAt: new Date()
      };

      this.currentIdentity = identity;

      console.log(`[BRC-31] ✅ Identity authenticated: ${producerId}`);
      return identity;

    } catch (error) {
      console.error('[BRC-31] ❌ Authentication failed:', error.message);
      throw new Error(`BRC-31 authentication failed: ${error.message}`);
    }
  }

  /**
   * Register producer with overlay network
   */
  async registerProducer(identityData: ProducerIdentityData): Promise<any> {
    try {
      console.log('[BRC-31] Registering producer with overlay...');

      if (!this.currentIdentity) {
        await this.authenticate(identityData.identityKey);
      }

      const registrationData = {
        producerId: this.currentIdentity!.producerId,
        publicKey: this.currentIdentity!.publicKey,
        displayName: identityData.displayName,
        description: identityData.description,
        contactInfo: identityData.contactInfo,
        capabilities: identityData.capabilities,
        regions: identityData.regions,
        timestamp: new Date().toISOString()
      };

      // Sign registration data
      const signature = await this.signData(registrationData);
      const signedRegistration = {
        ...registrationData,
        signature: signature.signature
      };

      // Submit to overlay network
      const response = await this.submitToOverlay('/api/v1/producers/register', signedRegistration);

      const registration = {
        producerId: this.currentIdentity!.producerId,
        identityKey: this.currentIdentity!.publicKey,
        displayName: identityData.displayName,
        description: identityData.description,
        contactInfo: identityData.contactInfo,
        capabilities: identityData.capabilities,
        regions: identityData.regions,
        reputationScore: 0.0,
        totalRevenue: 0,
        registeredAt: new Date(),
        overlayResponse: response
      };

      // Update current identity
      this.currentIdentity!.displayName = identityData.displayName;
      this.currentIdentity!.capabilities = identityData.capabilities;

      console.log(`[BRC-31] ✅ Producer registered: ${registration.producerId}`);
      return registration;

    } catch (error) {
      console.error('[BRC-31] ❌ Registration failed:', error.message);
      throw new Error(`Producer registration failed: ${error.message}`);
    }
  }

  /**
   * Sign data with producer identity (BRC-31 compliant)
   */
  async signData(data: any): Promise<SignatureData> {
    try {
      if (!this.currentIdentity) {
        throw new Error('No authenticated identity available');
      }

      // Serialize data for signing
      const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 0);
      const dataHash = crypto.createHash('sha256').update(dataString).digest();

      // Sign with secp256k1
      const privateKeyBuffer = Buffer.from(this.currentIdentity.privateKey, 'hex');
      const signature = secp256k1.ecdsaSign(dataHash, privateKeyBuffer);
      const signatureHex = Buffer.from(signature.signature).toString('hex');

      const signatureData: SignatureData = {
        data: data,
        signature: signatureHex,
        publicKey: this.currentIdentity.publicKey,
        timestamp: new Date().toISOString()
      };

      return signatureData;

    } catch (error) {
      console.error('[BRC-31] ❌ Data signing failed:', error.message);
      throw new Error(`Data signing failed: ${error.message}`);
    }
  }

  /**
   * Verify signature (for testing)
   */
  async verifySignature(data: any, signature: string, publicKey: string): Promise<boolean> {
    try {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 0);
      const dataHash = crypto.createHash('sha256').update(dataString).digest();

      const publicKeyBuffer = Buffer.from(publicKey, 'hex');
      const signatureBuffer = Buffer.from(signature, 'hex');

      return secp256k1.ecdsaVerify(signatureBuffer, dataHash, publicKeyBuffer);

    } catch (error) {
      console.error('[BRC-31] ❌ Signature verification failed:', error.message);
      return false;
    }
  }

  /**
   * Create authentication header for API requests
   */
  async createAuthHeader(): Promise<string> {
    try {
      if (!this.currentIdentity) {
        throw new Error('No authenticated identity available');
      }

      const timestamp = new Date().toISOString();
      const nonce = crypto.randomBytes(16).toString('hex');

      const authData = {
        producerId: this.currentIdentity.producerId,
        publicKey: this.currentIdentity.publicKey,
        timestamp,
        nonce
      };

      const signature = await this.signData(authData);

      const authHeader = Buffer.from(JSON.stringify({
        producer_id: this.currentIdentity.producerId,
        public_key: this.currentIdentity.publicKey,
        timestamp,
        nonce,
        signature: signature.signature
      })).toString('base64');

      return `BRC31 ${authHeader}`;

    } catch (error) {
      console.error('[BRC-31] ❌ Auth header creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Update producer profile
   */
  async updateProfile(updates: Partial<ProducerIdentityData>): Promise<any> {
    try {
      console.log('[BRC-31] Updating producer profile...');

      if (!this.currentIdentity) {
        throw new Error('No authenticated identity available');
      }

      const updateData = {
        producerId: this.currentIdentity.producerId,
        updates,
        timestamp: new Date().toISOString()
      };

      const signature = await this.signData(updateData);
      const signedUpdate = {
        ...updateData,
        signature: signature.signature
      };

      const response = await this.submitToOverlay('/api/v1/producers/update', signedUpdate);

      // Update local identity
      if (updates.displayName) {
        this.currentIdentity.displayName = updates.displayName;
      }
      if (updates.capabilities) {
        this.currentIdentity.capabilities = updates.capabilities;
      }

      console.log('[BRC-31] ✅ Profile updated successfully');
      return response;

    } catch (error) {
      console.error('[BRC-31] ❌ Profile update failed:', error.message);
      throw error;
    }
  }

  /**
   * Rotate identity key
   */
  async rotateIdentityKey(newIdentityKey: string, transitionPeriod: number = 7 * 24 * 60 * 60 * 1000): Promise<any> {
    try {
      console.log('[BRC-31] Rotating identity key...');

      if (!this.currentIdentity) {
        throw new Error('No authenticated identity available');
      }

      const oldIdentity = { ...this.currentIdentity };
      const newIdentity = await this.authenticate(newIdentityKey);

      const rotationData = {
        oldProducerId: oldIdentity.producerId,
        oldPublicKey: oldIdentity.publicKey,
        newProducerId: newIdentity.producerId,
        newPublicKey: newIdentity.publicKey,
        transitionPeriod,
        timestamp: new Date().toISOString()
      };

      // Sign with old key
      const oldPrivateKey = oldIdentity.privateKey;
      this.currentIdentity = oldIdentity;
      const oldSignature = await this.signData(rotationData);

      // Sign with new key
      this.currentIdentity = newIdentity;
      const newSignature = await this.signData(rotationData);

      const rotationRequest = {
        ...rotationData,
        oldSignature: oldSignature.signature,
        newSignature: newSignature.signature
      };

      const response = await this.submitToOverlay('/api/v1/producers/rotate-key', rotationRequest);

      console.log('[BRC-31] ✅ Identity key rotated successfully');
      return response;

    } catch (error) {
      console.error('[BRC-31] ❌ Key rotation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current producer identity
   */
  getCurrentIdentity(): ProducerIdentity | null {
    return this.currentIdentity;
  }

  /**
   * Generate producer ID from public key
   */
  private generateProducerId(publicKey: string): string {
    const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
    return `producer_${hash.substring(0, 16)}`;
  }

  /**
   * Submit request to overlay network with authentication
   */
  private async submitToOverlay(endpoint: string, data: any): Promise<any> {
    try {
      const authHeader = await this.createAuthHeader();

      // Mock implementation - replace with actual HTTP client
      const mockResponse = {
        success: true,
        data: data,
        timestamp: new Date().toISOString(),
        endpoint: `${this.overlayUrl}${endpoint}`
      };

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));

      return mockResponse;

    } catch (error) {
      throw new Error(`Overlay network request failed: ${error.message}`);
    }
  }

  /**
   * Health check for BRC-31 identity component
   */
  async healthCheck(): Promise<any> {
    return {
      component: 'BRC-31 Producer Identity',
      status: this.currentIdentity ? 'authenticated' : 'not_authenticated',
      identity: this.currentIdentity ? {
        producerId: this.currentIdentity.producerId,
        displayName: this.currentIdentity.displayName,
        capabilities: this.currentIdentity.capabilities.length
      } : null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate new identity key
   */
  static generateIdentityKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate identity key format
   */
  static validateIdentityKey(identityKey: string): boolean {
    try {
      const buffer = Buffer.from(identityKey, 'hex');
      return buffer.length === 32;
    } catch {
      return false;
    }
  }
}

export { BRC31ProducerIdentity, ProducerIdentity, ProducerIdentityData, SignatureData };