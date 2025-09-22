/**
 * Setup script for D06 BSV Overlay Network Payment Processing & Revenue Management
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';

async function setupD06Payments() {
  const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'overlay',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password'
  });

  try {
    console.log('💰 Setting up D06 BSV Overlay Network Payment Processing & Revenue Management...');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'src/db/schema-d06-payments.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = schemaSql.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      try {
        await pool.query(statement);
        console.log('✅ Executed D06 SQL statement successfully');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠️ Object already exists, skipping...');
        } else {
          console.error('❌ SQL Error:', error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
        }
      }
    }

    // Verify tables were created
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE '%payment%'
        OR table_name LIKE '%receipt%'
        OR table_name LIKE '%revenue%'
        OR table_name LIKE '%agent%payment%'
        OR table_name LIKE '%overlay_receipt%'
        OR table_name LIKE '%settlement%'
        OR table_name LIKE '%bsv%')
      ORDER BY table_name
    `);

    console.log('📋 D06 payment and revenue management tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check views
    const viewsResult = await pool.query(`
      SELECT table_name as view_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND (table_name LIKE '%revenue%'
        OR table_name LIKE '%payment%'
        OR table_name LIKE '%agent%')
      ORDER BY table_name
    `);

    if (viewsResult.rows.length > 0) {
      console.log('📊 D06 analytics views:');
      viewsResult.rows.forEach(row => {
        console.log(`  - ${row.view_name}`);
      });
    }

    // Insert test data if in development environment
    if (process.env.NODE_ENV === 'development') {
      console.log('🧪 Inserting test data for development...');

      // Insert test payment identity
      await pool.query(`
        INSERT INTO payment_identities (identity_key, verification_level, trust_score, payment_history_count)
        VALUES ('03test123456789abcdef0123456789abcdef0123456789abcdef01234567', 'verified', 0.85, 5)
        ON CONFLICT (identity_key) DO NOTHING
      `);

      // Insert test payment method
      await pool.query(`
        INSERT INTO payment_methods (method_name, network, is_active, min_confirmation_depth)
        VALUES ('bsv-test', 'bsv-test', true, 1)
        ON CONFLICT (method_name) DO NOTHING
      `);

      console.log('✅ Test data inserted successfully');
    }

    console.log('✅ D06 BSV Overlay Network Payment Processing & Revenue Management setup completed successfully!');

  } catch (error) {
    console.error('❌ D06 database setup failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  setupD06Payments().catch(console.error);
}

export default setupD06Payments;