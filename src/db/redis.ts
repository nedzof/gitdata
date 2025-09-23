import Redis from 'ioredis';

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  lazyConnect?: boolean;
}

export class RedisClient {
  private client: Redis;
  private config: RedisConfig;

  constructor(config: RedisConfig = {}) {
    this.config = {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      ...config,
    };

    if (this.config.url) {
      this.client = new Redis(this.config.url, this.config);
    } else {
      this.client = new Redis({
        host: this.config.host || 'localhost',
        port: this.config.port || 6379,
        password: this.config.password,
        db: this.config.db || 0,
        ...this.config,
      });
    }

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis connected');
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  // Cache-aside pattern helpers
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
    }
  }

  async del(key: string | string[]): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Redis DEL error for key(s) ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  // Pattern-based operations
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error(`Redis KEYS error for pattern ${pattern}:`, error);
      return [];
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error(`Redis DEL pattern error for ${pattern}:`, error);
    }
  }

  // Hash operations for complex objects
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      console.error(`Redis HGET error for ${key}.${field}:`, error);
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hset(key, field, value);
    } catch (error) {
      console.error(`Redis HSET error for ${key}.${field}:`, error);
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      console.error(`Redis HGETALL error for ${key}:`, error);
      return {};
    }
  }

  async hdel(key: string, field: string): Promise<void> {
    try {
      await this.client.hdel(key, field);
    } catch (error) {
      console.error(`Redis HDEL error for ${key}.${field}:`, error);
    }
  }

  // Set operations for adjacency lists
  async sadd(key: string, members: string[]): Promise<void> {
    try {
      if (members.length > 0) {
        await this.client.sadd(key, ...members);
      }
    } catch (error) {
      console.error(`Redis SADD error for ${key}:`, error);
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      console.error(`Redis SMEMBERS error for ${key}:`, error);
      return [];
    }
  }

  async srem(key: string, members: string[]): Promise<void> {
    try {
      if (members.length > 0) {
        await this.client.srem(key, ...members);
      }
    } catch (error) {
      console.error(`Redis SREM error for ${key}:`, error);
    }
  }

  // Sorted set operations for time-based indexes
  async zadd(key: string, score: number, member: string): Promise<void> {
    try {
      await this.client.zadd(key, score, member);
    } catch (error) {
      console.error(`Redis ZADD error for ${key}:`, error);
    }
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zrange(key, start, stop);
    } catch (error) {
      console.error(`Redis ZRANGE error for ${key}:`, error);
      return [];
    }
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zrevrange(key, start, stop);
    } catch (error) {
      console.error(`Redis ZREVRANGE error for ${key}:`, error);
      return [];
    }
  }

  // TTL operations
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      console.error(`Redis EXPIRE error for ${key}:`, error);
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error(`Redis TTL error for ${key}:`, error);
      return -1;
    }
  }

  // Pub/Sub
  async publish(channel: string, message: string): Promise<void> {
    try {
      await this.client.publish(channel, message);
    } catch (error) {
      console.error(`Redis PUBLISH error for channel ${channel}:`, error);
    }
  }

  // Direct client access for advanced operations
  getClient(): Redis {
    return this.client;
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis PING error:', error);
      return false;
    }
  }
}

// Cache TTL configuration
export interface CacheTTLs {
  assets: number; // Asset metadata cache TTL
  listings: number; // Catalog listings cache TTL
  lineage: number; // Lineage graph cache TTL
  sessions: number; // User session TTL
  policies: number; // Policy cache TTL
  prices: number; // Price cache TTL
}

export function getCacheTTLs(): CacheTTLs {
  try {
    const raw = process.env.CACHE_TTLS_JSON;
    if (raw) {
      const config = JSON.parse(raw);
      return {
        assets: Number(config.assets ?? 300), // 5 minutes
        listings: Number(config.listings ?? 180), // 3 minutes
        lineage: Number(config.lineage ?? 120), // 2 minutes
        sessions: Number(config.sessions ?? 1800), // 30 minutes
        policies: Number(config.policies ?? 600), // 10 minutes
        prices: Number(config.prices ?? 120), // 2 minutes
      };
    }
  } catch (error) {
    console.warn('Invalid CACHE_TTLS_JSON, using defaults:', error);
  }

  return {
    assets: 300,
    listings: 180,
    lineage: 120,
    sessions: 1800,
    policies: 600,
    prices: 120,
  };
}

// Cache key generators following D022HR namespace conventions
export const CacheKeys = {
  // Asset metadata cache
  asset: (versionId: string) => `cache:asset:${versionId.toLowerCase()}`,

  // Catalog listings cache
  listings: (query?: string, page?: number, filters?: Record<string, any>) => {
    const parts = ['cache:listings'];
    if (query) parts.push(`q:${query}`);
    if (page) parts.push(`page:${page}`);
    if (filters) {
      Object.entries(filters)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([k, v]) => parts.push(`${k}:${v}`));
    }
    return parts.join('|');
  },

  // OpenLineage namespace keys (D41 compatible)
  olEvent: (namespace: string, hash: string) => `ol:ns:${namespace}:event:${hash}`,
  olJob: (namespace: string, name: string) => `ol:ns:${namespace}:job:${name}`,
  olRun: (namespace: string, runId: string) => `ol:ns:${namespace}:run:${runId}`,
  olDataset: (namespace: string, name: string) => `ol:ns:${namespace}:ds:${name}`,
  olUpstream: (namespace: string, child: string) => `ol:ns:${namespace}:up:${child}`,
  olDownstream: (namespace: string, parent: string) => `ol:ns:${namespace}:down:${parent}`,
  olEventsByTime: (namespace: string) => `ol:ns:${namespace}:events:by_time`,
  olJobsByUpdated: (namespace: string) => `ol:ns:${namespace}:jobs:by_updated`,
  olRunsByUpdated: (namespace: string) => `ol:ns:${namespace}:runs:by_updated`,
  olDatasetsAll: (namespace: string) => `ol:ns:${namespace}:ds:all`,

  // Lineage graph cache with parameters
  lineageGraph: (node: string, depth: number, direction: string, format: string) =>
    `ol:cache:lineage:${node}|${depth}|${direction}|${format}`,

  // Sessions
  session: (sessionId: string) => `sess:${sessionId}`,

  // Job queues and worker state
  jobs: (state?: string) => (state ? `jobs:${state}` : 'jobs:*'),

  // Policy cache
  policy: (policyId: string) => `cache:policy:${policyId}`,
  policyRuns: (versionId: string) => `cache:policy_runs:${versionId}`,

  // Price cache
  price: (versionId: string) => `cache:price:${versionId.toLowerCase()}`,
  priceRules: (scope: string, scopeId: string) => `cache:price_rules:${scope}:${scopeId}`,
};

// Redis client singleton
let redisClient: RedisClient | null = null;

export function getRedisClient(): RedisClient {
  if (!redisClient) {
    const config: RedisConfig = {};

    if (process.env.REDIS_URL) {
      config.url = process.env.REDIS_URL;
    } else {
      config.host = process.env.REDIS_HOST || 'localhost';
      config.port = parseInt(process.env.REDIS_PORT || '6379');
      config.password = process.env.REDIS_PASSWORD;
      config.db = parseInt(process.env.REDIS_DB || '0');
    }

    redisClient = new RedisClient(config);
  }

  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }
}
