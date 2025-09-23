/**
 * Database Setup Integration Tests
 * Tests database initialization and test data population functionality
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { getHybridDatabase } from '../../src/db/hybrid.js';
import { populatePostgreSQLDatabase } from '../../scripts/populate-dummy-data-postgres.js';

describe('Database Setup Integration', () => {
  let db: any;

  beforeAll(async () => {
    db = getHybridDatabase();
  });

  afterAll(async () => {
    // Clean up test data
    await db.pg.query('DELETE FROM advisory_targets');
    await db.pg.query('DELETE FROM advisories');
    await db.pg.query('DELETE FROM edges');
    await db.pg.query('DELETE FROM price_rules');
    await db.pg.query('DELETE FROM prices');
    await db.pg.query('DELETE FROM manifests');
    await db.pg.query('DELETE FROM declarations');
    await db.pg.query('DELETE FROM producers');
  });

  test('should verify hybrid database health', async () => {
    const health = await db.healthCheck();
    expect(health.pg).toBe(true);
    expect(health.redis).toBe(true);
  });

  test('should have all required tables', async () => {
    const expectedTables = [
      'producers',
      'declarations',
      'manifests',
      'prices',
      'price_rules',
      'advisories',
      'advisory_targets',
      'edges'
    ];

    for (const tableName of expectedTables) {
      const result = await db.pg.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = $1 AND table_schema = 'public'
      `, [tableName]);
      expect(result.rows).toHaveLength(1);
    }
  });

  test('should populate realistic test data successfully', async () => {
    await populatePostgreSQLDatabase();

    // Verify producers were created
    const producers = await db.pg.query('SELECT COUNT(*) as count FROM producers');
    expect(parseInt(producers.rows[0].count)).toBeGreaterThanOrEqual(8);

    // Verify manifests were created with different types
    const manifests = await db.pg.query(`
      SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE manifest_json::json->'metadata'->>'category' = 'data') as data_count,
        COUNT(*) FILTER (WHERE manifest_json::json->'metadata'->>'category' = 'ai') as ai_count
      FROM manifests
    `);

    const stats = manifests.rows[0];
    expect(parseInt(stats.total_count)).toBeGreaterThanOrEqual(15);
    expect(parseInt(stats.data_count)).toBeGreaterThanOrEqual(10);
    expect(parseInt(stats.ai_count)).toBeGreaterThanOrEqual(2);

    // Verify pricing was set
    const prices = await db.pg.query('SELECT COUNT(*) as count FROM prices');
    expect(parseInt(prices.rows[0].count)).toEqual(parseInt(stats.total_count));

    // Verify advisories were created for flagged datasets
    const advisories = await db.pg.query('SELECT COUNT(*) as count FROM advisories');
    expect(parseInt(advisories.rows[0].count)).toBeGreaterThanOrEqual(2);

    // Verify lineage relationships
    const edges = await db.pg.query('SELECT COUNT(*) as count FROM edges');
    expect(parseInt(edges.rows[0].count)).toBeGreaterThan(0);
  });

  test('should create diverse dataset categories', async () => {
    const categories = await db.pg.query(`
      SELECT
        manifest_json::json->'metadata'->>'category' as category,
        COUNT(*) as count
      FROM manifests
      GROUP BY manifest_json::json->'metadata'->>'category'
      ORDER BY count DESC
    `);

    expect(categories.rows.length).toBeGreaterThanOrEqual(2);

    // Should have both data and AI categories
    const categoryNames = categories.rows.map(r => r.category);
    expect(categoryNames).toContain('data');
    expect(categoryNames).toContain('ai');
  });

  test('should create realistic pricing tiers', async () => {
    const pricing = await db.pg.query(`
      SELECT
        m.classification,
        m.manifest_json::json->'metadata'->>'category' as category,
        p.satoshis,
        COUNT(*) as count
      FROM assets m
      JOIN prices p ON m.version_id = p.version_id
      GROUP BY m.classification, m.manifest_json::json->'metadata'->>'category', p.satoshis
      ORDER BY p.satoshis
    `);

    expect(pricing.rows.length).toBeGreaterThan(5);

    // Check that commercial/restricted items are more expensive
    const commercialPrices = pricing.rows.filter(r => r.classification === 'commercial');
    const publicPrices = pricing.rows.filter(r => r.classification === 'public');

    if (commercialPrices.length > 0 && publicPrices.length > 0) {
      const avgCommercial = commercialPrices.reduce((sum, p) => sum + parseInt(p.satoshis), 0) / commercialPrices.length;
      const avgPublic = publicPrices.reduce((sum, p) => sum + parseInt(p.satoshis), 0) / publicPrices.length;
      expect(avgCommercial).toBeGreaterThan(avgPublic);
    }
  });

  test('should create proper advisory relationships', async () => {
    const advisoryTargets = await db.pg.query(`
      SELECT
        a.type,
        a.reason,
        COUNT(at.version_id) as target_count
      FROM advisories a
      JOIN advisory_targets at ON a.advisory_id = at.advisory_id
      GROUP BY a.advisory_id, a.type, a.reason
    `);

    expect(advisoryTargets.rows.length).toBeGreaterThanOrEqual(2);

    // Check for both WARN and BLOCK advisory types
    const advisoryTypes = advisoryTargets.rows.map(r => r.type);
    expect(advisoryTypes).toContain('WARN');
    expect(advisoryTypes).toContain('BLOCK');

    // Each advisory should target at least one version
    advisoryTargets.rows.forEach(advisory => {
      expect(parseInt(advisory.target_count)).toBeGreaterThan(0);
    });
  });

  test('should create valid lineage relationships', async () => {
    const lineage = await db.pg.query(`
      SELECT
        e.child_version_id,
        e.parent_version_id,
        cm.title as child_title,
        pm.title as parent_title
      FROM edges e
      JOIN manifests cm ON e.child_version_id = cm.version_id
      JOIN manifests pm ON e.parent_version_id = pm.version_id
      LIMIT 5
    `);

    lineage.rows.forEach(edge => {
      expect(edge.child_version_id).toBeDefined();
      expect(edge.parent_version_id).toBeDefined();
      expect(edge.child_title).toBeDefined();
      expect(edge.parent_title).toBeDefined();
      expect(edge.child_version_id).not.toEqual(edge.parent_version_id);
    });
  });

  test('should create producer-level price rules', async () => {
    const priceRules = await db.pg.query(`
      SELECT
        producer_id,
        tier_from,
        satoshis,
        COUNT(*) as rule_count
      FROM price_rules
      WHERE producer_id IS NOT NULL
      GROUP BY producer_id, tier_from, satoshis
      ORDER BY tier_from
    `);

    expect(priceRules.rows.length).toBeGreaterThanOrEqual(3);

    // Check for volume discounts (higher tier should have lower price per unit)
    const aiInnovationsRules = priceRules.rows.filter(r => r.producer_id === 'ai-innovations');
    if (aiInnovationsRules.length >= 2) {
      const tier1 = aiInnovationsRules.find(r => r.tier_from === 1);
      const tier10 = aiInnovationsRules.find(r => r.tier_from === 10);
      if (tier1 && tier10) {
        expect(parseInt(tier10.satoshis)).toBeLessThan(parseInt(tier1.satoshis));
      }
    }
  });

  test('should have consistent data relationships', async () => {
    // All manifests should have corresponding declarations
    const orphanedManifests = await db.pg.query(`
      SELECT m.version_id
      FROM assets m
      LEFT JOIN declarations d ON m.version_id = d.version_id
      WHERE d.version_id IS NULL
    `);
    expect(orphanedManifests.rows).toHaveLength(0);

    // All manifests should have corresponding prices
    const unpricedManifests = await db.pg.query(`
      SELECT m.version_id
      FROM assets m
      LEFT JOIN prices p ON m.version_id = p.version_id
      WHERE p.version_id IS NULL
    `);
    expect(unpricedManifests.rows).toHaveLength(0);

    // All manifests should reference valid producers
    const invalidProducers = await db.pg.query(`
      SELECT m.version_id, m.producer_id
      FROM assets m
      LEFT JOIN producers p ON m.producer_id = p.producer_id
      WHERE p.producer_id IS NULL
    `);
    expect(invalidProducers.rows).toHaveLength(0);
  });

  test('should have realistic manifest metadata', async () => {
    const manifests = await db.pg.query(`
      SELECT
        version_id,
        title,
        license,
        classification,
        manifest_json::json as manifest_data
      FROM manifests
      LIMIT 10
    `);

    manifests.rows.forEach(manifest => {
      expect(manifest.title).toBeDefined();
      expect(manifest.license).toMatch(/^(cc-by-4\.0|cc-by-nc-4\.0|cc0|mit|custom|apache-2\.0|gpl-3\.0)$/);
      expect(manifest.classification).toMatch(/^(public|commercial|restricted)$/);

      const data = manifest.manifest_data;
      expect(data.datasetId).toBeDefined();
      expect(data.version).toBeGreaterThan(0);
      expect(data.content.contentHash).toBeDefined();
      expect(data.content.sizeBytes).toBeGreaterThan(1024);
      expect(Array.isArray(data.metadata.tags)).toBe(true);
      expect(data.metadata.tags.length).toBeGreaterThan(0);
    });
  });
});