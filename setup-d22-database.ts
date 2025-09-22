/**
 * Setup script for D22 overlay storage database schema
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';

async function setupD22Database() {
  const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'overlay',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password'
  });

  try {
    console.log('🗄️ Setting up D22 overlay storage database schema...');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'src/db/schema-d22-overlay-storage.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = schemaSql.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      try {
        await pool.query(statement);
        console.log('✅ Executed SQL statement successfully');
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
        AND table_name LIKE '%storage%'
        OR table_name LIKE '%uhrp%'
      ORDER BY table_name
    `);

    console.log('📋 D22 overlay storage tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    console.log('✅ D22 database schema setup completed successfully!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  setupD22Database().catch(console.error);
}

export default setupD22Database;