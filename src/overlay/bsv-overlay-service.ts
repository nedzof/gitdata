// BSV Overlay Service
// Integrates @bsv/overlay for real overlay network connectivity

import { Overlay } from '@bsv/overlay';
import { walletService } from '../../ui/src/lib/wallet';
import type { Wallet } from '../../ui/src/lib/brc100-types';
import { EventEmitter } from 'events';

export interface OverlayConfig {
  topics: string[];
  advertiseTopics: string[];
  peerDiscovery: {
    lookupServices: string[];
    timeout: number;
  };
  nodeIdentity?: {
    privateKey?: string;
    publicKey?: string;
  };
  network: 'mainnet' | 'testnet' | 'regtest';
}

export interface D01AData {
  manifest: {
    datasetId: string;
    description: string;
    provenance: {
      createdAt: string;
      issuer: string;
    };
    policy: {
      license: string;
      classification: string;
    };
    content: {
      contentHash: string;
      mediaType: string;
      sizeBytes: number;
      url: string;
    };
    parents: string[];
    tags: string[];
  };
}

export interface OverlayMessage {
  type: 'publish' | 'subscribe' | 'data' | 'request';
  topic: string;
  data: any;
  timestamp: number;
  signature?: string;
  publicKey?: string;
}

class BSVOverlayService extends EventEmitter {
  private overlay: Overlay | null = null;
  private config: OverlayConfig;
  private isConnected: boolean = false;
  private subscribedTopics: Set<string> = new Set();
  private publishedTopics: Set<string> = new Set();

