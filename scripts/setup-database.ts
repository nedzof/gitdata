#!/usr/bin/env tsx

import { getPostgreSQLClient } from '../src/db/postgresql';
import { getRedisClient } from '../src/db/redis';
import { getHybridDatabase } from '../src/db/hybrid';

async function main() {
  console.log('Setting up PostgreSQL/Redis hybrid database...');

  try {
    // Initialize PostgreSQL schema
    console.log('Initializing PostgreSQL schema...');
    const pgClient = getPostgreSQLClient();
    await pgClient.initSchema();
    console.log('✅ PostgreSQL schema initialized');

    // Test Redis connection
    console.log('Testing Redis connection...');
    const redis = getRedisClient();
    const redisOk = await redis.ping();
    if (!redisOk) {
      throw new Error('Redis connection failed');
    }
    console.log('✅ Redis connection successful');

    // Test hybrid database
    console.log('Testing hybrid database...');
    const hybridDb = getHybridDatabase();
    const health = await hybridDb.healthCheck();
    if (!health.pg || !health.redis) {
      throw new Error(`Health check failed: PostgreSQL=${health.pg}, Redis=${health.redis}`);
    }
    console.log('✅ Hybrid database health check passed');

    console.log('');
    console.log('🎉 Database setup completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start your application server');
    console.log('2. Check health endpoints: GET /health and GET /health/db');
    console.log('3. Monitor cache performance and database connections');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}