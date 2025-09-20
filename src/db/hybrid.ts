import { PostgreSQLClient, getPostgreSQLClient } from './postgresql';
import { RedisClient, getRedisClient, CacheKeys, getCacheTTLs } from './redis';
import type {
  DeclarationRow,
  ManifestRow,
  ProducerRow,
  ReceiptRow,
  RevenueEventRow,
  PriceRule,
  AdvisoryRow,
  AgentRow,
  RuleRow,
  JobRow,
  ContractTemplateRow,
  ArtifactRow,
  OLEventRow,
  OLJobRow,
  OLRunRow,
  OLDatasetRow,
  OLEdgeRow,
  OpenLineageEvent
} from './index';

export class HybridDatabase {
  private pg: PostgreSQLClient;
  private redis: RedisClient;
  private ttls: ReturnType<typeof getCacheTTLs>;

  constructor(pgClient?: PostgreSQLClient, redisClient?: RedisClient) {
    this.pg = pgClient || getPostgreSQLClient();
    this.redis = redisClient || getRedisClient();
    this.ttls = getCacheTTLs();
  }

  // Cache-aside pattern implementation
  private async getFromCacheOrDb<T>(
    cacheKey: string,
    dbQuery: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.redis.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Cache miss, fetch from database
    const data = await dbQuery();

    // Store in cache if data exists
    if (data !== null && data !== undefined) {
      await this.redis.set(cacheKey, data, ttlSeconds);
    }

    return data;
  }

  private async invalidateCache(keys: string | string[]): Promise<void> {
    await this.redis.del(keys);
  }

  // Assets (formerly manifests) with cache-aside
  async getAsset(versionId: string): Promise<ManifestRow | null> {
    const cacheKey = CacheKeys.asset(versionId);
    return this.getFromCacheOrDb(
      cacheKey,
      async () => {
        const result = await this.pg.queryOne<ManifestRow>(
          'SELECT * FROM manifests WHERE version_id = $1',
          [versionId.toLowerCase()]
        );
        return result;
      },
      this.ttls.assets
    );
  }

  async upsertAsset(asset: Partial<ManifestRow>): Promise<void> {
    // Update database
    const columns = Object.keys(asset);
    const values = Object.values(asset);
    const placeholders = values.map((_, i) => `$${i + 1}`);
    const updateSet = columns
      .filter(col => col !== 'version_id')
      .map(col => `${col} = EXCLUDED.${col}`)
      .join(', ');

    await this.pg.query(`
      INSERT INTO manifests (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (version_id)
      DO UPDATE SET ${updateSet}
    `, values);

    // Invalidate caches
    if (asset.version_id) {
      await this.invalidateCache([
        CacheKeys.asset(asset.version_id),
        CacheKeys.listings() // Invalidate all listings cache
      ]);

      // Also invalidate pattern-based cache
      await this.redis.delPattern('cache:listings*');
    }
  }

