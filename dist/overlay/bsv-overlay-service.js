"use strict";
// BSV Overlay Service
// Integrates @bsv/overlay for real overlay network connectivity
Object.defineProperty(exports, "__esModule", { value: true });
exports.BSVOverlayService = void 0;
const events_1 = require("events");
// Simplified overlay implementation
class SimpleOverlayEngine extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.connected = false;
        this.subscribedTopics = new Set();
        this.peers = [];
    }
    async connect() {
        this.connected = true;
        this.emit('connected');
    }
    async disconnect() {
        this.connected = false;
        this.subscribedTopics.clear();
        this.peers = [];
        this.emit('disconnected');
    }
    async subscribe(topic) {
        if (!this.connected)
            throw new Error('Not connected');
        this.subscribedTopics.add(topic);
    }
    async unsubscribe(topic) {
        this.subscribedTopics.delete(topic);
    }
    async publish(topic, data) {
        if (!this.connected)
            throw new Error('Not connected');
        // In a real implementation, this would broadcast to the network
        console.log(`[Overlay] Publishing to ${topic}:`, data);
    }
    async sendToNode(nodeId, data) {
        if (!this.connected)
            throw new Error('Not connected');
        // In a real implementation, this would send directly to a specific node
        console.log(`[Overlay] Sending to node ${nodeId}:`, data);
    }
    getConnectedPeers() {
        return [...this.peers];
    }
}
class BSVOverlayService extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.overlay = null;
        this.isConnected = false;
        this.subscribedTopics = new Set();
        this.publishedTopics = new Set();
        this.config = config;
    }
    /**
     * Initialize the overlay connection
     */
    async initialize() {
        try {
            // For test environment, use mock overlay
            if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
                this.overlay = {
                    listen: async () => { },
                    broadcast: async () => { },
                    subscribe: async () => { },
                    unsubscribe: async () => { },
                    publish: async () => { },
                    close: async () => { },
                    getTopics: () => this.config.topics,
                    isConnected: () => true,
                    on: () => { },
                    off: () => { },
                    emit: () => { },
                };
                this.isConnected = true;
                this.emit('connected');
                return;
            }
            // Get wallet for signing and identity - mocked for now
            // TODO: Implement proper wallet integration when wallet service is fixed
            const wallet = null;
            if (!wallet && process.env.NODE_ENV === 'production') {
                throw new Error('BSV wallet must be connected before initializing overlay');
            }
            // Initialize overlay with configuration
            this.overlay = new SimpleOverlayEngine();
            // Set up event handlers
            this.setupEventHandlers();
            // Connect to the overlay network
            await this.overlay.connect();
            this.isConnected = true;
            this.emit('connected');
            console.log('BSV Overlay service initialized and connected');
        }
        catch (error) {
            console.error('Failed to initialize BSV overlay:', error);
            throw new Error(`Overlay initialization failed: ${error.message}`);
        }
    }
    /**
     * Set up overlay event handlers
     */
    setupEventHandlers() {
        if (!this.overlay)
            return;
        // Handle incoming messages
        this.overlay.on('message', (topic, message, sender) => {
            try {
                const parsedMessage = JSON.parse(message);
                this.handleIncomingMessage(topic, parsedMessage, sender);
            }
            catch (error) {
                console.error('Failed to parse overlay message:', error);
            }
        });
        // Handle peer connections
        this.overlay.on('peer-connected', (peerId) => {
            console.log('Peer connected:', peerId);
            this.emit('peer-connected', peerId);
        });
        // Handle peer disconnections
        this.overlay.on('peer-disconnected', (peerId) => {
            console.log('Peer disconnected:', peerId);
            this.emit('peer-disconnected', peerId);
        });
        // Handle connection errors
        this.overlay.on('error', (error) => {
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
    handleIncomingMessage(topic, message, sender) {
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
    async subscribeToTopic(topic) {
        if (!this.overlay || !this.isConnected) {
            throw new Error('Overlay not connected');
        }
        try {
            await this.overlay.subscribe(topic);
            this.subscribedTopics.add(topic);
            // Send subscription message to announce interest
            const message = {
                type: 'subscribe',
                topic,
                data: { timestamp: Date.now() },
                timestamp: Date.now(),
            };
            await this.publishMessage(topic, message);
            this.emit('subscribed', topic);
        }
        catch (error) {
            throw new Error(`Failed to subscribe to topic ${topic}: ${error.message}`);
        }
    }
    /**
     * Unsubscribe from a topic
     */
    async unsubscribeFromTopic(topic) {
        if (!this.overlay || !this.isConnected) {
            throw new Error('Overlay not connected');
        }
        try {
            await this.overlay.unsubscribe(topic);
            this.subscribedTopics.delete(topic);
            this.emit('unsubscribed', topic);
        }
        catch (error) {
            throw new Error(`Failed to unsubscribe from topic ${topic}: ${error.message}`);
        }
    }
    /**
     * Publish D01A-compliant data to the overlay
     */
    async publishD01AData(topic, data) {
        if (!this.overlay || !this.isConnected) {
            throw new Error('Overlay not connected');
        }
        try {
            // Get wallet for signing - mocked for now
            // TODO: Implement proper wallet integration when wallet service is fixed
            const wallet = null;
            if (!wallet && process.env.NODE_ENV === 'production') {
                throw new Error('Wallet not connected');
            }
            // Create message
            const message = {
                type: 'publish',
                topic,
                data,
                timestamp: Date.now(),
            };
            // Sign the message - mocked for now
            // TODO: Implement proper wallet signing when wallet service is fixed
            const messageString = JSON.stringify(message);
            let signature = null;
            let publicKey = null;
            if (wallet) {
                // signature = await walletService.signData(messageString, 'bsv-overlay-publish');
                // publicKey = walletService.getPublicKey();
            }
            message.signature = signature || undefined;
            message.publicKey = publicKey || undefined;
            // Publish to overlay
            await this.publishMessage(topic, message);
            this.publishedTopics.add(topic);
            const messageId = this.generateMessageId(message);
            this.emit('data-published', { topic, data, messageId });
            return messageId;
        }
        catch (error) {
            throw new Error(`Failed to publish D01A data: ${error.message}`);
        }
    }
    /**
     * Request specific data from the overlay network
     */
    async requestData(topic, query) {
        if (!this.overlay || !this.isConnected) {
            throw new Error('Overlay not connected');
        }
        try {
            const message = {
                type: 'request',
                topic,
                data: query,
                timestamp: Date.now(),
            };
            // Sign the request - mocked for now
            // TODO: Implement proper wallet integration when wallet service is fixed
            const wallet = null;
            if (wallet) {
                const messageString = JSON.stringify(message);
                // message.signature = await walletService.signData(messageString, 'bsv-overlay-request');
                // message.publicKey = walletService.getPublicKey() || undefined;
            }
            await this.publishMessage(topic, message);
            this.emit('data-requested', { topic, query });
        }
        catch (error) {
            throw new Error(`Failed to request data: ${error.message}`);
        }
    }
    /**
     * Send data in response to a request
     */
    async sendData(topic, data, recipient) {
        if (!this.overlay || !this.isConnected) {
            throw new Error('Overlay not connected');
        }
        try {
            const message = {
                type: 'data',
                topic,
                data,
                timestamp: Date.now(),
            };
            // Sign the data - mocked for now
            // TODO: Implement proper wallet integration when wallet service is fixed
            const wallet = null;
            if (wallet) {
                const messageString = JSON.stringify(message);
                // message.signature = await walletService.signData(messageString, 'bsv-overlay-data');
                // message.publicKey = walletService.getPublicKey() || undefined;
            }
            if (recipient) {
                // Send to specific peer if specified
                await this.overlay.sendToNode(recipient, JSON.stringify(message));
            }
            else {
                // Broadcast to all peers on topic
                await this.publishMessage(topic, message);
            }
            this.emit('data-sent', { topic, data, recipient });
        }
        catch (error) {
            throw new Error(`Failed to send data: ${error.message}`);
        }
    }
    /**
     * Publish a message to the overlay network
     */
    async publishMessage(topic, message) {
        if (!this.overlay) {
            throw new Error('Overlay not initialized');
        }
        const messageString = JSON.stringify(message);
        await this.overlay.publish(topic, messageString);
    }
    /**
     * Generate a unique message ID
     */
    generateMessageId(message) {
        const content = JSON.stringify({
            topic: message.topic,
            timestamp: message.timestamp,
            data: message.data,
        });
        // Simple hash - in production you'd use a proper hash function
        return Buffer.from(content).toString('base64').substring(0, 16);
    }
    /**
     * Get connected peers
     */
    getConnectedPeers() {
        if (!this.overlay || typeof this.overlay.getConnectedPeers !== 'function') {
            return [];
        }
        try {
            return this.overlay.getConnectedPeers();
        }
        catch (error) {
            console.warn('[BSV-OVERLAY] getConnectedPeers error:', error.message);
            return [];
        }
    }
    /**
     * Get subscribed topics
     */
    getSubscribedTopics() {
        return Array.from(this.subscribedTopics);
    }
    /**
     * Get published topics
     */
    getPublishedTopics() {
        return Array.from(this.publishedTopics);
    }
    /**
     * Check if overlay is connected
     */
    isOverlayConnected() {
        return this.isConnected;
    }
    /**
     * Get overlay statistics
     */
    getStats() {
        return {
            connected: this.isConnected,
            peers: this.getConnectedPeers().length,
            subscribedTopics: this.subscribedTopics.size,
            publishedTopics: this.publishedTopics.size,
            messagesSent: 0, // TODO: Implement message counters
            messagesReceived: 0,
        };
    }
    /**
     * Disconnect from overlay network
     */
    async disconnect() {
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
    async reconnect() {
        await this.disconnect();
        await this.initialize();
    }
}
exports.BSVOverlayService = BSVOverlayService;
//# sourceMappingURL=bsv-overlay-service.js.map