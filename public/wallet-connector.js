/**
 * BRC-100 Compatible Wallet Connector (Browser Version)
 *
 * This module provides a standardized interface for connecting to BRC-100 compatible wallets
 * and integrating with BRC-31 identity verification for the overlay network.
 */

export class BRC100WalletConnector {
  constructor(config) {
    this.config = {
      sessionTTL: 24 * 60 * 60 * 1000, // 24 hours
      autoReconnect: true,
      enabledWallets: ['handcash', 'centbee', 'relayx', 'simply', 'yours', 'metanet'],
      ...config
    };
    this.connectedWallet = null;
    this.sessionId = null;
    this.isConnecting = false;
    this.eventListeners = {};
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }

  /**
   * Detect available BRC-100 compatible wallets
   */
  async detectWallets() {
    const availableWallets = [];

    if (typeof window !== 'undefined') {
      const w = window;

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

    return availableWallets.filter(wallet =>
      this.config.enabledWallets?.includes(wallet)
    );
  }

  /**
   * Connect to a specific wallet
   */
  async connect(walletType) {
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
   * Sign a message with the connected wallet
   */
  async signMessage(request) {
    if (!this.connectedWallet) {
      throw new Error('No wallet connected');
    }

    const walletInterface = this.getWalletInterface(this.connectedWallet.name);
    return await walletInterface.sign(request);
  }

  /**
   * Generate BRC-31 authentication headers for API requests
   */
  async generateAuthHeaders(body = '') {
    if (!this.connectedWallet?.identityKey) {
      throw new Error('No identity key available');
    }

    const nonce = this.generateNonce();
    const message = body + nonce;

    // Sign with the connected wallet
    const signResponse = await this.signMessage({
      message,
      purpose: 'api_authentication'
    });

    return {
      'X-Identity-Key': this.connectedWallet.identityKey,
      'X-Nonce': nonce,
      'X-Signature': signResponse.signature,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get current wallet info
   */
  getWalletInfo() {
    return this.connectedWallet;
  }

  /**
   * Check if wallet is connected
   */
  isConnected() {
    return this.connectedWallet !== null;
  }

  /**
   * Generate a random nonce
   */
  generateNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Initialize session with backend
   */
  async initializeSession(walletType) {
    const response = await fetch(`${this.config.apiUrl}/identity/wallet/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletType,
        capabilities: ['sign', 'pay', 'identity']
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize session: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Connect to specific wallet implementation
   */
  async connectToWallet(walletType) {
    const walletInterface = this.getWalletInterface(walletType);
    return await walletInterface.connect();
  }

  /**
   * Verify connection with BRC-31 signature
   */
  async verifyConnection(walletInfo) {
    if (!this.sessionId || !walletInfo.identityKey) {
      throw new Error('Missing session ID or identity key for verification');
    }

    const nonce = this.generateNonce();
    const message = `wallet_verification:${this.sessionId}`;

    // Sign verification message
    const signResponse = await this.signMessage({
      message: message + nonce,
      purpose: 'connection_verification'
    });

    // Verify with backend
    const response = await fetch(`${this.config.apiUrl}/identity/wallet/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: this.sessionId,
        identityKey: walletInfo.identityKey,
        signature: signResponse.signature,
        nonce
      })
    });

    if (!response.ok) {
      throw new Error(`Connection verification failed: ${response.statusText}`);
    }
  }

  /**
   * Get wallet-specific interface
   */
  getWalletInterface(walletType) {
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
class WalletInterface {
  async connect() {
    throw new Error('connect method not implemented');
  }

  async sign(request) {
    throw new Error('sign method not implemented');
  }

  async pay(request) {
    throw new Error('pay method not implemented');
  }
}

/**
 * MetaNet Desktop Wallet implementation
 */
class MetaNetInterface extends WalletInterface {
  async connect() {
    if (typeof window === 'undefined') {
      throw new Error('MetaNet Desktop Wallet not available - window object not found');
    }

    const w = window;
    const metanet = w.metanet || w.metaNet || w.MetaNet;

    if (!metanet) {
      throw new Error('MetaNet Desktop Wallet not available. Please install and start MetaNet Desktop.');
    }

    const result = await metanet.connect();

    return {
      name: 'MetaNet Desktop',
      version: metanet.version || '1.0.0',
      capabilities: ['sign', 'pay', 'identity'],
      identityKey: result.publicKey,
      publicKey: result.publicKey,
      address: result.address
    };
  }

  async sign(request) {
    const w = window;
    const metanet = w.metanet || w.metaNet || w.MetaNet;

    const result = await metanet.sign({
      message: request.message,
      encoding: 'utf8'
    });

    return {
      signature: result.signature,
      publicKey: result.publicKey,
      algorithm: 'ECDSA'
    };
  }

  async pay(request) {
    const w = window;
    const metanet = w.metanet || w.metaNet || w.MetaNet;

    const result = await metanet.pay({
      outputs: request.outputs.map(output => ({
        to: output.to,
        amount: output.amount,
        script: output.script
      })),
      data: request.data
    });

    return {
      txid: result.txid,
      rawtx: result.rawtx,
      outputs: result.outputs || []
    };
  }
}

/**
 * HandCash wallet implementation
 */
class HandCashInterface extends WalletInterface {
  async connect() {
    if (typeof window === 'undefined' || !window.handcash) {
      throw new Error('HandCash wallet not available');
    }

    const handcash = window.handcash;
    const result = await handcash.connect();

    return {
      name: 'HandCash',
      version: handcash.version || '1.0.0',
      capabilities: ['sign', 'pay', 'identity'],
      identityKey: result.publicKey,
      publicKey: result.publicKey,
      address: result.address
    };
  }

  async sign(request) {
    const handcash = window.handcash;
    const result = await handcash.sign({
      message: request.message,
      encoding: 'utf8'
    });

    return {
      signature: result.signature,
      publicKey: result.publicKey,
      algorithm: 'ECDSA'
    };
  }

  async pay(request) {
    const handcash = window.handcash;
    const result = await handcash.pay({
      payments: request.outputs.map(output => ({
        to: output.to,
        amount: output.amount,
        currency: 'BSV'
      }))
    });

    return {
      txid: result.txid,
      rawtx: result.rawtx,
      outputs: result.outputs || []
    };
  }
}

/**
 * Generic BRC-100 interface implementation placeholders
 */
class CentbeeInterface extends WalletInterface {
  async connect() { throw new Error('Centbee interface not implemented'); }
  async sign() { throw new Error('Centbee interface not implemented'); }
  async pay() { throw new Error('Centbee interface not implemented'); }
}

class RelayXInterface extends WalletInterface {
  async connect() { throw new Error('RelayX interface not implemented'); }
  async sign() { throw new Error('RelayX interface not implemented'); }
  async pay() { throw new Error('RelayX interface not implemented'); }
}

class SimplyInterface extends WalletInterface {
  async connect() { throw new Error('Simply interface not implemented'); }
  async sign() { throw new Error('Simply interface not implemented'); }
  async pay() { throw new Error('Simply interface not implemented'); }
}

class YoursInterface extends WalletInterface {
  async connect() { throw new Error('Yours interface not implemented'); }
  async sign() { throw new Error('Yours interface not implemented'); }
  async pay() { throw new Error('Yours interface not implemented'); }
}

class GenericBRC100Interface extends WalletInterface {
  async connect() {
    if (typeof window === 'undefined' || !window.bsv?.wallet) {
      throw new Error('No BRC-100 compatible wallet found');
    }

    const wallet = window.bsv.wallet;
    const result = await wallet.connect();

    return {
      name: result.name || 'Unknown Wallet',
      version: result.version || '1.0.0',
      capabilities: result.capabilities || ['sign', 'pay'],
      identityKey: result.publicKey,
      publicKey: result.publicKey,
      address: result.address
    };
  }

  async sign(request) {
    const wallet = window.bsv.wallet;
    const result = await wallet.sign(request);

    return {
      signature: result.signature,
      publicKey: result.publicKey,
      algorithm: result.algorithm || 'ECDSA'
    };
  }

  async pay(request) {
    const wallet = window.bsv.wallet;
    const result = await wallet.pay(request);

    return {
      txid: result.txid,
      rawtx: result.rawtx,
      outputs: result.outputs || []
    };
  }
}

export default BRC100WalletConnector;