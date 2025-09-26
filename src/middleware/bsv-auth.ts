/**
 * BSV Authentication Middleware for Gitdata
 * Based on CoolCert implementation pattern
 */
import { WalletInterface } from '@bsv/sdk';
import { createAuthMiddleware, AuthMiddlewareOptions } from '@bsv/auth-express-middleware';
import { createPaymentMiddleware } from '@bsv/payment-express-middleware';
import { Request, Response, NextFunction } from 'express';

export interface BSVAuthConfig {
  wallet: WalletInterface;
  enabled?: boolean;
  monetize?: boolean;
  calculateRequestPrice?: (req: Request) => number | Promise<number>;
}

export class BSVAuthService {
  private wallet: WalletInterface;
  private enabled: boolean;
  private monetize: boolean;
  private calculateRequestPrice?: (req: Request) => number | Promise<number>;

  constructor(config: BSVAuthConfig) {
    this.wallet = config.wallet;
    this.enabled = config.enabled !== false; // Default to enabled
    this.monetize = config.monetize || false;
    this.calculateRequestPrice = config.calculateRequestPrice;
  }

  /**
   * Get BSV authentication middleware following CoolCert pattern
   */
  getAuthMiddleware() {
    if (!this.enabled) {
      // Return pass-through middleware if BSV auth is disabled
      return (req: Request, res: Response, next: NextFunction) => {
        next();
      };
    }

    return createAuthMiddleware({
      wallet: this.wallet
    });
  }

  /**
   * Get BSV payment middleware if monetization is enabled
   */
  getPaymentMiddleware() {
    if (!this.enabled || !this.monetize) {
      // Return pass-through middleware if disabled
      return (req: Request, res: Response, next: NextFunction) => {
        next();
      };
    }

    return createPaymentMiddleware({
      wallet: this.wallet,
      calculateRequestPrice: this.calculateRequestPrice || (() => 0)
    });
  }

  /**
   * Get wallet instance
   */
  getWallet(): WalletInterface {
    return this.wallet;
  }

  /**
   * Check if authentication is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Validate certificate signing request arguments
   * Following CoolCert pattern
   */
  validateCertificateSigningRequest(args: {
    clientNonce: string;
    type: string;
    fields: Record<string, string>;
    masterKeyring: Record<string, string>
  }): void {
    if (!args.clientNonce) {
      throw new Error('Missing client nonce!');
    }
    if (!args.type) {
      throw new Error('Missing certificate type!');
    }
    if (!args.fields) {
      throw new Error('Missing certificate fields to sign!');
    }
    if (!args.masterKeyring) {
      throw new Error('Missing masterKeyring to decrypt fields!');
    }
  }
}

// Export singleton instance for server-wide use
let bsvAuthService: BSVAuthService | null = null;

export function initializeBSVAuth(config: BSVAuthConfig): BSVAuthService {
  bsvAuthService = new BSVAuthService(config);
  return bsvAuthService;
}

export function getBSVAuth(): BSVAuthService | null {
  return bsvAuthService;
}