  // Catalog search with cache-aside
  async searchAssets(opts: {
    q?: string;
    datasetId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ManifestRow[]> {
    const { q, datasetId, limit = 50, offset = 0 } = opts;
    const page = Math.floor(offset / limit) + 1;
    const cacheKey = CacheKeys.listings(q, page, { datasetId, limit });

    return this.getFromCacheOrDb(
      cacheKey,
      async () => {
        let sql = 'SELECT * FROM manifests WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (q) {
          sql += ` AND (dataset_id ILIKE $${paramIndex} OR version_id ILIKE $${paramIndex + 1} OR manifest_json ILIKE $${paramIndex + 2})`;
          const searchTerm = `%${q}%`;
          params.push(searchTerm, searchTerm, searchTerm);
          paramIndex += 3;
        }

        if (datasetId) {
          sql += ` AND dataset_id = $${paramIndex}`;
          params.push(datasetId);
          paramIndex++;
        }

        sql += ' ORDER BY created_at DESC';

        if (limit > 0) {
          sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
          params.push(limit, offset);
        }

        const result = await this.pg.query<ManifestRow>(sql, params);
        return result.rows;
      },
      this.ttls.listings
    );
  }

  // Producers with cache
  async getProducer(producerId: string): Promise<ProducerRow | null> {
    const cacheKey = `cache:producer:${producerId}`;
    return this.getFromCacheOrDb(
      cacheKey,
      async () => {
        return await this.pg.queryOne<ProducerRow>(
          'SELECT * FROM producers WHERE producer_id = $1',
          [producerId]
        );
      },
      this.ttls.assets // Use assets TTL for producers
    );
  }

  async upsertProducer(producer: Partial<ProducerRow>): Promise<string> {
    // Check if producer exists by identity_key
    let existingId: string | null = null;
    if (producer.identity_key) {
      const existing = await this.pg.queryOne<{ producer_id: string }>(
        'SELECT producer_id FROM producers WHERE identity_key = $1',
        [producer.identity_key.toLowerCase()]
      );
      existingId = existing?.producer_id || null;
    }

    if (existingId) {
      // Update existing producer
      await this.pg.query(
        'UPDATE producers SET name = COALESCE($1, name), website = COALESCE($2, website) WHERE producer_id = $3',
        [producer.name, producer.website, existingId]
      );

      // Invalidate cache
      await this.invalidateCache(`cache:producer:${existingId}`);
      return existingId;
    } else {
      // Create new producer
      const producerId = producer.producer_id ||
        'pr_' + Math.random().toString(16).slice(2) + Date.now().toString(16);

      await this.pg.query(`
        INSERT INTO producers(producer_id, identity_key, display_name, website, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        producerId,
        producer.identity_key?.toLowerCase() || null,
        producer.name || null,
        producer.website || null
      ]);

      return producerId;
    }
  }

  // Prices with cache
  async getPrice(versionId: string): Promise<number | null> {
    const cacheKey = CacheKeys.price(versionId);
    return this.getFromCacheOrDb(
      cacheKey,
      async () => {
        const result = await this.pg.queryOne<{ satoshis: number }>(
          'SELECT satoshis FROM prices WHERE version_id = $1',
          [versionId.toLowerCase()]
        );
        return result?.satoshis || null;
      },
      this.ttls.prices
    );
  }

  async setPrice(versionId: string, satoshis: number): Promise<void> {
    await this.pg.query(`
      INSERT INTO prices(version_id, satoshis) VALUES ($1, $2)
      ON CONFLICT(version_id) DO UPDATE SET satoshis = EXCLUDED.satoshis
    `, [versionId.toLowerCase(), satoshis]);

    // Invalidate price cache
    await this.invalidateCache(CacheKeys.price(versionId));
  }

  // Lineage edges
  async replaceEdges(child: string, parents: string[]): Promise<void> {
    await this.pg.transaction(async (client) => {
      // Delete existing edges
      await client.query('DELETE FROM edges WHERE child_version_id = $1', [child]);

      // Insert new edges
      for (const parent of parents) {
        await client.query(
          'INSERT INTO edges(child_version_id, parent_version_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [child, parent]
        );
      }
    });

    // Invalidate lineage caches
    await this.redis.delPattern(`ol:cache:lineage:*${child}*`);
  }

  async getParents(child: string): Promise<string[]> {
    const result = await this.pg.query<{ parent_version_id: string }>(
      'SELECT parent_version_id FROM edges WHERE child_version_id = $1',
      [child]
    );
    return result.rows.map(r => r.parent_version_id);
  }

  // Receipts
  async insertReceipt(receipt: Omit<ReceiptRow, 'bytes_used' | 'last_seen'> & Partial<Pick<ReceiptRow, 'bytes_used' | 'last_seen'>>): Promise<void> {
    await this.pg.query(`
      INSERT INTO receipts(receipt_id, version_id, quantity, content_hash, amount_sat, status, created_at, expires_at, bytes_used, last_seen)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      receipt.receipt_id,
      receipt.version_id,
      receipt.quantity,
      receipt.content_hash,
      receipt.amount_sat,
      receipt.status,
      receipt.created_at,
      receipt.expires_at,
      receipt.bytes_used || 0,
      receipt.last_seen
    ]);
  }

  async getReceipt(receiptId: string): Promise<ReceiptRow | null> {
    return await this.pg.queryOne<ReceiptRow>(
      'SELECT * FROM receipts WHERE receipt_id = $1',
      [receiptId]
    );
  }

  // OpenLineage integration with Redis
  async ingestOpenLineageEvent(event: OpenLineageEvent): Promise<boolean> {
    const payload = JSON.stringify(event);
    const hash = require('crypto').createHash('sha256').update(payload).digest('hex');
    const eventId = `ol_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      // Store in PostgreSQL for audit
      await this.pg.query(`
        INSERT INTO ol_events(event_id, event_time, namespace, job_name, run_id, event_type, payload_json, hash, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(hash) DO NOTHING
      `, [eventId, event.eventTime, event.job.namespace, event.job.name, event.run.runId, event.eventType, payload, hash, now]);

      // Store in Redis for fast querying
      const namespace = event.job.namespace;

      // Store raw event
      await this.redis.set(
        CacheKeys.olEvent(namespace, hash),
        event,
        this.ttls.lineage
      );

      // Add to time-ordered index
      await this.redis.zadd(
        CacheKeys.olEventsByTime(namespace),
        new Date(event.eventTime).getTime(),
        hash
      );

      // Update job info
      const jobKey = CacheKeys.olJob(namespace, event.job.name);
      await this.redis.hset(jobKey, 'name', event.job.name);
      await this.redis.hset(jobKey, 'namespace', namespace);
      if (event.job.facets) {
        await this.redis.hset(jobKey, 'facets', JSON.stringify(event.job.facets));
      }
      await this.redis.expire(jobKey, this.ttls.lineage);

      // Update run info
      const runKey = CacheKeys.olRun(namespace, event.run.runId);
      await this.redis.hset(runKey, 'runId', event.run.runId);
      await this.redis.hset(runKey, 'state', event.eventType);
      if (event.eventType === 'START') {
        await this.redis.hset(runKey, 'startTime', event.eventTime);
      } else if (event.eventType === 'COMPLETE' || event.eventType === 'ABORT') {
        await this.redis.hset(runKey, 'endTime', event.eventTime);
      }
      if (event.run.facets) {
        await this.redis.hset(runKey, 'facets', JSON.stringify(event.run.facets));
      }
      await this.redis.expire(runKey, this.ttls.lineage);

      // Process datasets and build adjacency lists
      const allDatasets = [...(event.inputs || []), ...(event.outputs || [])];
      for (const dataset of allDatasets) {
        const dsKey = CacheKeys.olDataset(namespace, dataset.name);
        await this.redis.hset(dsKey, 'name', dataset.name);
        await this.redis.hset(dsKey, 'namespace', namespace);
        if (dataset.facets) {
          await this.redis.hset(dsKey, 'facets', JSON.stringify(dataset.facets));
        }
        await this.redis.expire(dsKey, this.ttls.lineage);

        // Add to datasets index
        await this.redis.sadd(CacheKeys.olDatasetsAll(namespace), [dataset.name]);
      }

      // Build lineage edges
      if (event.inputs && event.outputs) {
        for (const input of event.inputs) {
          for (const output of event.outputs) {
            // Parent -> Child relationship (input produces output)
            await this.redis.sadd(CacheKeys.olDownstream(namespace, input.name), [output.name]);
            await this.redis.sadd(CacheKeys.olUpstream(namespace, output.name), [input.name]);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to ingest OpenLineage event:', error);
      return false;
    }
  }

  // Lineage graph query with caching
  async queryLineage(options: {
    node: string;
    depth?: number;
    direction?: 'up' | 'down' | 'both';
    namespace?: string;
  }): Promise<{
    node: string;
    depth: number;
    direction: string;
    nodes: Array<{ namespace: string; name: string; type: 'dataset'; facets?: any }>;
    edges: Array<{ from: string; to: string; rel: 'parent' }>;
    stats: { nodes: number; edges: number; truncated: boolean };
  }> {
    const { depth = 3, direction = 'both' } = options;
    const maxDepth = Math.min(depth, parseInt(process.env.OL_QUERY_MAX_DEPTH || '10'));

    // Parse node identifier
    const [, nodeNamespace, nodeName] = options.node.split(':');
    const namespace = options.namespace || nodeNamespace;

    const cacheKey = CacheKeys.lineageGraph(options.node, maxDepth, direction, 'json');

    return this.getFromCacheOrDb(
      cacheKey,
      async () => {
        const visitedNodes = new Set<string>();
        const resultNodes = new Map<string, any>();
        const resultEdges: Array<{ from: string; to: string; rel: 'parent' }> = [];

        const traverse = async (currentName: string, currentDepth: number): Promise<void> => {
          if (currentDepth > maxDepth || visitedNodes.has(currentName)) return;
          visitedNodes.add(currentName);

          // Get dataset info from Redis
          const dsKey = CacheKeys.olDataset(namespace, currentName);
          const dsInfo = await this.redis.hgetall(dsKey);

          if (dsInfo.name) {
            const nodeKey = `dataset:${namespace}:${currentName}`;
            resultNodes.set(nodeKey, {
              namespace,
              name: currentName,
              type: 'dataset',
              facets: dsInfo.facets ? JSON.parse(dsInfo.facets) : {}
            });
          }

          if (currentDepth < maxDepth) {
            // Traverse upstream (parents)
            if (direction === 'up' || direction === 'both') {
              const parents = await this.redis.smembers(CacheKeys.olUpstream(namespace, currentName));
              for (const parent of parents) {
                const parentKey = `dataset:${namespace}:${parent}`;
                const childKey = `dataset:${namespace}:${currentName}`;
                resultEdges.push({ from: parentKey, to: childKey, rel: 'parent' });
                await traverse(parent, currentDepth + 1);
              }
            }

            // Traverse downstream (children)
            if (direction === 'down' || direction === 'both') {
              const children = await this.redis.smembers(CacheKeys.olDownstream(namespace, currentName));
              for (const child of children) {
                const parentKey = `dataset:${namespace}:${currentName}`;
                const childKey = `dataset:${namespace}:${child}`;
                resultEdges.push({ from: parentKey, to: childKey, rel: 'parent' });
                await traverse(child, currentDepth + 1);
              }
            }
          }
        };

        await traverse(nodeName, 0);

        return {
          node: options.node,
          depth: maxDepth,
          direction,
          nodes: Array.from(resultNodes.values()),
          edges: resultEdges,
          stats: {
            nodes: resultNodes.size,
            edges: resultEdges.length,
            truncated: visitedNodes.size > resultNodes.size
          }
        };
      },
      this.ttls.lineage
    );
  }

  // Health checks
  async healthCheck(): Promise<{ pg: boolean; redis: boolean }> {
    const [pgHealth, redisHealth] = await Promise.all([
      this.pg.healthCheck(),
      this.redis.ping()
    ]);

    return { pg: pgHealth, redis: redisHealth };
  }

  // Cleanup
  async close(): Promise<void> {
    await Promise.all([
      this.pg.close(),
      this.redis.disconnect()
    ]);
  }
}

// Export singleton
let hybridDb: HybridDatabase | null = null;

export function getHybridDatabase(): HybridDatabase {
  if (!hybridDb) {
    hybridDb = new HybridDatabase();
  }
  return hybridDb;
}

export async function closeHybridDatabase(): Promise<void> {
  if (hybridDb) {
    await hybridDb.close();
    hybridDb = null;
  }
}