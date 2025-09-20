import { getCacheTTLs } from './ttls';
import { getRedisClient } from '../db/redis';

type CacheKey = string; // `${versionId}:${depth}`

export type BundleCacheEntry = {
  assembledAt: number; // ms since epoch
  body: any;           // the bundle JSON (structure only; confirmations will be recomputed on read)
  meetsPolicyAtWrite: boolean; // whether at write time all envelopes met minConfs
};

const store = new Map<CacheKey, BundleCacheEntry>();
const useRedis = process.env.USE_REDIS_BUNDLES === 'true';

export function bundlesKey(versionId: string, depth: number): CacheKey {
  return `bundle:${versionId.toLowerCase()}:${depth}`;
}

export async function bundlesGet(key: CacheKey): Promise<BundleCacheEntry | undefined> {
  if (useRedis) {
    try {
      const redis = getRedisClient();
      const cached = await redis.get<BundleCacheEntry>(key);
      if (cached) {
        const ttl = getCacheTTLs().bundles;
        if (Date.now() - cached.assembledAt > ttl) {
          await redis.del(key);
          return undefined;
        }
        return cached;
      }
      return undefined;
    } catch (error) {
      console.warn('Redis bundle cache GET error, falling back to memory:', error);
    }
  }

  // Fallback to in-memory cache
  const ttl = getCacheTTLs().bundles;
  const ent = store.get(key);
  if (!ent) return undefined;
  if (Date.now() - ent.assembledAt > ttl) {
    store.delete(key);
    return undefined;
  }
  return ent;
}

export async function bundlesSet(key: CacheKey, body: any, meetsPolicyAtWrite: boolean): Promise<void> {
  const entry: BundleCacheEntry = {
    assembledAt: Date.now(),
    body,
    meetsPolicyAtWrite
  };

  if (useRedis) {
    try {
      const redis = getRedisClient();
      const ttlSeconds = Math.floor(getCacheTTLs().bundles / 1000);
      await redis.set(key, entry, ttlSeconds);
    } catch (error) {
      console.warn('Redis bundle cache SET error, falling back to memory:', error);
    }
  }

  // Also store in memory as fallback
  store.set(key, entry);
}

export async function bundlesInvalidate(key?: CacheKey): Promise<void> {
  if (useRedis) {
    try {
      const redis = getRedisClient();
      if (key) {
        await redis.del(key);
      } else {
        await redis.delPattern('bundle:*');
      }
    } catch (error) {
      console.warn('Redis bundle cache invalidation error:', error);
    }
  }

  // Also clear memory cache
  if (key) {
    store.delete(key);
  } else {
    store.clear();
  }
}