/**
 * Apply the complete integrated schema
 * This replaces all piecemeal schema applications
 */

import { getHybridDatabase } from '../src/db/hybrid.js';
import fs from 'fs';

async function applyCompleteSchema() {
  const db = getHybridDatabase();

  try {
    console.log('🔄 Applying complete integrated schema...');

    // Drop all overlay tables first to ensure clean state
    await db.pg.query(`
      DROP TABLE IF EXISTS webhook_deliveries CASCADE;
      DROP TABLE IF EXISTS stream_websockets CASCADE;
      DROP TABLE IF EXISTS overlay_jobs CASCADE;
      DROP TABLE IF EXISTS overlay_rules CASCADE;
      DROP TABLE IF EXISTS overlay_agents CASCADE;
      DROP TABLE IF EXISTS agent_streaming_sessions CASCADE;
      DROP TABLE IF EXISTS delivery_optimization CASCADE;
      DROP TABLE IF EXISTS uhrp_host_performance CASCADE;
      DROP TABLE IF EXISTS quota_usage_windows CASCADE;
      DROP TABLE IF EXISTS streaming_usage CASCADE;
      DROP TABLE IF EXISTS stream_webhooks CASCADE;
      DROP TABLE IF EXISTS realtime_packets CASCADE;
      DROP TABLE IF EXISTS stream_metadata CASCADE;
      DROP TABLE IF EXISTS storage_verifications CASCADE;
      DROP TABLE IF EXISTS overlay_storage_index CASCADE;
      DROP TABLE IF EXISTS quota_policies CASCADE;
      DROP TABLE IF EXISTS payment_events CASCADE;
      DROP TABLE IF EXISTS payment_identities CASCADE;
      DROP TABLE IF EXISTS overlay_receipts CASCADE;
    `);
    console.log('✅ Cleaned up existing overlay tables');

    // Apply the complete schema
    const completeSchema = fs.readFileSync('./src/db/postgresql-schema-complete.sql', 'utf8');
    await db.pg.query(completeSchema);
    console.log('✅ Complete integrated schema applied successfully!');

    console.log('🎉 All schemas integrated and ready for testing');

  } catch (error) {
    console.error('❌ Error applying complete schema:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  applyCompleteSchema()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { applyCompleteSchema };