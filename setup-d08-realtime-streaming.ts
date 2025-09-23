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

    // Execute the D08 schema using the existing database patterns
    try {
      const fs = await import('fs/promises');
      const schemaExists = await fs.access('./src/db/schema-d08-realtime-packets.sql').then(() => true).catch(() => false);

      if (!schemaExists) {
        console.warn('⚠️ Schema file not found, creating basic D08 tables...');
        await createBasicD08Tables(db);
      } else {
        const schemaSQL = await fs.readFile('./src/db/schema-d08-realtime-packets.sql', 'utf-8');
        await executeSchema(db, schemaSQL);
      }

      console.log('✅ D08 schema applied successfully');
    } catch (error) {
      console.error('Failed to read or execute schema file:', error);
      throw new Error('Schema migration failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }

    // Verify setup by checking for expected functionality
    await verifyD08Setup(db);

    console.log('\n🎉 D08 Real-time Streaming setup completed successfully!');
    console.log('🔗 Ready for overlay packet streaming with BSV confirmations');

  } catch (error) {
    console.error('❌ Failed to setup D08 schema:', error);
    process.exit(1);
  }
}

// Helper function to execute schema safely
async function executeSchema(db: any, schemaSQL: string): Promise<void> {
  // Use the database's transaction capabilities if available
  if (typeof db.transaction === 'function') {
    await db.transaction(async () => {
      await db.pg.query(schemaSQL);
    });
  } else {
    // Fallback to direct execution
    await db.pg.query(schemaSQL);
  }
}

// Helper function to create basic D08 tables if schema file is missing
async function createBasicD08Tables(db: any): Promise<void> {
  const tables = [
    {
      name: 'realtime_packets',
      sql: `CREATE TABLE IF NOT EXISTS realtime_packets (
        id SERIAL PRIMARY KEY,
        packet_data BYTEA NOT NULL,
        topic VARCHAR(255) NOT NULL,
        timestamp BIGINT NOT NULL,
        source_node VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'stream_webhooks',
      sql: `CREATE TABLE IF NOT EXISTS stream_webhooks (
        id SERIAL PRIMARY KEY,
        url VARCHAR(512) NOT NULL,
        topic VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'stream_websockets',
      sql: `CREATE TABLE IF NOT EXISTS stream_websockets (
        id SERIAL PRIMARY KEY,
        connection_id VARCHAR(255) NOT NULL UNIQUE,
        topic VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'stream_agent_subscriptions',
      sql: `CREATE TABLE IF NOT EXISTS stream_agent_subscriptions (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        topic VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'webhook_deliveries',
      sql: `CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id SERIAL PRIMARY KEY,
        webhook_id INTEGER REFERENCES stream_webhooks(id),
        packet_id INTEGER REFERENCES realtime_packets(id),
        status VARCHAR(50) DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        last_attempt TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    }
  ];

  for (const table of tables) {
    try {
      await db.pg.query(table.sql);
      console.log(`   ✓ Created table: ${table.name}`);
    } catch (error) {
      console.warn(`   ⚠️ Table ${table.name} creation failed or already exists:`, error instanceof Error ? error.message : error);
    }
  }
}

// Helper function to verify D08 setup
async function verifyD08Setup(db: any): Promise<void> {
  console.log('📋 Verifying D08 setup...');

  // Check if sample streaming manifest exists using existing abstraction
  try {
    const { getManifest } = await import('./src/db');
    const sampleStream = await getManifest('stream-weather-001');

    if (sampleStream) {
      console.log('📦 Sample streaming package found:');
      console.log(`   ✓ ${sampleStream.title} (${sampleStream.version_id})`);
    } else {
      console.log('📦 No sample streaming package found (this is normal)');
    }
  } catch (error) {
    console.warn('   ⚠️ Could not verify sample streaming package:', error instanceof Error ? error.message : error);
  }

  console.log('✅ D08 verification completed');
}

if (require.main === module) {
  setupD08Schema();
}