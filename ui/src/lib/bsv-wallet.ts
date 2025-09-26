/**
 * Clean BSV Wallet Service - PeerPay style implementation
 * Simple, modern MetaNet Desktop wallet detection and connection
 */

import { WalletClient } from '@bsv/sdk';

interface WalletConfig {
  apiUrl?: string;
}

class BSVWallet {
  private wallet: WalletClient;
  private connected: boolean = false;
  private publicKey: string | null = null;
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private config: WalletConfig;

  constructor(config: WalletConfig = {}) {
    this.config = {
      apiUrl: 'http://localhost:3000',
      ...config
    };

    this.wallet = new WalletClient();
    this.startWalletDetection();
  }

  /**
   * Start wallet detection - clean and simple
   */
  private startWalletDetection() {
    console.log('🔍 Starting MetaNet Desktop wallet detection...');

    // Check for wallet availability every 2 seconds
    const checkInterval = setInterval(async () => {
      try {
        const available = await this.checkWalletAvailable();
        if (available && !this.connected) {
          console.log('✅ MetaNet Desktop detected - ready for connection');
          // Don't auto-connect - wait for user action
        }
      } catch (error) {
        // Silently handle detection errors
      }
    }, 2000);

    // Keep reference for cleanup if needed
    this.checkInterval = checkInterval;
  }

  /**
   * Check if MetaNet Desktop wallet is available
   */
  private async checkWalletAvailable(): Promise<boolean> {
    try {
      await this.wallet.getNetwork();
      return true;
    } catch (error) {
      // Check common wallet not available error messages
      const message = error.message.toLowerCase();
      if (message.includes('no wallet available') ||
          message.includes('no metanet client') ||
          message.includes('not running') ||
          message.includes('connection refused')) {
        return false;
      }
      // If it's just an auth error, wallet is available
      return message.includes('authentication') || message.includes('privileged');
    }
  }

  /**
   * Connect to MetaNet Desktop wallet - simple one-shot
   */
  async connect(): Promise<{ publicKey: string; isConnected: boolean }> {
    console.log('🔗 Connecting to MetaNet Desktop wallet...');

    if (this.connected && this.publicKey) {
      console.log('✅ Already connected');
      return {
        publicKey: this.publicKey,
        isConnected: true
      };
    }

    try {
      // Check wallet availability first
      const available = await this.checkWalletAvailable();
      if (!available) {
        throw new Error('MetaNet Desktop wallet is not running. Please start MetaNet Desktop and try again.');
      }

      // Simple authentication
      console.log('🔐 Requesting wallet authentication...');
      await this.wallet.waitForAuthentication();
      console.log('✅ Wallet authenticated successfully');

      // Get identity key
      const identityKey = await this.wallet.getPublicKey({
        identityKey: true
      });

      this.publicKey = identityKey.publicKey;
      this.connected = true;

      console.log('🔑 Identity key received:', this.publicKey.slice(0, 10) + '...');

      // Notify listeners
      this.notifyConnectionChange(true);

      return {
        publicKey: this.publicKey,
        isConnected: true
      };

    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      this.connected = false;
      this.publicKey = null;
      this.notifyConnectionChange(false);
      throw error;
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.publicKey = null;
    this.notifyConnectionChange(false);
    console.log('🔌 Disconnected from wallet');
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected(): boolean {
    return this.connected && this.publicKey !== null;
  }

  /**
   * Get public key
   */
  getPublicKey(): string | null {
    return this.publicKey;
  }

  /**
   * Get the wallet client for advanced operations
   */
  getWalletClient(): WalletClient {
    return this.wallet;
  }

  /**
   * Verify wallet connection with async check
   */
  async verifyWalletConnection(): Promise<boolean> {
    console.log('🔍 Verifying wallet connection...');

    try {
      if (!this.connected || !this.publicKey) {
        return false;
      }

      // Quick check if wallet is still available
      const available = await this.checkWalletAvailable();
      if (!available) {
        console.log('❌ MetaNet client no longer available');
        this.connected = false;
        this.publicKey = null;
        this.notifyConnectionChange(false);
        return false;
      }

      console.log('✅ Wallet connection verified');
      return true;

    } catch (error) {
      console.warn('⚠️ Wallet verification failed:', error.message);
      this.connected = false;
      this.publicKey = null;
      this.notifyConnectionChange(false);
      return false;
    }
  }

  /**
   * Create certificate signing request - CoolCert style
   */
  async createCertificateSigningRequest(certificateFields: {
    display_name: string;
    participant?: string;
    level?: string;
    organization?: string;
    email?: string;
  }): Promise<any> {
    if (!this.connected || !this.publicKey) {
      throw new Error('Wallet must be connected to create CSR');
    }

    try {
      console.log('🔐 Creating certificate signing request...');

      // Create CSR manually - BSV SDK doesn't have createSigningRequest
      const csr = {
        fields: certificateFields,
        identityKey: this.publicKey,
        timestamp: Date.now(),
        version: '1.0'
      };

      console.log('✅ Certificate signing request created');
      return csr;

    } catch (error) {
      console.error('❌ CSR creation failed:', error);
      throw new Error(`Failed to create certificate signing request: ${error.message}`);
    }
  }

  /**
   * Submit certificate signing request to certifier - CoolCert style
   */
  async submitCertificateSigningRequest(csr: any, certifierUrl?: string): Promise<any> {
    try {
      console.log('📤 Submitting certificate signing request...');

      const submitUrl = certifierUrl || `${this.config.apiUrl}/v1/certificate/sign`;

      const response = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          csr,
          type: 'gitdata-participant'
        })
      });

