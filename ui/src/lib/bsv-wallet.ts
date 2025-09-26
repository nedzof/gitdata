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
      apiUrl: 'http://localhost:8788',
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
   * Authenticate with backend using BRC-31
   */
  private async authenticateWithBackend(): Promise<void> {
    if (!this.publicKey) {
      throw new Error('No public key available for backend authentication');
    }

    try {
      console.log('🔄 Authenticating with backend...');

      // Step 1: Initialize session
      const initResponse = await fetch(`${this.config.apiUrl}/identity/wallet/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletType: 'metanet',
          capabilities: ['sign', 'pay', 'identity']
        })
      });

      if (!initResponse.ok) {
        throw new Error(`Backend init failed: ${initResponse.statusText}`);
      }

      const { sessionId } = await initResponse.json();
      console.log('📋 Got session ID:', sessionId);

      // Step 2: Create verification signature
      const nonce = this.generateNonce();
      const message = `wallet_verification:${sessionId}`;

      const signature = await this.walletClient.createSignature({
        data: btoa(message + nonce),
        protocolID: [2, 'gitdata-identity'],
        keyID: 'identity',
        privilegedReason: 'Verify wallet ownership for Gitdata platform'
      });

      // Step 3: Verify with backend
      const verifyResponse = await fetch(`${this.config.apiUrl}/identity/wallet/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          identityKey: this.publicKey,
          signature: signature.signature,
          nonce
        })
      });

      if (!verifyResponse.ok) {
        throw new Error(`Backend verification failed: ${verifyResponse.statusText}`);
      }

      console.log('✅ Backend authentication successful!');

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