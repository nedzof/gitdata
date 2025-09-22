import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'overlay',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'password',
});

async function cleanupQuotaData() {
  try {
    console.log('🧹 Cleaning up corrupted quota data...');

    await pool.query('DELETE FROM quota_usage_windows');
    console.log('✅ Cleared quota_usage_windows');

    await pool.query('DELETE FROM streaming_usage');
    console.log('✅ Cleared streaming_usage');

    console.log('🎉 Quota data cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await pool.end();
  }
}

cleanupQuotaData();