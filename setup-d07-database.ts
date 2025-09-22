/**
 * D07 BSV Overlay Network Data Streaming & Quota Management Database Setup
 * Implements comprehensive streaming quotas with BRC standards integration
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'overlay',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'password',
});

async function setupD07Database() {
  try {
    console.log('🚀 Setting up D07 BSV Overlay Network Data Streaming & Quota Management...');

    // Read and execute the schema file
    const schemaPath = path.join(__dirname, 'src/db/schema-d07-streaming-quotas.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📊 Creating D07 streaming and quota tables...');
    await pool.query(schemaSql);

    console.log('✅ D07 database schema created successfully!');

    // Verify tables were created
    const checkTablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'streaming_usage',
        'quota_policies',
        'quota_usage_windows',
        'uhrp_host_performance',
        'agent_streaming_sessions',
        'delivery_optimization'
      )
      ORDER BY table_name;
    `;

    const result = await pool.query(checkTablesQuery);
    console.log('📋 D07 Tables created:', result.rows.map(row => row.table_name));

    // Check quota policies
    const policiesQuery = 'SELECT policy_name, description FROM quota_policies ORDER BY policy_name';
    const policies = await pool.query(policiesQuery);
    console.log('🎯 Quota policies created:', policies.rows.map(p => `${p.policy_name}: ${p.description}`));

    // Check delivery optimization rules
    const optimizationQuery = 'SELECT content_hash, cache_tier, target_latency_ms FROM delivery_optimization';
    const optimization = await pool.query(optimizationQuery);
    console.log('⚡ Delivery optimization rules:', optimization.rows.length);

    console.log('🎉 D07 BSV Overlay Network Data Streaming & Quota Management setup completed!');

  } catch (error) {
    console.error('❌ Error setting up D07 database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupD07Database().catch(console.error);
}

export { setupD07Database };