      if (!response.ok) {
        throw new Error(`Certificate signing failed: ${response.statusText}`);
      }

      const signedCertificate = await response.json();
      console.log('✅ Certificate signed and returned');

      return signedCertificate;

    } catch (error) {
      console.error('❌ CSR submission failed:', error);
      throw new Error(`Failed to submit certificate signing request: ${error.message}`);
    }
  }

  /**
   * Acquire certificate from gitdata server - CoolCert style
   */
  async acquireGitdataCertificate(displayName?: string): Promise<any> {
    if (!this.connected || !this.publicKey) {
      throw new Error('Wallet must be connected to acquire certificate');
    }

    try {
      console.log('🔄 Acquiring Gitdata certificate...');

      // Check certificate service
      const statusResponse = await fetch(`${this.config.apiUrl}/v1/certificate/status`);
      if (!statusResponse.ok) {
        throw new Error('Certificate service not available');
      }

      const statusData = await statusResponse.json();
      if (!statusData.bsvAuthEnabled) {
        throw new Error('BSV authentication not enabled on server');
      }

      // Use BSV SDK's certificate acquisition
      const { MasterCertificate } = await import('@bsv/sdk');

      const certificateFields = {
        display_name: displayName || 'Gitdata User',
        participant: 'verified',
        level: 'standard'
      };

      console.log('🔐 Acquiring certificate with fields:', certificateFields);

      const certificate = await MasterCertificate.acquireCertificate({
        type: statusData.certificateType,
        fields: certificateFields,
        certifierUrl: `${this.config.apiUrl}/v1/certificate`,
        wallet: this.wallet
      });

      console.log('✅ Certificate acquired successfully');

      // Import to wallet
      await this.saveCertificateToWallet(certificate);
      console.log('✅ Certificate saved to MetaNet wallet');

      return certificate;

    } catch (error) {
      console.error('❌ Certificate acquisition error:', error);
      throw new Error(`Failed to acquire certificate: ${error.message}`);
    }
  }

  /**
   * Save certificate to wallet - simplified
   */
  async saveCertificateToWallet(certificate: any): Promise<void> {
    if (!this.connected) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('💾 Importing certificate to MetaNet wallet...');

      // Try to import as certificate first
      if (certificate.sign && typeof certificate.sign === 'function') {
        console.log('🔐 Importing BSV SDK Certificate object...');
        await this.wallet.importCertificate(certificate);
        console.log('✅ Certificate imported successfully');
        return;
      }

      // Convert to proper certificate format
      const certificateForImport = {
        type: certificate.type,
        subject: certificate.subject,
        serialNumber: certificate.serialNumber,
        certifier: certificate.certifier,
        revocationOutpoint: certificate.revocationOutpoint || '0'.repeat(64) + '.0',
        signature: certificate.signature,
        fields: certificate.fields,
        issuedAt: certificate.issuedAt,
        expiresAt: certificate.expiresAt
      };

      await this.wallet.importCertificate(certificateForImport);
      console.log('✅ Certificate imported successfully');

    } catch (error) {
      console.error('❌ Certificate import failed:', error);
      // Fallback to record storage
      try {
        const certificateData = {
          ...certificate,
          _certificateType: 'gitdata-participant',
          _importedAt: new Date().toISOString()
        };

        await this.wallet.storeRecord({
          data: certificateData,
          protocolID: [2, 'bsv-certificates'],
          keyID: `cert_${certificate.serialNumber || Date.now()}`,
          description: `Gitdata Certificate - ${certificate.fields?.display_name || 'Participant'}`
        });

        console.log('⚡ Certificate stored as record (fallback method)');
      } catch (fallbackError) {
        throw new Error(`Failed to save certificate: ${error.message}`);
      }
    }
  }

  /**
   * Generate authenticated headers for API requests
   */
  async generateAuthHeaders(body: string = ''): Promise<Record<string, string>> {
    if (!this.publicKey || !this.connected) {
      throw new Error('Wallet not connected');
    }

    const nonce = this.generateNonce();
    const message = body + nonce;

    console.log('🔐 Creating signature...');
    const signature = await this.wallet.createSignature({
      data: btoa(message),
      protocolID: [2, 'gitdata-identity'],
      keyID: 'identity',
      privilegedReason: 'Authenticate API request'
    });

    return {
      'X-Identity-Key': this.publicKey,
      'X-Nonce': nonce,
      'X-Signature': signature.signature,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Generate random nonce
   */
  private generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Add connection change listener
   */
  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.push(listener);
    return () => {
      const index = this.connectionListeners.indexOf(listener);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify connection change listeners
   */
  private notifyConnectionChange(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Connection listener error:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private checkInterval?: NodeJS.Timeout;
}

// Create singleton instance
export const bsvWalletService = new BSVWallet();

export default BSVWallet;