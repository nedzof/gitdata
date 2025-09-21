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
   * Signs a previously created action
   */
  async signAction(args: {
    spends: Record<number, {
      unlockingScript: string;
      sequenceNumber?: number;
    }>;
    reference: string;
    options?: any;
  }): Promise<any> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.signAction(args);
    } catch (error) {
      throw new Error(`Failed to sign action: ${error.message}`);
    }
  }

  /**
   * Aborts a previously created action
   */
  async abortAction(reference: string): Promise<{ aborted: boolean }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.abortAction({ reference });
    } catch (error) {
      throw new Error(`Failed to abort action: ${error.message}`);
    }
  }

  /**
   * Internalizes an action by accepting incoming transactions
   */
  async internalizeAction(args: {
    tx: string;
    outputs: Array<{
      outputIndex: number;
      protocol: 'wallet payment' | 'basket insertion';
      paymentRemittance?: {
        derivationPrefix: string;
        derivationSuffix: string;
      };
      insertionRemittance?: {
        basket: string;
        customInstructions?: string;
        tags?: string[];
      };
    }>;
    description: string;
    labels?: string[];
  }): Promise<{ accepted: boolean }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.internalizeAction(args);
    } catch (error) {
      throw new Error(`Failed to internalize action: ${error.message}`);
    }
  }

  /**
   * Relinquishes an output from a basket
   */
  async relinquishOutput(basket: string, output: string): Promise<{ relinquished: boolean }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.relinquishOutput({ basket, output });
    } catch (error) {
      throw new Error(`Failed to relinquish output: ${error.message}`);
    }
  }

  /**
   * Reveals counterparty key linkage information
   */
  async revealCounterpartyKeyLinkage(args: {
    counterparty: string;
    verifier: string;
    privilegedReason?: string;
  }): Promise<any> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.revealCounterpartyKeyLinkage(args);
    } catch (error) {
      throw new Error(`Failed to reveal counterparty key linkage: ${error.message}`);
    }
  }

  /**
   * Reveals specific key linkage information
   */
  async revealSpecificKeyLinkage(args: {
    counterparty: string;
    verifier: string;
    protocolID: [0 | 1 | 2, string];
    keyID: string;
    privilegedReason?: string;
  }): Promise<any> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.revealSpecificKeyLinkage(args);
    } catch (error) {
      throw new Error(`Failed to reveal specific key linkage: ${error.message}`);
    }
  }

  /**
   * Creates an HMAC for message authentication
   */
  async createHmac(args: {
    data: string;
    protocolID: [0 | 1 | 2, string];
    keyID: string;
    privilegedReason?: string;
    counterparty?: 'self' | 'anyone' | string;
    privileged?: boolean;
  }): Promise<{ hmac: string }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.createHmac(args);
    } catch (error) {
      throw new Error(`Failed to create HMAC: ${error.message}`);
    }
  }

  /**
   * Verifies an HMAC for message authentication
   */
  async verifyHmac(args: {
    data: string;
    hmac: string;
    protocolID: [0 | 1 | 2, string];
    keyID: string;
    privilegedReason?: string;
    counterparty?: 'self' | 'anyone' | string;
    privileged?: boolean;
  }): Promise<{ valid: boolean }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.verifyHmac(args);
    } catch (error) {
      throw new Error(`Failed to verify HMAC: ${error.message}`);
    }
  }

  /**
   * Verifies a digital signature
   */
  async verifySignature(args: {
    data?: string;
    hashToDirectlyVerify?: string;
    signature: string;
    protocolID: [0 | 1 | 2, string];
    keyID: string;
    privilegedReason?: string;
    counterparty?: 'self' | 'anyone' | string;
    privileged?: boolean;
    forSelf?: boolean;
  }): Promise<{ valid: boolean }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.verifySignature(args);
    } catch (error) {
      throw new Error(`Failed to verify signature: ${error.message}`);
    }
  }

  /**
   * Acquires a certificate for proving key ownership
   */
  async acquireCertificate(args: {
    type: string;
    certifier: string;
    acquisitionProtocol: string;
    fields: Record<string, string>;
    serialNumber?: string;
    revocationOutpoint?: string;
    signature?: string;
    privilegedReason?: string;
  }): Promise<any> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.acquireCertificate(args);
    } catch (error) {
      throw new Error(`Failed to acquire certificate: ${error.message}`);
    }
  }

  /**
   * Lists certificates held by the wallet
   */
  async listCertificates(args: {
    certifiers: string[];
    types: string[];
    limit?: number;
    offset?: number;
    privileged?: boolean;
    privilegedReason?: string;
  }): Promise<any> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.listCertificates(args);
    } catch (error) {
      throw new Error(`Failed to list certificates: ${error.message}`);
    }
  }

  /**
   * Proves ownership of a certificate
   */
  async proveCertificate(args: {
    certificate: any;
    fieldsToReveal: string[];
    verifier: string;
    privilegedReason?: string;
  }): Promise<any> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.proveCertificate(args);
    } catch (error) {
      throw new Error(`Failed to prove certificate: ${error.message}`);
    }
  }

  /**
   * Relinquishes a certificate from the wallet
   */
  async relinquishCertificate(args: {
    type: string;
    serialNumber: string;
    certifier: string;
  }): Promise<{ relinquished: boolean }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.relinquishCertificate(args);
    } catch (error) {
      throw new Error(`Failed to relinquish certificate: ${error.message}`);
    }
  }

  /**
   * Discovers certificates by identity key
   */
  async discoverByIdentityKey(args: {
    identityKey: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.discoverByIdentityKey(args);
    } catch (error) {
      throw new Error(`Failed to discover certificates by identity key: ${error.message}`);
    }
  }

  /**
   * Discovers certificates by their attributes
   */
  async discoverByAttributes(args: {
    attributes: Record<string, string>;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      return await wallet.discoverByAttributes(args);
    } catch (error) {
      throw new Error(`Failed to discover certificates by attributes: ${error.message}`);
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
   * Checks if the user is currently authenticated with the wallet
   */
  async isAuthenticated(): Promise<boolean> {
    const wallet = this.getWallet();
    if (!wallet) {
      return false;
    }

    try {
      if (wallet.isAuthenticated) {
        return await wallet.isAuthenticated();
      }
      // Fallback: try to get public key to test authentication
      await wallet.getPublicKey({ identityKey: true });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Waits for user authentication to complete
   */
  async waitForAuthentication(): Promise<boolean> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      if (wallet.waitForAuthentication) {
        return await wallet.waitForAuthentication();
      }
      // Fallback: check authentication status
      return await this.isAuthenticated();
    } catch (error) {
      throw new Error(`Failed to wait for authentication: ${error.message}`);
    }
  }

  /**
   * Gets the current blockchain height
   */
  async getHeight(): Promise<number> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      if (wallet.getHeight) {
        return await wallet.getHeight();
      }
      throw new Error('Wallet does not support getHeight method');
    } catch (error) {
      throw new Error(`Failed to get blockchain height: ${error.message}`);
    }
  }

  /**
   * Gets the block header for a specific height
   */
  async getHeaderForHeight(height: number): Promise<{
    height: number;
    hash: string;
    version: number;
    previousHash: string;
    merkleRoot: string;
    time: number;
    bits: number;
    nonce: number;
  }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      if (wallet.getHeaderForHeight) {
        return await wallet.getHeaderForHeight(height);
      }
      throw new Error('Wallet does not support getHeaderForHeight method');
    } catch (error) {
      throw new Error(`Failed to get header for height ${height}: ${error.message}`);
    }
  }

  /**
   * Gets the current network type
   */
  async getNetwork(): Promise<'mainnet' | 'testnet' | 'regtest'> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      if (wallet.getNetwork) {
        return await wallet.getNetwork();
      }
      // Default to mainnet if not supported
      return 'mainnet';
    } catch (error) {
      throw new Error(`Failed to get network: ${error.message}`);
    }
  }

  /**
   * Gets the wallet version (enhanced implementation)
   */
  async getVersion(): Promise<{ version: string; implementation: string }> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      if (wallet.getVersion) {
        return await wallet.getVersion();
      }
      // Fallback version info
      return {
        version: '1.0.0',
        implementation: 'Unknown BRC-100 Wallet'
      };
    } catch (error) {
      throw new Error(`Failed to get wallet version: ${error.message}`);
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
   * Validates that a wallet implements all 28 required BRC-100 methods
   */
  async validateWallet(wallet: Wallet): Promise<boolean> {
    const requiredMethods = [
      // Core Transaction Methods (7)
      'createAction',
      'signAction',
      'abortAction',
      'listActions',
      'internalizeAction',
      'listOutputs',
      'relinquishOutput',
      // Key Management Methods (3)
      'getPublicKey',
      'revealCounterpartyKeyLinkage',
      'revealSpecificKeyLinkage',
      // Cryptographic Methods (6)
      'encrypt',
      'decrypt',
      'createHmac',
      'verifyHmac',
      'createSignature',
      'verifySignature',
      // Certificate Methods (6)
      'acquireCertificate',
      'listCertificates',
      'proveCertificate',
      'relinquishCertificate',
      'discoverByIdentityKey',
      'discoverByAttributes'
    ];

    const optionalMethods = [
      // Authentication & Network Methods (6) - optional but recommended
      'isAuthenticated',
      'waitForAuthentication',
      'getHeight',
      'getHeaderForHeight',
      'getNetwork',
      'getVersion',
      // Utility Methods (2)
      'isAvailable'
    ];

    let missingRequired = 0;
    let missingOptional = 0;

    // Check required methods
    for (const method of requiredMethods) {
      if (typeof wallet[method] !== 'function') {
        console.warn(`Wallet missing required BRC-100 method: ${method}`);
        missingRequired++;
      }
    }

    // Check optional methods
    for (const method of optionalMethods) {
      if (typeof wallet[method] !== 'function') {
        console.info(`Wallet missing optional BRC-100 method: ${method}`);
        missingOptional++;
      }
    }

    console.log(`BRC-100 Validation Results:
      Required methods: ${requiredMethods.length - missingRequired}/${requiredMethods.length}
      Optional methods: ${optionalMethods.length - missingOptional}/${optionalMethods.length}
      Total compliance: ${requiredMethods.length + optionalMethods.length - missingRequired - missingOptional}/${requiredMethods.length + optionalMethods.length}`);

    // Test basic functionality
    try {
      if (wallet.isAvailable) {
        await wallet.isAvailable();
      }
      return missingRequired === 0; // Must have all required methods
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