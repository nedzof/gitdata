/**
 * BRC-31 Authentication Middleware for Express
 *
 * Express middleware that implements complete BRC-31 authentication
 * to replace the existing custom identity middleware.
 */
import type { Request, Response, NextFunction } from 'express';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
import type { BRC31AuthenticationOptions, IdentityLevel } from './types';
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
interface BRC31MiddlewareConfig {
    database: DatabaseAdapter;
    serverPrivateKey?: string;
    enabled: boolean;
    requireForAll: boolean;
    defaultOptions: BRC31AuthenticationOptions;
    enableBackwardCompatibility: boolean;
    legacyHeaderSupport: boolean;
}
export declare class BRC31Middleware {
    private authService;
    private config;
    private initialized;
    constructor(config: Partial<BRC31MiddlewareConfig>);
    initialize(): Promise<void>;
    /**
     * Creates middleware that requires BRC-31 authentication
     */
    requireBRC31Identity(options?: Partial<BRC31AuthenticationOptions>): (req: BRC31Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Creates middleware that optionally uses BRC-31 authentication
     */
    optionalBRC31Identity(options?: Partial<BRC31AuthenticationOptions>): (req: BRC31Request, res: Response, next: NextFunction) => Promise<void>;
    private authenticateRequest;
    private hasBRC31Headers;
    private handleLegacyAuthentication;
    private addResponseSigning;
    private handleAuthenticationFailure;
    private handleError;
    private ensureInitialized;
    getIdentityStats(): Promise<any>;
    cleanupExpiredNonces(): Promise<number>;
}
/**
 * Initialize the global BRC-31 middleware instance
 */
export declare function initializeBRC31Middleware(config: Partial<BRC31MiddlewareConfig>): BRC31Middleware;
/**
 * Get the global BRC-31 middleware instance
 */
export declare function getBRC31Middleware(): BRC31Middleware;
/**
 * Factory function that creates BRC-31 authentication middleware
 * This can be used as a drop-in replacement for the existing requireIdentity middleware
 */
export declare function requireBRC31Identity(minLevel?: IdentityLevel): (req: BRC31Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Factory function that creates optional BRC-31 authentication middleware
 */
export declare function optionalBRC31Identity(minLevel?: IdentityLevel): (req: BRC31Request, res: Response, next: NextFunction) => Promise<void>;
export declare function isBRC31Request(req: Request): req is BRC31Request;
export declare function requiresBRC31Identity(req: BRC31Request): boolean;
export declare function getBRC31Identity(req: BRC31Request): {
    publicKey: string;
    level: IdentityLevel;
    certificates: any[];
    trustScore: number;
    verified: boolean;
} | undefined;
export declare function getBRC31TrustScore(req: BRC31Request): number;
export {};
