import { getCacheTTLs } from './ttls';
import { getRedisClient } from '../db/redis';

// BRC Method Cache implementation for D11H specification
// Focuses on BRC-100 wallet method caching and cache invalidation

export type BRCCacheEntry = {
  method: string;
  timestamp: number;
  data: any;
  signature?: string;
  publicKey?: string;
  expiresAt: number;
};

export type BRCVerificationEntry = {
  method: string;
  hash: string;
  verified: boolean;
  timestamp: number;
  publicKey: string;
  expiresAt: number;
};

// Redis key patterns for D11H
const BRC_METHOD_PREFIX = 'cache:brc:method:';
const BRC_VERIFICATION_PREFIX = 'cache:brc:verify:';
const BRC_SIGNATURE_PREFIX = 'cache:brc:sig:';
const CACHE_INVALIDATION_PREFIX = 'cache:invalid:';
const API_CLIENT_PREFIX = 'cache:api:client:';

// Force cache invalidation for API client methods
export async function invalidateAPIClientCache(): Promise<void> {
  const redis = getRedisClient();
  try {
    // Delete all API client cached methods to force reload
    await redis.delPattern(`${API_CLIENT_PREFIX}*`);

    // Set invalidation marker with zero TTL to force immediate reload
    const ttls = getCacheTTLs();
    await redis.set(`${CACHE_INVALIDATION_PREFIX}api_client`, Date.now(), Math.floor(ttls.apiClient / 1000));

    console.log('🔄 API Client cache invalidated - forcing reload of D06 methods');
  } catch (error) {
    console.warn('Failed to invalidate API client cache:', error);
  }
}

// Check if API client should bypass cache
export async function shouldBypassAPICache(): Promise<boolean> {
  const redis = getRedisClient();
  try {
    const invalidationMarker = await redis.get(`${CACHE_INVALIDATION_PREFIX}api_client`);
    return invalidationMarker !== null;
  } catch (error) {
    console.warn('Failed to check API cache bypass:', error);
    return true; // Default to bypass on error
  }
}

// Cache BRC method verification
export async function cacheBRCVerification(
  method: string,
  hash: string,
  verified: boolean,
  publicKey: string
): Promise<void> {
  const redis = getRedisClient();
  const ttls = getCacheTTLs();

  const entry: BRCVerificationEntry = {
    method,
    hash,
    verified,
    timestamp: Date.now(),
    publicKey,
    expiresAt: Date.now() + ttls.brcVerification
  };

  try {
    const key = `${BRC_VERIFICATION_PREFIX}${method}:${hash}`;
    await redis.set(key, entry, Math.floor(ttls.brcVerification / 1000));
  } catch (error) {
    console.warn('Failed to cache BRC verification:', error);
  }
}

// Get cached BRC verification
export async function getCachedBRCVerification(
  method: string,
  hash: string
): Promise<BRCVerificationEntry | null> {
  const redis = getRedisClient();

  try {
    const key = `${BRC_VERIFICATION_PREFIX}${method}:${hash}`;
    const cached = await redis.get<BRCVerificationEntry>(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    // Remove expired entry
    if (cached) {
      await redis.del(key);
    }

    return null;
  } catch (error) {
    console.warn('Failed to get cached BRC verification:', error);
    return null;
  }
}

// Cache BRC signature
export async function cacheBRCSignature(
  hash: string,
  signature: string,
  publicKey: string
): Promise<void> {
  const redis = getRedisClient();
  const ttls = getCacheTTLs();

  const entry = {
    signature,
    publicKey,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttls.brcSignatures
  };

  try {
    const key = `${BRC_SIGNATURE_PREFIX}${hash}`;
    await redis.set(key, entry, Math.floor(ttls.brcSignatures / 1000));
  } catch (error) {
    console.warn('Failed to cache BRC signature:', error);
  }
}

// Get cached BRC signature
export async function getCachedBRCSignature(hash: string): Promise<any | null> {
  const redis = getRedisClient();

  try {
    const key = `${BRC_SIGNATURE_PREFIX}${hash}`;
    const cached = await redis.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    // Remove expired entry
    if (cached) {
      await redis.del(key);
    }

    return null;
  } catch (error) {
    console.warn('Failed to get cached BRC signature:', error);
    return null;
  }
}

// Invalidate all BRC caches (called on wallet disconnection or key change)
export async function invalidateBRCCache(publicKey?: string): Promise<void> {
  const redis = getRedisClient();

  try {
    if (publicKey) {
      // Invalidate specific public key entries
      await redis.delPattern(`${BRC_VERIFICATION_PREFIX}*`);
      await redis.delPattern(`${BRC_SIGNATURE_PREFIX}*`);
    } else {
      // Invalidate all BRC cache entries
      await redis.delPattern(`${BRC_METHOD_PREFIX}*`);
      await redis.delPattern(`${BRC_VERIFICATION_PREFIX}*`);
      await redis.delPattern(`${BRC_SIGNATURE_PREFIX}*`);
    }

    console.log('🗑️ BRC cache invalidated', publicKey ? `for key: ${publicKey}` : 'completely');
  } catch (error) {
    console.warn('Failed to invalidate BRC cache:', error);
  }
}

// Override standard cache behavior for critical methods
export async function shouldBypassCache(method: string): Promise<boolean> {
  // These methods should never be cached due to security/freshness requirements
  const noCacheMethods = [
    'getRevenueSummary',
    'getAgentSummary',
    'processPayment',
    'verifyPayment',
    'createSignature',
    'verifySignature',
    'waitForAuthentication'
  ];

  if (noCacheMethods.includes(method)) {
    return true;
  }

  // Check if general API cache should be bypassed
  return await shouldBypassAPICache();
}

// Log cache operations for debugging
export function logCacheOperation(operation: string, key: string, hit: boolean = false): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Cache ${operation}: ${key} - ${hit ? 'HIT' : 'MISS'}`);
}