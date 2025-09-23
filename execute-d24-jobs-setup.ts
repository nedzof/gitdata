import { getPostgreSQLClient } from './src/db/postgresql';
import { readFileSync } from 'fs';

async function setupD24JobsTable() {
  const pgClient = getPostgreSQLClient();

  try {
    console.log('🔧 Creating D24 jobs table...');

    // Read and execute the SQL script
    const sql = readFileSync('./create-d24-jobs-table.sql', 'utf8');
    await pgClient.query(sql);

    console.log('✅ D24 jobs table created successfully!');

  } catch (error) {
    console.error('❌ Error creating D24 jobs table:', error);
  }
}

setupD24JobsTable();