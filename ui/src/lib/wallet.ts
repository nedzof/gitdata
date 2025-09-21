// BRC-100 Wallet Service
// Handles wallet detection, connection, and interaction

import type { Wallet, WalletConnection, WalletError } from './brc100-types';

class WalletService {
  private walletConnection: WalletConnection | null = null;
  private connectionListeners: ((connected: boolean) => void)[] = [];

  /**
   * Detects if a BRC-100 compatible wallet is available
   */
  async detectWallet(): Promise<Wallet | null> {
    // Check for standard BRC-100 wallet injection patterns
    if (typeof window !== 'undefined') {
      // Standard BSV wallet injection
      if (window.bsv?.wallet) {
        return window.bsv.wallet;
      }

      // Alternative wallet injection
      if (window.wallet) {
        return window.wallet;
      }

      // Check for specific wallet implementations that might use different patterns
      // This can be extended as more wallets implement BRC-100
      const walletProviders = ['panda', 'yours', 'handcash', 'moneybutton'];

      for (const provider of walletProviders) {
        if ((window as any)[provider]?.wallet) {
          return (window as any)[provider].wallet;
        }
      }
    }

    return null;
  }

  /**
   * Connects to the detected wallet and establishes a session
   */
  async connect(): Promise<WalletConnection> {
    try {
      const wallet = await this.detectWallet();

      if (!wallet) {
        throw new Error('No BRC-100 compatible wallet found. Please install a compatible wallet.');
      }

      // Test wallet availability
      if (wallet.isAvailable) {
        const available = await wallet.isAvailable();
        if (!available) {
          throw new Error('Wallet is not available or not responding.');
        }
      }

      // Get public key for authentication
      const publicKeyResult = await wallet.getPublicKey({
        identityKey: true
      });

      this.walletConnection = {
        wallet,
        isConnected: true,
        publicKey: publicKeyResult.publicKey
      };

      this.notifyConnectionChange(true);
      return this.walletConnection;

    } catch (error) {
      this.walletConnection = null;
      this.notifyConnectionChange(false);
      throw new Error(`Failed to connect to wallet: ${error.message}`);
    }
  }

  /**
   * Disconnects from the current wallet
   */
  async disconnect(): Promise<void> {
    this.walletConnection = null;
    this.notifyConnectionChange(false);
  }

  /**
   * Gets the current wallet connection
   */
  getConnection(): WalletConnection | null {
    return this.walletConnection;
  }

  /**
   * Checks if wallet is currently connected
   */
  isConnected(): boolean {
    return this.walletConnection?.isConnected ?? false;
  }

  /**
   * Gets the connected wallet instance
   */
  getWallet(): Wallet | null {
    return this.walletConnection?.wallet ?? null;
  }

  /**
   * Gets the public key of the connected wallet
   */
  getPublicKey(): string | null {
    return this.walletConnection?.publicKey ?? null;
  }

  /**
   * Authenticates user by getting their identity public key
   */
  async authenticate(): Promise<{ publicKey: string; address?: string }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      const result = await wallet.getPublicKey({
        identityKey: true
      });

