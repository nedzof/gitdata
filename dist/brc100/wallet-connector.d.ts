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
import { EventEmitter } from 'events';
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
export declare class BRC100WalletConnector extends EventEmitter {
    private config;
    private connectedWallet;
    private sessionId;
    private isConnecting;
    constructor(config: WalletConnectionConfig);
    /**
     * Detect available BRC-100 compatible wallets
     */
    detectWallets(): Promise<string[]>;
    /**
     * Connect to a specific wallet
     */
    connect(walletType: string): Promise<BRC100WalletInfo>;
    /**
     * Disconnect from the current wallet
     */
    disconnect(): Promise<void>;
    /**
     * Sign a message with the connected wallet
     */
    signMessage(request: BRC100SignRequest): Promise<BRC100SignResponse>;
    /**
     * Send a payment with the connected wallet
     */
    sendPayment(request: BRC100PaymentRequest): Promise<BRC100PaymentResponse>;
    /**
     * Generate BRC-31 authentication headers for API requests
     */
    generateAuthHeaders(body?: string): Promise<Record<string, string>>;
    /**
     * Get current wallet info
     */
    getWalletInfo(): BRC100WalletInfo | null;
    /**
     * Check if wallet is connected
     */
    isConnected(): boolean;
    /**
     * Initialize session with backend
     */
    private initializeSession;
    /**
     * Connect to specific wallet implementation
     */
    private connectToWallet;
    /**
     * Verify connection with BRC-31 signature
     */
    private verifyConnection;
    /**
     * Clean up session on backend
     */
    private cleanupSession;
    /**
     * Get wallet-specific interface
     */
    private getWalletInterface;
}
export default BRC100WalletConnector;
