/**
 * BRC-31 Database Service with Type-Safe SQL Queries
 *
 * This module provides database operations for BRC-31 identity tracking
 * using only TypeScript query builders, no raw SQL.
 */
import type { DatabaseAdapter } from '../overlay/brc26-uhrp';
import type { BRC31IdentityRecord, BRC31NonceRecord, BRC31Certificate, IdentityLevel, BRC31AuthenticationResult } from './types';
export declare class BRC31DatabaseService {
    private database;
    constructor(database: DatabaseAdapter);
    initializeSchema(): Promise<void>;
    storeIdentity(identity: {
        publicKey: string;
        certificates: BRC31Certificate[];
        level: IdentityLevel;
        trustMetrics: any;
    }): Promise<void>;
    getIdentity(publicKey: string): Promise<BRC31IdentityRecord | null>;
    updateIdentityReputation(publicKey: string, success: boolean): Promise<void>;
    getIdentitiesByLevel(level: IdentityLevel, limit?: number): Promise<BRC31IdentityRecord[]>;
    storeNonce(nonce: string, identityKey: string, expiresAt: Date, purpose: 'client' | 'server'): Promise<void>;
    validateAndConsumeNonce(nonce: string, identityKey: string): Promise<boolean>;
    cleanupExpiredNonces(): Promise<number>;
    getNoncesByIdentity(identityKey: string, limit?: number): Promise<BRC31NonceRecord[]>;
    getAuthenticationStats(): Promise<{
        totalIdentities: number;
        identitiesByLevel: Record<IdentityLevel, number>;
        averageReputation: number;
        activeNonces: number;
        authenticationRate: number;
    }>;
    recordAuthenticationAttempt(result: BRC31AuthenticationResult): Promise<void>;
}
