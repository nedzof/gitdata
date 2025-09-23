/**
 * Check if streaming test data exists in the database
 */

import { getHybridDatabase } from './src/db/hybrid.js';

async function checkStreamingData() {
  const db = getHybridDatabase();

  try {
    console.log('🔍 Checking streaming data in database...');

    // Check streaming manifests
    const manifestsResult = await db.pg.query(
      'SELECT version_id, title, is_streaming, stream_config FROM manifests WHERE is_streaming = true LIMIT 5'
    );

    console.log(`\n📦 Found ${manifestsResult.rows.length} streaming manifests:`);
    manifestsResult.rows.forEach(row => {
      console.log(`  - ${row.version_id}: ${row.title}`);
      try {
        const config = JSON.parse(row.stream_config || '{}');
        console.log(`    Price per packet: ${config.price_per_packet || 'unknown'}`);
        console.log(`    Packet frequency: ${config.packet_frequency || 'unknown'}ms`);
      } catch (e) {
        console.log(`    Stream config: ${row.stream_config || 'null'}`);
      }
    });

    // Check stream metadata
    const metadataResult = await db.pg.query(
      'SELECT version_id, producer_id, status, last_packet_sequence, last_packet_at FROM stream_metadata LIMIT 5'
    );

    console.log(`\n📊 Found ${metadataResult.rows.length} stream metadata entries:`);
    metadataResult.rows.forEach(row => {
      console.log(`  - ${row.version_id}: ${row.status} (seq: ${row.last_packet_sequence})`);
      console.log(`    Producer: ${row.producer_id}`);
      console.log(`    Last packet: ${row.last_packet_at}`);
    });

    // Check realtime packets
    const packetsResult = await db.pg.query(
      'SELECT version_id, packet_sequence, packet_timestamp, data_size_bytes FROM realtime_packets ORDER BY packet_timestamp DESC LIMIT 10'
    );

    console.log(`\n📡 Found ${packetsResult.rows.length} realtime packets:`);
    packetsResult.rows.forEach(row => {
      console.log(`  - ${row.version_id} seq ${row.packet_sequence}: ${row.data_size_bytes} bytes`);
      console.log(`    Timestamp: ${row.packet_timestamp}`);
    });

    // Check webhooks
    const webhooksResult = await db.pg.query(
      'SELECT version_id, webhook_url, subscriber_id, status FROM stream_webhooks LIMIT 5'
    );

    console.log(`\n🔗 Found ${webhooksResult.rows.length} webhook subscriptions:`);
    webhooksResult.rows.forEach(row => {
      console.log(`  - ${row.version_id}: ${row.subscriber_id} (${row.status})`);
      console.log(`    URL: ${row.webhook_url}`);
    });

    console.log('\n✅ Database check complete!');
    console.log('\n🌐 Visit http://localhost:5173/market to see streaming items!');

  } catch (error) {
    console.error('❌ Error checking streaming data:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkStreamingData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { checkStreamingData };