  constructor(config: OverlayConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize the overlay connection
   */
  async initialize(): Promise<void> {
    try {
      // Get wallet for signing and identity
      const wallet = walletService.getWallet();
      if (!wallet) {
        throw new Error('BSV wallet must be connected before initializing overlay');
      }

      // Initialize overlay with configuration
      this.overlay = new Overlay({
        // Topics we want to listen to
        topics: this.config.topics,

        // Topics we want to advertise
        advertiseTopics: this.config.advertiseTopics,

        // Peer discovery configuration
        peerDiscovery: this.config.peerDiscovery,

        // Node identity (will be generated if not provided)
        nodeIdentity: this.config.nodeIdentity
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Connect to the overlay network
      await this.overlay.connect();
      this.isConnected = true;

      this.emit('connected');
      console.log('BSV Overlay service initialized and connected');

    } catch (error) {
      console.error('Failed to initialize BSV overlay:', error);
      throw new Error(`Overlay initialization failed: ${error.message}`);
    }
  }

  /**
   * Set up overlay event handlers
   */
  private setupEventHandlers(): void {
    if (!this.overlay) return;

    // Handle incoming messages
    this.overlay.on('message', (topic: string, message: any, sender: string) => {
      try {
        const parsedMessage: OverlayMessage = JSON.parse(message);
        this.handleIncomingMessage(topic, parsedMessage, sender);
      } catch (error) {
        console.error('Failed to parse overlay message:', error);
      }
    });

    // Handle peer connections
    this.overlay.on('peer-connected', (peerId: string) => {
      console.log('Peer connected:', peerId);
      this.emit('peer-connected', peerId);
    });

    // Handle peer disconnections
    this.overlay.on('peer-disconnected', (peerId: string) => {
      console.log('Peer disconnected:', peerId);
      this.emit('peer-disconnected', peerId);
    });

    // Handle connection errors
    this.overlay.on('error', (error: Error) => {
      console.error('Overlay error:', error);
      this.emit('error', error);
    });

    // Handle disconnection
    this.overlay.on('disconnected', () => {
      this.isConnected = false;
      this.emit('disconnected');
    });
  }

  /**
   * Handle incoming overlay messages
   */
  private handleIncomingMessage(topic: string, message: OverlayMessage, sender: string): void {
    // Verify message signature if present
    if (message.signature && message.publicKey) {
      // TODO: Implement signature verification using BSV SDK
      // For now, we'll trust the message
    }

    switch (message.type) {
      case 'publish':
        this.emit('data-published', { topic, data: message.data, sender });
        break;
      case 'subscribe':
        this.emit('subscription-request', { topic, sender });
        break;
      case 'data':
        this.emit('data-received', { topic, data: message.data, sender });
        break;
      case 'request':
        this.emit('data-request', { topic, data: message.data, sender });
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Subscribe to a topic for receiving data
   */
  async subscribeToTopic(topic: string): Promise<void> {
    if (!this.overlay || !this.isConnected) {
      throw new Error('Overlay not connected');
    }

    try {
      await this.overlay.subscribe(topic);
      this.subscribedTopics.add(topic);

      // Send subscription message to announce interest
      const message: OverlayMessage = {
        type: 'subscribe',
        topic,
        data: { timestamp: Date.now() },
        timestamp: Date.now()
      };

      await this.publishMessage(topic, message);
      this.emit('subscribed', topic);

    } catch (error) {
      throw new Error(`Failed to subscribe to topic ${topic}: ${error.message}`);
    }
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribeFromTopic(topic: string): Promise<void> {
    if (!this.overlay || !this.isConnected) {
      throw new Error('Overlay not connected');
    }

    try {
      await this.overlay.unsubscribe(topic);
      this.subscribedTopics.delete(topic);
      this.emit('unsubscribed', topic);

    } catch (error) {
      throw new Error(`Failed to unsubscribe from topic ${topic}: ${error.message}`);
    }
  }

  /**
   * Publish D01A-compliant data to the overlay
   */
  async publishD01AData(topic: string, data: D01AData): Promise<string> {
    if (!this.overlay || !this.isConnected) {
      throw new Error('Overlay not connected');
    }

    try {
      // Get wallet for signing
      const wallet = walletService.getWallet();
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      // Create message
      const message: OverlayMessage = {
        type: 'publish',
        topic,
        data,
        timestamp: Date.now()
      };

      // Sign the message
      const messageString = JSON.stringify(message);
      const signature = await walletService.signData(messageString, 'bsv-overlay-publish');
      const publicKey = walletService.getPublicKey();

      message.signature = signature;
      message.publicKey = publicKey || undefined;

      // Publish to overlay
      await this.publishMessage(topic, message);
      this.publishedTopics.add(topic);

      const messageId = this.generateMessageId(message);
      this.emit('data-published', { topic, data, messageId });

      return messageId;

    } catch (error) {
      throw new Error(`Failed to publish D01A data: ${error.message}`);
    }
  }

  /**
   * Request specific data from the overlay network
   */
  async requestData(topic: string, query: any): Promise<void> {
    if (!this.overlay || !this.isConnected) {
      throw new Error('Overlay not connected');
    }

    try {
      const message: OverlayMessage = {
        type: 'request',
        topic,
        data: query,
        timestamp: Date.now()
      };

      // Sign the request
      const wallet = walletService.getWallet();
      if (wallet) {
        const messageString = JSON.stringify(message);
        message.signature = await walletService.signData(messageString, 'bsv-overlay-request');
        message.publicKey = walletService.getPublicKey() || undefined;
      }

      await this.publishMessage(topic, message);
      this.emit('data-requested', { topic, query });

    } catch (error) {
      throw new Error(`Failed to request data: ${error.message}`);
    }
  }

  /**
   * Send data in response to a request
   */
  async sendData(topic: string, data: any, recipient?: string): Promise<void> {
    if (!this.overlay || !this.isConnected) {
      throw new Error('Overlay not connected');
    }

    try {
      const message: OverlayMessage = {
        type: 'data',
        topic,
        data,
        timestamp: Date.now()
      };

      // Sign the data
      const wallet = walletService.getWallet();
      if (wallet) {
        const messageString = JSON.stringify(message);
        message.signature = await walletService.signData(messageString, 'bsv-overlay-data');
        message.publicKey = walletService.getPublicKey() || undefined;
      }

      if (recipient) {
        // Send to specific peer if specified
        await this.overlay.sendToNode(recipient, JSON.stringify(message));
      } else {
        // Broadcast to all peers on topic
        await this.publishMessage(topic, message);
      }

      this.emit('data-sent', { topic, data, recipient });

    } catch (error) {
      throw new Error(`Failed to send data: ${error.message}`);
    }
  }

  /**
   * Publish a message to the overlay network
   */
  private async publishMessage(topic: string, message: OverlayMessage): Promise<void> {
    if (!this.overlay) {
      throw new Error('Overlay not initialized');
    }

    const messageString = JSON.stringify(message);
    await this.overlay.publish(topic, messageString);
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(message: OverlayMessage): string {
    const content = JSON.stringify({ topic: message.topic, timestamp: message.timestamp, data: message.data });
    // Simple hash - in production you'd use a proper hash function
    return Buffer.from(content).toString('base64').substring(0, 16);
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): string[] {
    if (!this.overlay) {
      return [];
    }
    return this.overlay.getConnectedPeers();
  }

  /**
   * Get subscribed topics
   */
  getSubscribedTopics(): string[] {
    return Array.from(this.subscribedTopics);
  }

  /**
   * Get published topics
   */
  getPublishedTopics(): string[] {
    return Array.from(this.publishedTopics);
  }

  /**
   * Check if overlay is connected
   */
  isOverlayConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get overlay statistics
   */
  getStats(): {
    connected: boolean;
    peers: number;
    subscribedTopics: number;
    publishedTopics: number;
    messagesSent: number;
    messagesReceived: number;
  } {
    return {
      connected: this.isConnected,
      peers: this.getConnectedPeers().length,
      subscribedTopics: this.subscribedTopics.size,
      publishedTopics: this.publishedTopics.size,
      messagesSent: 0, // TODO: Implement message counters
      messagesReceived: 0
    };
  }

  /**
   * Disconnect from overlay network
   */
  async disconnect(): Promise<void> {
    if (this.overlay) {
      await this.overlay.disconnect();
      this.overlay = null;
      this.isConnected = false;
      this.subscribedTopics.clear();
      this.publishedTopics.clear();
      this.emit('disconnected');
    }
  }

  /**
   * Reconnect to overlay network
   */
  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.initialize();
  }
}

export { BSVOverlayService };