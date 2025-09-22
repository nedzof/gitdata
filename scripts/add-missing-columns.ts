#!/usr/bin/env npx tsx

import { getHybridDatabase } from '../src/db/hybrid.ts';

async function addMissingColumns() {
  const db = getHybridDatabase();

  console.log('Adding missing database columns...');

  try {
    // Add relationship_type column to edges table
    try {
      await db.pg.query(`
        ALTER TABLE edges
        ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(50) DEFAULT 'derived'
      `);
      console.log('✓ Added relationship_type column to edges table');
    } catch (error) {
      console.log('⚠ relationship_type column already exists or error:', error.message);
    }

    // Add created_at column to edges table
    try {
      await db.pg.query(`
        ALTER TABLE edges
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✓ Added created_at column to edges table');
    } catch (error) {
      console.log('⚠ created_at column already exists or error:', error.message);
    }

    // Update existing edges with default relationship type
    try {
      await db.pg.query(`
        UPDATE edges
        SET relationship_type = 'derived'
        WHERE relationship_type IS NULL
      `);
      console.log('✓ Updated existing edges with default relationship type');
    } catch (error) {
      console.log('⚠ Error updating edges:', error.message);
    }

    // Check if advisories table exists, if not create it
    try {
      await db.pg.query(`
        CREATE TABLE IF NOT EXISTS advisories (
          id SERIAL PRIMARY KEY,
          version_id VARCHAR(64) NOT NULL,
          type VARCHAR(50) NOT NULL,
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(version_id, type)
        )
      `);
      console.log('✓ Ensured advisories table exists');
    } catch (error) {
      console.log('⚠ Error with advisories table:', error.message);
    }

    console.log('✅ Database schema updates completed!');

  } catch (error) {
    console.error('❌ Error updating database schema:', error);
    throw error;
  }
}

if (require.main === module) {
  addMissingColumns()
    .then(() => {
      console.log('\n🎉 Schema updates completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to update schema:', error);
      process.exit(1);
    });
}

export { addMissingColumns };