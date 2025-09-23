/**
 * BRC-100 Compatible Wallet Connector
 *
 * This module provides a standardized interface for connecting to BRC-100 compatible wallets
 * and integrating with BRC-31 identity verification for the overlay network.
 *
 * Supported wallet types:
 * - HandCash
 * - Centbee
 * - RelayX
 * - Simply Cash
 * - Yours Wallet
 * - Generic BRC-100 wallets
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

import { generateBRC31Headers, verifyBRC31Signature } from '../brc31/signer';

export interface BRC100WalletInfo {
  name: string;
  version: string;
  capabilities: string[];
  identityKey?: string;
  publicKey?: string;
  address?: string;
}

export interface BRC100SignRequest {
  message: string;
  purpose?: string;
  metadata?: any;
}

export interface BRC100SignResponse {
  signature: string;
  publicKey: string;
  algorithm: string;
}

export interface BRC100PaymentRequest {
  outputs: Array<{
    to: string;
    amount: number;
    script?: string;
  }>;
  data?: string[];
  metadata?: any;
}

export interface BRC100PaymentResponse {
  txid: string;
  rawtx: string;
  outputs: Array<{
    vout: number;
    amount: number;
    script: string;
  }>;
}

export interface WalletConnectionConfig {
  apiUrl: string;
  sessionTTL?: number;
  autoReconnect?: boolean;
  enabledWallets?: string[];
}

export class BRC100WalletConnector extends EventEmitter {
  private config: WalletConnectionConfig;
  private connectedWallet: BRC100WalletInfo | null = null;
  private sessionId: string | null = null;
  private isConnecting = false;

  constructor(config: WalletConnectionConfig) {
    super();
    this.config = {
      sessionTTL: 24 * 60 * 60 * 1000, // 24 hours
      autoReconnect: true,
      enabledWallets: ['handcash', 'centbee', 'relayx', 'simply', 'yours', 'metanet'],
      ...config,
    };
  }

  /**
   * Detect available BRC-100 compatible wallets
   */
  async detectWallets(): Promise<string[]> {
    const availableWallets: string[] = [];

    // Check for browser-based wallets
    if (typeof window !== 'undefined') {
      const w = window as any;

      // HandCash
      if (w.handcash) {
        availableWallets.push('handcash');
      }

      // Centbee
      if (w.centbee) {
        availableWallets.push('centbee');
      }

      // RelayX
      if (w.relayone) {
        availableWallets.push('relayx');
      }

      // Simply Cash
      if (w.simply) {
        availableWallets.push('simply');
      }

      // Yours Wallet
      if (w.yours) {
        availableWallets.push('yours');
      }

      // MetaNet Desktop Wallet
      if (w.metanet || w.metaNet || w.MetaNet) {
        availableWallets.push('metanet');
      }

      // Generic BRC-100 interface
      if (w.bsv && w.bsv.wallet) {
        availableWallets.push('generic');
      }
    }

    return availableWallets.filter((wallet) => this.config.enabledWallets?.includes(wallet));
  }

  /**
   * Connect to a specific wallet
   */
  async connect(walletType: string): Promise<BRC100WalletInfo> {
    if (this.isConnecting) {
      throw new Error('Connection already in progress');
    }

    this.isConnecting = true;

    try {
      // Initialize wallet session with backend
      const sessionResponse = await this.initializeSession(walletType);
      this.sessionId = sessionResponse.sessionId;

      // Connect to the wallet
      const walletInfo = await this.connectToWallet(walletType);

      // Verify the connection with BRC-31 signature
      await this.verifyConnection(walletInfo);

      this.connectedWallet = walletInfo;
      this.emit('connected', walletInfo);

      return walletInfo;
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from the current wallet
   */
  async disconnect(): Promise<void> {
    if (this.connectedWallet && this.sessionId) {
      try {
        // Clean up session on backend
        await this.cleanupSession();
      } catch (error) {
        console.warn('Failed to cleanup session:', error);
      }
    }

    this.connectedWallet = null;
    this.sessionId = null;
    this.emit('disconnected');
  }

  /**
   * Sign a message with the connected wallet
   */
  async signMessage(request: BRC100SignRequest): Promise<BRC100SignResponse> {
    if (!this.connectedWallet) {
      throw new Error('No wallet connected');
    }

    const walletInterface = await this.getWalletInterface(this.connectedWallet.name);
    return await walletInterface.sign(request);
  }

  /**
   * Send a payment with the connected wallet
   */
  async sendPayment(request: BRC100PaymentRequest): Promise<BRC100PaymentResponse> {
    if (!this.connectedWallet) {
      throw new Error('No wallet connected');
    }

    const walletInterface = await this.getWalletInterface(this.connectedWallet.name);
    return await walletInterface.pay(request);
  }

  /**
   * Generate BRC-31 authentication headers for API requests
   */
  async generateAuthHeaders(body: string = ''): Promise<Record<string, string>> {
    if (!this.connectedWallet?.identityKey) {
      throw new Error('No identity key available');
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const message = body + nonce;

    // Sign with the connected wallet
    const signResponse = await this.signMessage({
      message,
      purpose: 'api_authentication',
    });

    return {
      'X-Identity-Key': this.connectedWallet.identityKey,
      'X-Nonce': nonce,
      'X-Signature': signResponse.signature,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get current wallet info
   */
  getWalletInfo(): BRC100WalletInfo | null {
    return this.connectedWallet;
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.connectedWallet !== null;
  }

  /**
   * Initialize session with backend
   */
  private async initializeSession(walletType: string): Promise<{ sessionId: string }> {
    const response = await fetch(`${this.config.apiUrl}/identity/wallet/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletType,
        capabilities: ['sign', 'pay', 'identity'],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize session: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Connect to specific wallet implementation
   */
  private async connectToWallet(walletType: string): Promise<BRC100WalletInfo> {
    const walletInterface = await this.getWalletInterface(walletType);
    return await walletInterface.connect();
  }

  /**
   * Verify connection with BRC-31 signature
   */
  private async verifyConnection(walletInfo: BRC100WalletInfo): Promise<void> {
    if (!this.sessionId || !walletInfo.identityKey) {
      throw new Error('Missing session ID or identity key for verification');
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const message = `wallet_verification:${this.sessionId}`;

    // Sign verification message
    const signResponse = await this.signMessage({
      message: message + nonce,
      purpose: 'connection_verification',
    });

    // Verify with backend
    const response = await fetch(`${this.config.apiUrl}/identity/wallet/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: this.sessionId,
        identityKey: walletInfo.identityKey,
        signature: signResponse.signature,
        nonce,
      }),
    });

    if (!response.ok) {
      throw new Error(`Connection verification failed: ${response.statusText}`);
    }
  }

  /**
   * Clean up session on backend
   */
  private async cleanupSession(): Promise<void> {
    if (!this.sessionId) return;

    await fetch(`${this.config.apiUrl}/identity/wallet/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: this.sessionId,
      }),
    });
  }

  /**
   * Get wallet-specific interface
   */
  private async getWalletInterface(walletType: string): Promise<WalletInterface> {
    switch (walletType.toLowerCase()) {
      case 'handcash':
        return new HandCashInterface();
      case 'centbee':
        return new CentbeeInterface();
      case 'relayx':
        return new RelayXInterface();
      case 'simply':
        return new SimplyInterface();
      case 'yours':
        return new YoursInterface();
      case 'metanet':
        return new MetaNetInterface();
      default:
        return new GenericBRC100Interface();
    }
  }
}

/**
 * Abstract wallet interface
 */
abstract class WalletInterface {
  abstract connect(): Promise<BRC100WalletInfo>;
  abstract sign(request: BRC100SignRequest): Promise<BRC100SignResponse>;
  abstract pay(request: BRC100PaymentRequest): Promise<BRC100PaymentResponse>;
}

/**
 * HandCash wallet implementation
 */
class HandCashInterface extends WalletInterface {
  async connect(): Promise<BRC100WalletInfo> {
    if (typeof window === 'undefined' || !(window as any).handcash) {
      throw new Error('HandCash wallet not available');
    }

    const handcash = (window as any).handcash;
    const result = await handcash.connect();

    return {
      name: 'HandCash',
      version: handcash.version || '1.0.0',
      capabilities: ['sign', 'pay', 'identity'],
      identityKey: result.publicKey,
      publicKey: result.publicKey,
      address: result.address,
    };
  }

  async sign(request: BRC100SignRequest): Promise<BRC100SignResponse> {
    const handcash = (window as any).handcash;
    const result = await handcash.sign({
      message: request.message,
      encoding: 'utf8',
    });

    return {
      signature: result.signature,
      publicKey: result.publicKey,
      algorithm: 'ECDSA',
    };
  }

  async pay(request: BRC100PaymentRequest): Promise<BRC100PaymentResponse> {
    const handcash = (window as any).handcash;
    const result = await handcash.pay({
      payments: request.outputs.map((output) => ({
        to: output.to,
        amount: output.amount,
        currency: 'BSV',
      })),
    });

    return {
      txid: result.txid,
      rawtx: result.rawtx,
      outputs: result.outputs || [],
    };
  }
}

/**
 * Centbee wallet implementation
 */
class CentbeeInterface extends WalletInterface {
  async connect(): Promise<BRC100WalletInfo> {
    if (typeof window === 'undefined' || !(window as any).centbee) {
      throw new Error('Centbee wallet not available');
    }

    const centbee = (window as any).centbee;
    const result = await centbee.connect();

    return {
      name: 'Centbee',
      version: '1.0.0',
      capabilities: ['sign', 'pay', 'identity'],
      identityKey: result.publicKey,
      publicKey: result.publicKey,
      address: result.address,
    };
  }

  async sign(request: BRC100SignRequest): Promise<BRC100SignResponse> {
    const centbee = (window as any).centbee;
    const result = await centbee.sign(request.message);

    return {
      signature: result.signature,
      publicKey: result.publicKey,
      algorithm: 'ECDSA',
    };
  }

  async pay(request: BRC100PaymentRequest): Promise<BRC100PaymentResponse> {
    const centbee = (window as any).centbee;
    const result = await centbee.pay(request);

    return {
      txid: result.txid,
      rawtx: result.rawtx,
      outputs: result.outputs || [],
    };
  }
}

/**
 * RelayX wallet implementation
 */
class RelayXInterface extends WalletInterface {
  async connect(): Promise<BRC100WalletInfo> {
    if (typeof window === 'undefined' || !(window as any).relayone) {
      throw new Error('RelayX wallet not available');
    }

    const relayone = (window as any).relayone;
    const result = await relayone.authBeta();

    return {
      name: 'RelayX',
      version: '1.0.0',
      capabilities: ['sign', 'pay', 'identity'],
      identityKey: result.publicKey,
      publicKey: result.publicKey,
      address: result.paymail,
    };
  }

  async sign(request: BRC100SignRequest): Promise<BRC100SignResponse> {
    const relayone = (window as any).relayone;
    const result = await relayone.sign(request.message);

    return {
      signature: result.signature,
      publicKey: result.publicKey,
      algorithm: 'ECDSA',
    };
  }

  async pay(request: BRC100PaymentRequest): Promise<BRC100PaymentResponse> {
    const relayone = (window as any).relayone;
    const result = await relayone.send(request);

    return {
      txid: result.txid,
      rawtx: result.rawTx,
      outputs: result.vout || [],
    };
  }
}

/**
 * Simply Cash wallet implementation
 */
class SimplyInterface extends WalletInterface {
  async connect(): Promise<BRC100WalletInfo> {
    if (typeof window === 'undefined' || !(window as any).simply) {
      throw new Error('Simply Cash wallet not available');
    }

    const simply = (window as any).simply;
    const result = await simply.connect();

    return {
      name: 'Simply Cash',
      version: '1.0.0',
      capabilities: ['sign', 'pay', 'identity'],
      identityKey: result.publicKey,
      publicKey: result.publicKey,
      address: result.address,
    };
  }

  async sign(request: BRC100SignRequest): Promise<BRC100SignResponse> {
    const simply = (window as any).simply;
    const result = await simply.sign(request.message);

    return {
      signature: result.signature,
      publicKey: result.publicKey,
      algorithm: 'ECDSA',
    };
  }

  async pay(request: BRC100PaymentRequest): Promise<BRC100PaymentResponse> {
    const simply = (window as any).simply;
    const result = await simply.pay(request);

    return {
      txid: result.txid,
      rawtx: result.rawtx,
      outputs: result.outputs || [],
    };
  }
}

/**
 * Yours Wallet implementation
 */
class YoursInterface extends WalletInterface {
  async connect(): Promise<BRC100WalletInfo> {
    if (typeof window === 'undefined' || !(window as any).yours) {
      throw new Error('Yours Wallet not available');
    }

    const yours = (window as any).yours;
    const result = await yours.connect();

    return {
      name: 'Yours Wallet',
      version: '1.0.0',
      capabilities: ['sign', 'pay', 'identity'],
      identityKey: result.publicKey,
      publicKey: result.publicKey,
      address: result.address,
    };
  }

  async sign(request: BRC100SignRequest): Promise<BRC100SignResponse> {
    const yours = (window as any).yours;
    const result = await yours.sign(request.message);

    return {
      signature: result.signature,
      publicKey: result.publicKey,
      algorithm: 'ECDSA',
    };
  }

  async pay(request: BRC100PaymentRequest): Promise<BRC100PaymentResponse> {
    const yours = (window as any).yours;
    const result = await yours.pay(request);

    return {
      txid: result.txid,
      rawtx: result.rawtx,
      outputs: result.outputs || [],
    };
  }
}

/**
 * MetaNet Desktop Wallet implementation
 */
class MetaNetInterface extends WalletInterface {
  async connect(): Promise<BRC100WalletInfo> {
    if (typeof window === 'undefined') {
      throw new Error('MetaNet Desktop Wallet not available - window object not found');
    }

    const w = window as any;
    const metanet = w.metanet || w.metaNet || w.MetaNet;

    if (!metanet) {
      throw new Error('MetaNet Desktop Wallet not available');
    }

    const result = await metanet.connect();

    return {
      name: 'MetaNet Desktop',
      version: metanet.version || '1.0.0',
      capabilities: ['sign', 'pay', 'identity'],
      identityKey: result.publicKey,
      publicKey: result.publicKey,
      address: result.address,
    };
  }

  async sign(request: BRC100SignRequest): Promise<BRC100SignResponse> {
    const w = window as any;
    const metanet = w.metanet || w.metaNet || w.MetaNet;

    const result = await metanet.sign({
      message: request.message,
      encoding: 'utf8',
    });

    return {
      signature: result.signature,
      publicKey: result.publicKey,
      algorithm: 'ECDSA',
    };
  }

  async pay(request: BRC100PaymentRequest): Promise<BRC100PaymentResponse> {
    const w = window as any;
    const metanet = w.metanet || w.metaNet || w.MetaNet;

    const result = await metanet.pay({
      outputs: request.outputs.map((output) => ({
        to: output.to,
        amount: output.amount,
        script: output.script,
      })),
      data: request.data,
    });

    return {
      txid: result.txid,
      rawtx: result.rawtx,
      outputs: result.outputs || [],
    };
  }
}

/**
 * Generic BRC-100 interface for unknown wallets
 */
class GenericBRC100Interface extends WalletInterface {
  async connect(): Promise<BRC100WalletInfo> {
    if (typeof window === 'undefined' || !(window as any).bsv?.wallet) {
      throw new Error('No BRC-100 compatible wallet found');
    }

    const wallet = (window as any).bsv.wallet;
    const result = await wallet.connect();

    return {
      name: result.name || 'Unknown Wallet',
      version: result.version || '1.0.0',
      capabilities: result.capabilities || ['sign', 'pay'],
      identityKey: result.publicKey,
      publicKey: result.publicKey,
      address: result.address,
    };
  }

  async sign(request: BRC100SignRequest): Promise<BRC100SignResponse> {
    const wallet = (window as any).bsv.wallet;
    const result = await wallet.sign(request);

    return {
      signature: result.signature,
      publicKey: result.publicKey,
      algorithm: result.algorithm || 'ECDSA',
    };
  }

  async pay(request: BRC100PaymentRequest): Promise<BRC100PaymentResponse> {
    const wallet = (window as any).bsv.wallet;
    const result = await wallet.pay(request);

    return {
      txid: result.txid,
      rawtx: result.rawtx,
      outputs: result.outputs || [],
    };
  }
}

export default BRC100WalletConnector;
