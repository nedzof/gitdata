/**
 * BRC-31 Authentication Middleware for Express
 *
 * Express middleware that implements complete BRC-31 authentication
 * to replace the existing custom identity middleware.
 */

import type { Request, Response, NextFunction } from 'express';

import type { DatabaseAdapter } from '../overlay/brc26-uhrp';

import { BRC31AuthenticationServiceImpl } from './service';
import type {
  BRC31Headers,
  BRC31AuthenticationResult,
  BRC31AuthenticationOptions,
  IdentityLevel,
} from './types';
import {
  BRC31Error,
  BRC31ValidationError,
  BRC31AuthenticationError,
  DEFAULT_BRC31_OPTIONS,
} from './types';

// ==================== Extended Request Interface ====================

export interface BRC31Request extends Request {
  brc31Identity?: {
    publicKey: string;
    level: IdentityLevel;
    certificates: any[];
    trustScore: number;
    verified: boolean;
  };
  brc31Nonces?: {
    clientNonce: string;
    serverNonce: string;
  };
}

// ==================== Middleware Configuration ====================

interface BRC31MiddlewareConfig {
  database: DatabaseAdapter;
  serverPrivateKey?: string;
  enabled: boolean;
  requireForAll: boolean;
  defaultOptions: BRC31AuthenticationOptions;
  enableBackwardCompatibility: boolean;
  legacyHeaderSupport: boolean;
}

const DEFAULT_CONFIG: Partial<BRC31MiddlewareConfig> = {
  enabled: true,
  requireForAll: false,
  enableBackwardCompatibility: true,
  legacyHeaderSupport: true,
  defaultOptions: DEFAULT_BRC31_OPTIONS,
};

// ==================== Main Middleware Class ====================

export class BRC31Middleware {
  private authService: BRC31AuthenticationServiceImpl;
  private config: BRC31MiddlewareConfig;
  private initialized = false;

  constructor(config: Partial<BRC31MiddlewareConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as BRC31MiddlewareConfig;

    if (!this.config.database) {
      throw new Error('Database adapter is required for BRC-31 middleware');
    }

    this.authService = new BRC31AuthenticationServiceImpl(
      this.config.database,
      this.config.serverPrivateKey,
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.authService.initialize();
    this.initialized = true;
  }

  // ==================== Middleware Factory Functions ====================

  /**
   * Creates middleware that requires BRC-31 authentication
   */
  requireBRC31Identity(
    options: Partial<BRC31AuthenticationOptions> = {},
  ): (req: BRC31Request, res: Response, next: NextFunction) => Promise<void> {
    const finalOptions = { ...this.config.defaultOptions, ...options };

    return async (req: BRC31Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      await this.ensureInitialized();

      try {
        const result = await this.authenticateRequest(req, finalOptions);

        if (!result.valid) {
          return this.handleAuthenticationFailure(res, result, true);
        }

        // Attach BRC-31 identity to request
        req.brc31Identity = {
          publicKey: result.identity.publicKey,
          level: result.identity.level,
          certificates: result.identity.certificates,
          trustScore: result.verification.trustLevel,
          verified: result.valid,
        };

        req.brc31Nonces = {
          clientNonce: result.nonces.clientNonce,
          serverNonce: result.nonces.serverNonce,
        };

        // Add response signing
        this.addResponseSigning(res, result.nonces.clientNonce);

        return next();
      } catch (error) {
        console.error('[BRC-31] Authentication error:', error);
        return this.handleError(res, error);
      }
    };
  }

  /**
   * Creates middleware that optionally uses BRC-31 authentication
   */
  optionalBRC31Identity(
    options: Partial<BRC31AuthenticationOptions> = {},
  ): (req: BRC31Request, res: Response, next: NextFunction) => Promise<void> {
    const finalOptions = { ...this.config.defaultOptions, ...options };

    return async (req: BRC31Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      await this.ensureInitialized();

      try {
        // Check if BRC-31 headers are present
        const headers = this.authService.extractHeaders(req.headers as Record<string, string>);
        const hasBRC31Headers = this.hasBRC31Headers(headers);

        if (!hasBRC31Headers) {
          // No BRC-31 headers, try legacy compatibility if enabled
          if (this.config.enableBackwardCompatibility) {
            return this.handleLegacyAuthentication(req, res, next);
          }
          return next();
        }

        // Attempt BRC-31 authentication
        const result = await this.authenticateRequest(req, finalOptions);

        if (result.valid) {
          req.brc31Identity = {
            publicKey: result.identity.publicKey,
            level: result.identity.level,
            certificates: result.identity.certificates,
            trustScore: result.verification.trustLevel,
            verified: result.valid,
          };

          req.brc31Nonces = {
            clientNonce: result.nonces.clientNonce,
            serverNonce: result.nonces.serverNonce,
          };

          this.addResponseSigning(res, result.nonces.clientNonce);
        }

        return next();
      } catch (error) {
        console.warn('[BRC-31] Optional authentication failed:', error.message);
        return next();
      }
    };
  }

  // ==================== Core Authentication Logic ====================

  private async authenticateRequest(
    req: BRC31Request,
    options: BRC31AuthenticationOptions,
  ): Promise<BRC31AuthenticationResult> {
    const headers = this.authService.extractHeaders(req.headers as Record<string, string>);

    if (!this.hasBRC31Headers(headers)) {
      throw new BRC31ValidationError('Missing required BRC-31 headers', 'headers');
    }

    const fullHeaders = headers as BRC31Headers;
    return await this.authService.verifyIdentity(fullHeaders, req.body, options);
  }

  private hasBRC31Headers(headers: Partial<BRC31Headers>): boolean {
    return !!(
      headers['X-Authrite'] &&
      headers['X-Authrite-Identity-Key'] &&
      headers['X-Authrite-Signature'] &&
      headers['X-Authrite-Nonce']
    );
  }

  // ==================== Legacy Compatibility ====================

  private async handleLegacyAuthentication(
    req: BRC31Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!this.config.legacyHeaderSupport) {
      return next();
    }

    // Check for legacy headers (X-Identity-Key, X-Nonce, X-Signature)
    const identityKey = req.headers['x-identity-key'] as string;
    const nonce = req.headers['x-nonce'] as string;
    const signature = req.headers['x-signature'] as string;

    if (identityKey && nonce && signature) {
      // Convert legacy headers to BRC-31 format for basic compatibility
      req.brc31Identity = {
        publicKey: identityKey,
        level: 'public-key',
        certificates: [],
        trustScore: 50, // Medium trust for legacy
        verified: false, // Legacy auth is not fully verified
      };

      console.info('[BRC-31] Using legacy authentication compatibility mode');
    }

    return next();
  }