      return {
        publicKey: result.publicKey
      };
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Creates a transaction for purchasing data
   */
  async createPurchaseTransaction(args: {
    description: string;
    recipientScript: string;
    amount: number;
    versionId: string;
  }): Promise<{ txid?: string; tx?: string; reference?: string }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      const result = await wallet.createAction({
        description: args.description,
        outputs: [{
          script: args.recipientScript,
          satoshis: args.amount,
          description: `Purchase of data version ${args.versionId}`,
          basket: 'purchases',
          tags: ['data-purchase', `version:${args.versionId}`]
        }],
        labels: ['data-purchase', 'gitdata-purchase']
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to create purchase transaction: ${error.message}`);
    }
  }

  /**
   * Lists user's purchase history
   */
  async getPurchaseHistory(): Promise<any[]> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      const result = await wallet.listActions({
        labels: ['data-purchase', 'gitdata-purchase'],
        labelQueryMode: 'any',
        includeOutputs: true,
        includeLabels: true
      });

      return result.actions;
    } catch (error) {
      throw new Error(`Failed to get purchase history: ${error.message}`);
    }
  }

  /**
   * Lists available UTXOs for spending
   */
  async getAvailableBalance(): Promise<{ balance: number; outputs: any[] }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      const result = await wallet.listOutputs({
        basket: 'default',
        includeCustomInstructions: true,
        includeTags: true
      });

      const balance = result.outputs.reduce((sum, output) => sum + output.satoshis, 0);

      return {
        balance,
        outputs: result.outputs
      };
    } catch (error) {
      throw new Error(`Failed to get available balance: ${error.message}`);
    }
  }

  /**
   * Signs arbitrary data for verification
   */
  async signData(data: string, protocolID: string = 'gitdata-auth'): Promise<string> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      const result = await wallet.createSignature({
        data: btoa(data), // Convert to base64
        protocolID: [2, protocolID],
        keyID: 'identity',
        privilegedReason: 'Authenticate with Gitdata platform'
      });

      return result.signature;
    } catch (error) {
      throw new Error(`Failed to sign data: ${error.message}`);
    }
  }

  /**
   * Encrypts data using wallet's encryption capabilities
   */
  async encryptData(data: string, protocolID: string = 'gitdata-storage'): Promise<string> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      const result = await wallet.encrypt({
        plaintext: btoa(data), // Convert to base64
        protocolID: [2, protocolID],
        keyID: 'storage',
        counterparty: 'self'
      });

      return result.ciphertext;
    } catch (error) {
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
  }

  /**
   * Decrypts data using wallet's decryption capabilities
   */
  async decryptData(ciphertext: string, protocolID: string = 'gitdata-storage'): Promise<string> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      const result = await wallet.decrypt({
        ciphertext,
        protocolID: [2, protocolID],
        keyID: 'storage',
        counterparty: 'self'
      });

      return atob(result.plaintext); // Convert from base64
    } catch (error) {
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
  }

  /**
   * Gets wallet version and implementation info
   */
  async getWalletInfo(): Promise<{ version: string; implementation: string } | null> {
    const wallet = this.getWallet();
    if (!wallet || !wallet.getVersion) {
      return null;
    }

    try {
      return await wallet.getVersion();
    } catch (error) {
      return null;
    }
  }

  /**
   * Registers a listener for connection state changes
   */
  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.connectionListeners.indexOf(listener);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notifies all listeners of connection state changes
   */
  private notifyConnectionChange(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Error in wallet connection listener:', error);
      }
    });
  }

  /**
   * Validates that a wallet implements required BRC-100 methods
   */
  async validateWallet(wallet: Wallet): Promise<boolean> {
    const requiredMethods = [
      'getPublicKey',
      'createAction',
      'listActions',
      'listOutputs'
    ];

    for (const method of requiredMethods) {
      if (typeof wallet[method] !== 'function') {
        console.warn(`Wallet missing required method: ${method}`);
        return false;
      }
    }

    // Test basic functionality
    try {
      if (wallet.isAvailable) {
        await wallet.isAvailable();
      }
      return true;
    } catch (error) {
      console.warn('Wallet validation failed:', error);
      return false;
    }
  }
}

// Create singleton instance
export const walletService = new WalletService();

// Helper functions for common operations
export async function connectWallet(): Promise<WalletConnection> {
  return walletService.connect();
}

export async function disconnectWallet(): Promise<void> {
  return walletService.disconnect();
}

export function isWalletConnected(): boolean {
  return walletService.isConnected();
}

export function getConnectedWallet(): Wallet | null {
  return walletService.getWallet();
}

export function getWalletPublicKey(): string | null {
  return walletService.getPublicKey();
}

// Re-export types for convenience
export type { Wallet, WalletConnection, WalletError } from './brc100-types';