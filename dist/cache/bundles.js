"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bundlesKey = bundlesKey;
exports.bundlesGet = bundlesGet;
exports.bundlesSet = bundlesSet;
exports.bundlesInvalidate = bundlesInvalidate;
const redis_1 = require("../db/redis");
const ttls_1 = require("./ttls");
const store = new Map();
const useRedis = process.env.USE_REDIS_BUNDLES === 'true';
function bundlesKey(versionId, depth) {
    return `bundle:${versionId.toLowerCase()}:${depth}`;
}
async function bundlesGet(key) {
    if (useRedis) {
        try {
            const redis = (0, redis_1.getRedisClient)();
            const cached = await redis.get(key);
            if (cached) {
                const ttl = (0, ttls_1.getCacheTTLs)().bundles;
                if (Date.now() - cached.assembledAt > ttl) {
                    await redis.del(key);
                    return undefined;
                }
                return cached;
            }
            return undefined;
        }
        catch (error) {
            console.warn('Redis bundle cache GET error, falling back to memory:', error);
        }
    }
    // Fallback to in-memory cache
    const ttl = (0, ttls_1.getCacheTTLs)().bundles;
    const ent = store.get(key);
    if (!ent)
        return undefined;
    if (Date.now() - ent.assembledAt > ttl) {
        store.delete(key);
        return undefined;
    }
    return ent;
}
async function bundlesSet(key, body, meetsPolicyAtWrite) {
    const entry = {
        assembledAt: Date.now(),
        body,
        meetsPolicyAtWrite,
    };
    if (useRedis) {
        try {
            const redis = (0, redis_1.getRedisClient)();
            const ttlSeconds = Math.floor((0, ttls_1.getCacheTTLs)().bundles / 1000);
            await redis.set(key, entry, ttlSeconds);
        }
        catch (error) {
            console.warn('Redis bundle cache SET error, falling back to memory:', error);
        }
    }
    // Also store in memory as fallback
    store.set(key, entry);
}
async function bundlesInvalidate(key) {
    if (useRedis) {
        try {
            const redis = (0, redis_1.getRedisClient)();
            if (key) {
                await redis.del(key);
            }
            else {
                await redis.delPattern('bundle:*');
            }
        }
        catch (error) {
            console.warn('Redis bundle cache invalidation error:', error);
        }
    }
    // Also clear memory cache
    if (key) {
        store.delete(key);
    }
    else {
        store.clear();
    }
}
//# sourceMappingURL=bundles.js.map