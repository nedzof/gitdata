import { getPostgreSQLClient } from './src/db/postgresql';
import { readFileSync } from 'fs';

async function removeLegacyTables() {
  const pgClient = getPostgreSQLClient();

  try {
    console.log('🗑️ Starting legacy table removal as recommended in corrections.md...');

    // Read the SQL script
    const sql = readFileSync('./remove-legacy-tables.sql', 'utf8');

    // Execute the removal
    await pgClient.query(sql);

    console.log('✅ Legacy tables successfully removed!');
    console.log('📋 Removed tables:');
    console.log('   - receipts');
    console.log('   - declarations');
    console.log('   - manifests');
    console.log('   - edges');
    console.log('   - prices');
    console.log('   - revenue_events');
    console.log('   - price_rules');
    console.log('   - advisories');
    console.log('   - advisory_targets');
    console.log('   - rules');
    console.log('   - jobs');
    console.log('   - contract_templates');
    console.log('   - artifacts');

  } catch (error) {
    console.error('❌ Error removing legacy tables:', error);
  }
}

removeLegacyTables();