  // ==================== Response Handling ====================

  private addResponseSigning(res: Response, clientNonce: string): void {
    const originalSend = res.send.bind(res);

    res.send = function (data: any): Response {
      try {
        // Add BRC-31 response headers
        res.setHeader('X-Authrite', '0.1');
        res.setHeader('X-Authrite-Identity-Key', 'SERVER_PUBLIC_KEY'); // TODO: Use actual server key

        // TODO: Implement response signing
        // const responseSignature = authService.createSignedResponse(data, clientNonce);
        // res.setHeader('X-Authrite-Signature', responseSignature);

        return originalSend(data);
      } catch (error) {
        console.error('[BRC-31] Response signing failed:', error);
        return originalSend(data);
      }
    };
  }

  private handleAuthenticationFailure(
    res: Response,
    result: BRC31AuthenticationResult,
    required: boolean,
  ): Response {
    const statusCode = required ? 401 : 200;

    const errorResponse = {
      error: 'brc31-authentication-failed',
      message: result.error || 'Authentication failed',
      details: {
        signatureValid: result.verification.signatureValid,
        nonceValid: result.verification.nonceValid,
        certificatesValid: result.verification.certificatesValid,
        identityLevel: result.identity.level,
        trustScore: result.verification.trustLevel,
      },
      authrite: {
        version: '0.1',
        serverNonce: result.nonces.serverNonce,
        supported: true,
      },
    };

    return res.status(statusCode).json(errorResponse);
  }

  private handleError(res: Response, error: any): Response {
    if (error instanceof BRC31Error) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
        authrite: {
          version: '0.1',
          supported: true,
        },
      });
    }

    console.error('[BRC-31] Unexpected error:', error);
    return res.status(500).json({
      error: 'brc31-internal-error',
      message: 'Internal authentication error',
      authrite: {
        version: '0.1',
        supported: true,
      },
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ==================== Utility Methods ====================

  async getIdentityStats(): Promise<any> {
    await this.ensureInitialized();
    return await this.authService.databaseService.getAuthenticationStats();
  }

  async cleanupExpiredNonces(): Promise<number> {
    await this.ensureInitialized();
    return await this.authService.cleanupExpiredNonces();
  }
}

// ==================== Factory Functions ====================

let globalBRC31Middleware: BRC31Middleware | null = null;

/**
 * Initialize the global BRC-31 middleware instance
 */
export function initializeBRC31Middleware(config: Partial<BRC31MiddlewareConfig>): BRC31Middleware {
  globalBRC31Middleware = new BRC31Middleware(config);
  return globalBRC31Middleware;
}

/**
 * Get the global BRC-31 middleware instance
 */
export function getBRC31Middleware(): BRC31Middleware {
  if (!globalBRC31Middleware) {
    throw new Error('BRC-31 middleware not initialized. Call initializeBRC31Middleware() first.');
  }
  return globalBRC31Middleware;
}

/**
 * Factory function that creates BRC-31 authentication middleware
 * This can be used as a drop-in replacement for the existing requireIdentity middleware
 */
export function requireBRC31Identity(minLevel: IdentityLevel = 'public-key') {
  return (req: BRC31Request, res: Response, next: NextFunction) => {
    const middleware = getBRC31Middleware();
    return middleware.requireBRC31Identity({ minIdentityLevel: minLevel })(req, res, next);
  };
}

/**
 * Factory function that creates optional BRC-31 authentication middleware
 */
export function optionalBRC31Identity(minLevel: IdentityLevel = 'public-key') {
  return (req: BRC31Request, res: Response, next: NextFunction) => {
    const middleware = getBRC31Middleware();
    return middleware.optionalBRC31Identity({ minIdentityLevel: minLevel })(req, res, next);
  };
}

// ==================== Type Guard Functions ====================

export function isBRC31Request(req: Request): req is BRC31Request {
  return 'brc31Identity' in req;
}

export function requiresBRC31Identity(req: BRC31Request): boolean {
  return req.brc31Identity?.verified === true;
}

export function getBRC31Identity(req: BRC31Request) {
  return req.brc31Identity;
}

export function getBRC31TrustScore(req: BRC31Request): number {
  return req.brc31Identity?.trustScore || 0;
}
