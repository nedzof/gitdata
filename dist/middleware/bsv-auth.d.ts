/**
 * BSV Authentication Middleware for Gitdata
 * Based on CoolCert implementation pattern
 */
import { WalletInterface } from '@bsv/sdk';
import { Request, Response, NextFunction } from 'express';
export interface BSVAuthConfig {
    wallet: WalletInterface;
    enabled?: boolean;
    monetize?: boolean;
    calculateRequestPrice?: (req: Request) => number | Promise<number>;
}
export declare class BSVAuthService {
    private wallet;
    private enabled;
    private monetize;
    private calculateRequestPrice?;
    constructor(config: BSVAuthConfig);
    /**
     * Get BSV authentication middleware following CoolCert pattern
     */
    getAuthMiddleware(): (req: import("@bsv/auth-express-middleware").AuthRequest, res: Response, next: NextFunction) => void;
    /**
     * Get BSV payment middleware if monetization is enabled
     */
    getPaymentMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Get wallet instance
     */
    getWallet(): WalletInterface;
    /**
     * Check if authentication is enabled
     */
    isEnabled(): boolean;
    /**
     * Validate certificate signing request arguments
     * Following CoolCert pattern
     */
    validateCertificateSigningRequest(args: {
        clientNonce: string;
        type: string;
        fields: Record<string, string>;
        masterKeyring: Record<string, string>;
    }): void;
}
export declare function initializeBSVAuth(config: BSVAuthConfig): BSVAuthService;
export declare function getBSVAuth(): BSVAuthService | null;
