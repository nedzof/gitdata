import { getPostgreSQLClient } from './src/db/postgresql';

async function checkTables() {
  const pgClient = getPostgreSQLClient();

  try {
    console.log('📋 Checking available tables after legacy removal...');

    const result = await pgClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('✅ Available tables:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Check specifically for jobs and templates related tables
    console.log('\n🔍 Looking for jobs and templates tables:');
    const jobsTables = result.rows.filter(row => row.table_name.includes('job'));
    const templatesTables = result.rows.filter(row =>
      row.table_name.includes('template') ||
      row.table_name.includes('contract') ||
      row.table_name.includes('asset')
    );

    console.log('Jobs related:', jobsTables.map(t => t.table_name));
    console.log('Templates/Assets related:', templatesTables.map(t => t.table_name));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTables();