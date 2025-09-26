/**
 * BSV SDK-based Wallet Service
 * Based on PeerPay implementation for MetaNet Desktop compatibility
 */

import { WalletClient } from '@bsv/sdk';

interface WalletServiceConfig {
  apiUrl?: string;
  checkInterval?: number;
}

class BSVWalletService {
  private walletClient: WalletClient;
  private isConnected: boolean = false;
  private isChecking: boolean = false;
  private publicKey: string | null = null;
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private config: WalletServiceConfig;

  constructor(config: WalletServiceConfig = {}) {
    this.config = {
      apiUrl: 'http://localhost:3000',
      checkInterval: 1000,
      ...config
    };

    this.walletClient = new WalletClient();
    this.startMetaNetCheck();
  }

  /**
   * Start checking for MetaNet Client similar to PeerPay
   */
  private startMetaNetCheck() {
    if (this.isChecking) return;

    this.isChecking = true;
    console.log('🔍 Starting MetaNet Desktop detection...');

    const checkInterval = setInterval(async () => {
      try {
        const hasMetaNet = await this.checkForMetaNetClient();

        if (hasMetaNet) {
          console.log('✅ MetaNet Client detected!');
          clearInterval(checkInterval);
          this.isChecking = false;

          // Try to authenticate
          await this.attemptAuthentication();
        } else {
          console.log('⏳ Waiting for MetaNet Client...');
        }
      } catch (error) {
        console.log('❌ MetaNet check error:', error.message);
      }
    }, this.config.checkInterval);
  }

  /**
   * Check for MetaNet Client - based on PeerPay's approach
   */
  private async checkForMetaNetClient(): Promise<boolean> {
    try {
      // The BSV SDK WalletClient automatically detects and connects to MetaNet
      // We can test this by checking if we can get version info
      const isAvailable = await this.walletClient.isAuthenticated();
      return true; // If no error, MetaNet is available
    } catch (error) {
      // Check if the error suggests MetaNet is not running
      if (error.message.includes('No MetaNet Client') ||
          error.message.includes('not running') ||
          error.message.includes('connection refused')) {
        return false;
      }
      // For other errors, assume MetaNet might be available but not authenticated
      return true;
    }
  }

  /**
   * Attempt authentication with MetaNet Desktop
   */
  private async attemptAuthentication() {
    try {
      console.log('🔐 Attempting authentication with MetaNet Desktop...');

      // Use BSV SDK's waitForAuthentication like PeerPay does
      await this.walletClient.waitForAuthentication();

      console.log('✅ Authentication successful!');

      // Get public key for identity
      const identityKey = await this.walletClient.getPublicKey({
        identityKey: true
      });

      this.publicKey = identityKey.publicKey;
      this.isConnected = true;

      console.log('🔑 Got identity key:', this.publicKey.slice(0, 10) + '...');

      // Notify listeners
      this.notifyConnectionChange(true);

      // Try to authenticate with backend
      await this.authenticateWithBackend();

    } catch (error) {
      console.error('❌ Authentication failed:', error);
      this.isConnected = false;
      this.publicKey = null;
      this.notifyConnectionChange(false);
      throw error;
    }
  }

  /**
   * Manually trigger connection attempt
   */
  async connect(): Promise<{ publicKey: string; isConnected: boolean }> {
    console.log('🔗 Manual connect requested...');

    if (this.isConnected && this.publicKey) {
      return {
        publicKey: this.publicKey,
        isConnected: true
      };
    }

    await this.attemptAuthentication();

    if (!this.isConnected || !this.publicKey) {
      throw new Error('Failed to connect to MetaNet Desktop wallet');
    }

    return {
      publicKey: this.publicKey,
      isConnected: true
    };
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.publicKey = null;
    this.notifyConnectionChange(false);
    console.log('🔌 Disconnected from wallet');
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get public key
   */
  getPublicKey(): string | null {
    return this.publicKey;
  }

  /**
   * Get the underlying WalletClient for advanced operations
   */
  getWalletClient(): WalletClient {
    return this.walletClient;
  }

  /**
   * Get wallet instance for certificate operations
   */
  getWallet(): WalletClient {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }
    return this.walletClient;
  }

  /**
   * Save certificate to BRC-100 MetaNet wallet
   */
  async saveCertificateToWallet(certificate: any): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('💾 Importing certificate to MetaNet wallet...');

      // For BSV Certificate objects, use importCertificate method
      if (certificate.sign && typeof certificate.sign === 'function') {
        console.log('🔐 Importing BSV SDK Certificate object...');

        // This should be the proper way to import a certificate to MetaNet wallet
        await this.walletClient.importCertificate(certificate);

        console.log('✅ Certificate successfully imported to MetaNet wallet!');
        return;
      }

      // For plain objects, try to create a proper certificate format
      console.log('📄 Converting to certificate format...');

      const certificateForImport = {
        type: certificate.type,
        subject: certificate.subject,
        serialNumber: certificate.serialNumber,
        certifier: certificate.certifier,
        revocationOutpoint: certificate.revocationOutpoint || '0'.repeat(64) + '.0',
        signature: certificate.signature,
        fields: certificate.fields,
        // Add standard certificate metadata
        issuedAt: certificate.issuedAt,
        expiresAt: certificate.expiresAt
      };

