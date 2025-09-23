#!/usr/bin/env npx tsx

/**
 * Setup D08 Real-time Streaming Database Schema
 *
 * This script sets up the database schema for real-time overlay packet streaming,
 * extending the existing D07 streaming infrastructure.
 */

async function setupD08Schema(): Promise<void> {
  console.log('🚀 Setting up D08 Real-time Streaming schema...');

  try {
    const { getHybridDatabase } = await import('./src/db/hybrid');
    const db = getHybridDatabase();

    console.log('📊 Database connected successfully');

    // Read and execute the D08 schema
    const fs = await import('fs/promises');
    const schemaSQL = await fs.readFile('./src/db/schema-d08-realtime-packets.sql', 'utf-8');

    await db.pg.query(schemaSQL);
    console.log('✅ D08 schema applied successfully');

    // Verify tables were created
    const tables = await db.pg.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'realtime_packets',
        'stream_webhooks',
        'stream_websockets',
        'stream_agent_subscriptions',
        'webhook_deliveries'
      )
      ORDER BY table_name
    `);

    console.log('📋 Created tables:');
    tables.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Check if sample streaming manifest was created
    const sampleStream = await db.pg.query(
      'SELECT version_id, title, is_streaming FROM assets WHERE version_id = $1',
      ['stream-weather-001']
    );

    if (sampleStream.rows.length > 0) {
      console.log('📦 Sample streaming package created:');
      console.log(`   ✓ ${sampleStream.rows[0].title} (${sampleStream.rows[0].version_id})`);
    }

    console.log('\n🎉 D08 Real-time Streaming setup completed successfully!');
    console.log('🔗 Ready for overlay packet streaming with BSV confirmations');

  } catch (error) {
    console.error('❌ Failed to setup D08 schema:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupD08Schema();
}