import type { Wallet, WalletConnection } from './brc100-types';
declare global {
    interface Window {
        bsv?: {
            wallet?: Wallet;
        };
        wallet?: Wallet;
        metanet?: Wallet;
        metaNet?: Wallet;
        MetaNet?: Wallet;
        [key: string]: any;
    }
}
declare class WalletService {
    private walletConnection;
    private connectionListeners;
    /**
     * Detects if a BRC-100 compatible wallet is available
     */
    detectWallet(): Promise<Wallet | null>;
    /**
     * Connects to the detected wallet and establishes a session
     */
    connect(): Promise<WalletConnection>;
    /**
     * Disconnects from the current wallet
     */
    disconnect(): Promise<void>;
    /**
     * Gets the current wallet connection
     */
    getConnection(): WalletConnection | null;
    /**
     * Checks if wallet is currently connected
     */
    isConnected(): boolean;
    /**
     * Gets the connected wallet instance
     */
    getWallet(): Wallet | null;
    /**
     * Gets the public key of the connected wallet
     */
    getPublicKey(): string | null;
    /**
     * Authenticates user by getting their identity public key
     */
    authenticate(): Promise<{
        publicKey: string;
        address?: string;
    }>;
    /**
     * Creates a transaction for purchasing data
     */
    createPurchaseTransaction(args: {
        description: string;
        recipientScript: string;
        amount: number;
        versionId: string;
    }): Promise<{
        txid?: string;
        tx?: string;
        reference?: string;
    }>;
    /**
     * Signs a previously created action
     */
    signAction(args: {
        spends: Record<number, {
            unlockingScript: string;
            sequenceNumber?: number;
        }>;
        reference: string;
        options?: any;
    }): Promise<any>;
    /**
     * Aborts a previously created action
     */
    abortAction(reference: string): Promise<{
        aborted: boolean;
    }>;
    /**
     * Internalizes an action by accepting incoming transactions
     */
    internalizeAction(args: {
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
    }): Promise<{
        accepted: boolean;
    }>;
    /**
     * Relinquishes an output from a basket
     */
    relinquishOutput(basket: string, output: string): Promise<{
        relinquished: boolean;
    }>;
    /**
     * Reveals counterparty key linkage information
     */
    revealCounterpartyKeyLinkage(args: {
        counterparty: string;
        verifier: string;
        privilegedReason?: string;
    }): Promise<any>;
    /**
     * Reveals specific key linkage information
     */
    revealSpecificKeyLinkage(args: {
        counterparty: string;
        verifier: string;
        protocolID: [0 | 1 | 2, string];
        keyID: string;
        privilegedReason?: string;
    }): Promise<any>;
    /**
     * Creates an HMAC for message authentication
     */
    createHmac(args: {
        data: string;
        protocolID: [0 | 1 | 2, string];
        keyID: string;
        privilegedReason?: string;
        counterparty?: 'self' | 'anyone' | string;
        privileged?: boolean;
    }): Promise<{
        hmac: string;
    }>;
    /**
     * Verifies an HMAC for message authentication
     */
    verifyHmac(args: {
        data: string;
        hmac: string;
        protocolID: [0 | 1 | 2, string];
        keyID: string;
        privilegedReason?: string;
        counterparty?: 'self' | 'anyone' | string;
        privileged?: boolean;
    }): Promise<{
        valid: boolean;
    }>;
    /**
     * Verifies a digital signature
     */
    verifySignature(args: {
        data?: string;
        hashToDirectlyVerify?: string;
        signature: string;
        protocolID: [0 | 1 | 2, string];
        keyID: string;
        privilegedReason?: string;
        counterparty?: 'self' | 'anyone' | string;
        privileged?: boolean;
        forSelf?: boolean;
    }): Promise<{
        valid: boolean;
    }>;
    /**
     * Acquires a certificate for proving key ownership
     */
    acquireCertificate(args: {
        type: string;
        certifier: string;
        acquisitionProtocol: string;
        fields: Record<string, string>;
        serialNumber?: string;
        revocationOutpoint?: string;
        signature?: string;
        privilegedReason?: string;
    }): Promise<any>;
    /**
     * Lists certificates held by the wallet
     */
    listCertificates(args: {
        certifiers: string[];
        types: string[];
        limit?: number;
        offset?: number;
        privileged?: boolean;
        privilegedReason?: string;
    }): Promise<any>;
    /**
     * Proves ownership of a certificate
     */
    proveCertificate(args: {
        certificate: any;
        fieldsToReveal: string[];
        verifier: string;
        privilegedReason?: string;
    }): Promise<any>;
    /**
     * Relinquishes a certificate from the wallet
     */
    relinquishCertificate(args: {
        type: string;
        serialNumber: string;
        certifier: string;
    }): Promise<{
        relinquished: boolean;
    }>;
    /**
     * Discovers certificates by identity key
     */
    discoverByIdentityKey(args: {
        identityKey: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    /**
     * Discovers certificates by their attributes
     */
    discoverByAttributes(args: {
        attributes: Record<string, string>;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    /**
     * Lists user's purchase history
     */
    getPurchaseHistory(): Promise<any[]>;
    /**
     * Lists available UTXOs for spending
     */
    getAvailableBalance(): Promise<{
        balance: number;
        outputs: any[];
    }>;
    /**
     * Generates BRC-31 authentication headers for API requests
     */
    generateAuthHeaders(body?: string): Promise<Record<string, string>>;
    /**
     * Signs arbitrary data for verification
     */
    signData(data: string, protocolID?: string): Promise<string>;
    /**
     * Encrypts data using wallet's encryption capabilities
     */
    encryptData(data: string, protocolID?: string): Promise<string>;
    /**
     * Decrypts data using wallet's decryption capabilities
     */
    decryptData(ciphertext: string, protocolID?: string): Promise<string>;
    /**
     * Gets wallet version and implementation info
     */
    getWalletInfo(): Promise<{
        version: string;
        implementation: string;
    } | null>;
    /**
     * Checks if the user is currently authenticated with the wallet
     */
    isAuthenticated(): Promise<boolean>;
    /**
     * Waits for user authentication to complete
     */
    waitForAuthentication(): Promise<boolean>;
    /**
     * Gets the current blockchain height
     */
    getHeight(): Promise<number>;
    /**
     * Gets the block header for a specific height
     */
    getHeaderForHeight(height: number): Promise<{
        height: number;
        hash: string;
        version: number;
        previousHash: string;
        merkleRoot: string;
        time: number;
        bits: number;
        nonce: number;
    }>;
    /**
     * Gets the current network type
     */
    getNetwork(): Promise<'mainnet' | 'testnet' | 'regtest'>;
    /**
     * Gets the wallet version (enhanced implementation)
     */
    getVersion(): Promise<{
        version: string;
        implementation: string;
    }>;
    /**
     * Registers a listener for connection state changes
     */
    onConnectionChange(listener: (connected: boolean) => void): () => void;
    /**
     * Authenticates with the backend BRC-31 identity system
     */
    private authenticateWithBackend;
    /**
     * Detects the wallet type for backend registration
     */
    private detectWalletType;
    /**
     * Generates a random nonce for authentication
     */
    private generateNonce;
    /**
     * Notifies all listeners of connection state changes
     */
    private notifyConnectionChange;
    /**
     * Validates that a wallet implements all 28 required BRC-100 methods
     */
    validateWallet(wallet: Wallet): Promise<boolean>;
}
export declare const walletService: WalletService;
export declare function connectWallet(): Promise<WalletConnection>;
export declare function disconnectWallet(): Promise<void>;
export declare function isWalletConnected(): boolean;
export declare function getConnectedWallet(): Wallet | null;
export declare function getWalletPublicKey(): string | null;
export declare function generateAuthHeaders(body?: string): Promise<Record<string, string>>;
export type { Wallet, WalletConnection, WalletError } from './brc100-types';
