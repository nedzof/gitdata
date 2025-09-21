/**
 * Comprehensive database cleanup for integration tests
 * Cleans all tables in the correct order to handle foreign key constraints
 */

export async function cleanupDatabase() {
  const { getPostgreSQLClient } = await import('../../src/db/postgresql');
  const pgClient = getPostgreSQLClient();

  // Clean up tables in reverse dependency order (children first, then parents)
  const cleanupQueries = [
    // Clear OpenLineage tables
    'DELETE FROM ol_dlq',
    'DELETE FROM ol_edges',
    'DELETE FROM ol_runs',
    'DELETE FROM ol_jobs',
    'DELETE FROM ol_datasets',
    'DELETE FROM ol_events',

    // Clear artifacts and templates
    'DELETE FROM artifacts',
    'DELETE FROM contract_templates',

    // Clear jobs and rules
    'DELETE FROM jobs',
    'DELETE FROM rules',

    // Clear advisory system
    'DELETE FROM advisory_targets',
    'DELETE FROM advisories',

    // Clear pricing system
    'DELETE FROM price_rules',
    'DELETE FROM revenue_events',
    'DELETE FROM prices',

    // Clear manifests and lineage
    'DELETE FROM edges',
    'DELETE FROM manifests',
    'DELETE FROM declarations',
    'DELETE FROM lineage_event_audit',

    // Clear receipts and policies
    'DELETE FROM receipts',
    'DELETE FROM policy_runs',
    'DELETE FROM policies',

    // Clear assets
    'DELETE FROM assets',

    // Clear agents
    'DELETE FROM agents',

    // Clear users and producers last
    'DELETE FROM users',
    'DELETE FROM producers',

    // Clear ingest tables if they exist
    'DELETE FROM ingest_event_relations',
    'DELETE FROM ingest_subscriptions',
    'DELETE FROM ingest_jobs',
    'DELETE FROM ingest_events',
    'DELETE FROM ingest_sources',

    // Clear payment events if they exist
    'DELETE FROM payment_events WHERE 1=1', // Use WHERE clause to avoid syntax errors if table doesn't exist
  ];

  for (const query of cleanupQueries) {
    try {
      await pgClient.query(query);
    } catch (error) {
      // Ignore errors for tables that don't exist
      if (!error.message.includes('does not exist')) {
        console.warn(`Cleanup warning for query "${query}":`, error.message);
      }
    }
  }
}

export async function cleanupRedis() {
  try {
    const { getRedisClient } = await import('../../src/db/redis');
    const redis = getRedisClient();
    if (redis && typeof redis.flushAll === 'function') {
      await redis.flushAll(); // Clear all keys in current database
    } else if (redis && typeof redis.flushdb === 'function') {
      await redis.flushdb();
    }
  } catch (error) {
    // Redis might not be available in all test environments
    // Don't log warnings as they clutter output
  }
}

export async function fullDatabaseCleanup() {
  await Promise.all([
    cleanupDatabase(),
    cleanupRedis()
  ]);
}