      // Try importing as a certificate
      await this.walletClient.importCertificate(certificateForImport);
      console.log('✅ Certificate imported successfully!');

    } catch (error) {
      console.error('❌ Certificate import failed, trying record storage fallback:', error);

      // Fallback: Store as a record with special certificate protocol
      try {
        const certificateData = {
          ...certificate,
          _certificateType: 'gitdata-participant',
          _importedAt: new Date().toISOString(),
          _walletImport: true
        };

        await this.walletClient.storeRecord({
          data: certificateData,
          protocolID: [2, 'bsv-certificates'],
          keyID: `cert_${certificate.serialNumber || Date.now()}`,
          description: `Gitdata Certificate - ${certificate.fields?.display_name || certificate.subject || 'Participant'}`
        });

        console.log('⚡ Certificate stored as record (fallback method)');

        // Notify user about the storage method
        if (typeof window !== 'undefined') {
          console.warn('⚠️  Certificate saved as wallet record. For full certificate features, ensure your MetaNet wallet supports certificate import.');
        }

      } catch (fallbackError) {
        console.error('❌ All methods failed:', fallbackError);
        throw new Error(`Failed to save certificate: ${error instanceof Error ? error.message : 'Certificate import not supported by wallet'}`);
      }
    }
  }

  /**
   * Manually acquire a certificate from the gitdata server
   * Can be called from the UI when user wants to get their certificate
   */
  async acquireGitdataCertificate(displayName?: string): Promise<any> {
    if (!this.isConnected || !this.publicKey) {
      throw new Error('Wallet must be connected to acquire certificate');
    }

    try {
      console.log('🔄 Acquiring Gitdata participant certificate...');

      // Check certificate service status
      const statusResponse = await fetch(`${this.config.apiUrl}/v1/certificate/status`);
      if (!statusResponse.ok) {
        throw new Error('Certificate service not available');
      }

      const statusData = await statusResponse.json();
      if (!statusData.bsvAuthEnabled) {
        throw new Error('BSV authentication not enabled on server');
      }

      // Use BSV SDK's MasterCertificate.acquireCertificate method
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
        wallet: this.walletClient
      });

      console.log('✅ Certificate acquired successfully!');

      // Save certificate to wallet
      await this.saveCertificateToWallet(certificate);

      console.log('✅ Certificate saved to MetaNet wallet!');

      return certificate;

    } catch (error) {
      console.error('❌ Certificate acquisition error:', error);
      throw new Error(`Failed to acquire certificate: ${error.message}`);
    }
  }

  /**
   * Get certificates from BRC-100 MetaNet wallet
   */
  async getCertificatesFromWallet(): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('📋 Retrieving certificates from MetaNet wallet...');

      let certificates: any[] = [];

      // Try to get certificates from the wallet's certificate collection first
      try {
        const certList = await this.walletClient.listCertificates();
        certificates = Array.isArray(certList) ? certList : [];
        console.log(`✅ Retrieved ${certificates.length} certificates from wallet certificate collection`);
      } catch (error) {
        console.log('📦 Certificate list not available, checking record storage...');

        // Fallback to record storage for certificates stored as records
        try {
          const records = await this.walletClient.findRecords({
            protocolID: [2, 'bsv-certificates']
          });

          certificates = records
            .filter(record => record.data && record.data._walletImport)
            .map(record => record.data);

          console.log(`⚡ Retrieved ${certificates.length} certificates from wallet records`);
        } catch (recordError) {
          console.log('📂 No certificate records found');
        }
      }

      return certificates;

    } catch (error) {
      console.error('❌ Failed to retrieve certificates from wallet:', error);
      return []; // Return empty array instead of throwing to avoid breaking the app
    }
  }

  /**
   * Acquire certificate from backend using BSV Certificate Acquisition Protocol
   * Based on CoolCert implementation pattern
   */
  private async authenticateWithBackend(): Promise<void> {
    if (!this.publicKey) {
      throw new Error('No public key available for certificate acquisition');
    }

    try {
      console.log('🔄 Acquiring certificate from backend...');

      // Check if certificate endpoint is available
      const statusResponse = await fetch(`${this.config.apiUrl}/v1/certificate/status`);
      if (!statusResponse.ok) {
        console.log('⚠️  Certificate endpoint not available, skipping certificate acquisition');
        return;
      }

      const statusData = await statusResponse.json();
      if (!statusData.bsvAuthEnabled) {
        console.log('⚠️  BSV authentication not enabled on server');
        return;
      }

      console.log('📋 Certificate service available, acquiring participant certificate...');

      // Use BSV SDK's MasterCertificate.acquireCertificate method
      const { MasterCertificate } = await import('@bsv/sdk');

      const certificateFields = {
        display_name: 'Gitdata User', // Default display name, could be customized later
        participant: 'verified',
        level: 'standard'
      };

      console.log('🔐 Acquiring certificate with fields:', certificateFields);

      const certificate = await MasterCertificate.acquireCertificate({
        type: statusData.certificateType,
        fields: certificateFields,
        certifierUrl: `${this.config.apiUrl}/v1/certificate`,
        wallet: this.walletClient
      });

      console.log('✅ Certificate acquired successfully!');

      // Save certificate to wallet
      await this.saveCertificateToWallet(certificate);

      console.log('✅ Certificate saved to MetaNet wallet!');

    } catch (error) {
      console.error('❌ Backend authentication error:', error);
      // Don't throw - backend auth is optional
    }
  }

  /**
   * Generate authenticated headers for API requests
   */
  async generateAuthHeaders(body: string = ''): Promise<Record<string, string>> {
    if (!this.publicKey) {
      throw new Error('No wallet connected');
    }

    const nonce = this.generateNonce();
    const message = body + nonce;

    const signature = await this.walletClient.createSignature({
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
}

// Create singleton instance
export const bsvWalletService = new BSVWalletService();

export default BSVWalletService;