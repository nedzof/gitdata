/**
 * Populate test streaming data for marketplace integration testing
 */

import { getHybridDatabase } from '../src/db/hybrid.js';

async function populateStreamingTestData() {
  const db = getHybridDatabase();

  try {
    console.log('🔄 Creating test streaming data...');

    // Insert streaming manifests
    const streamingManifests = [
      {
        version_id: 'stream-001-weather-sensors',
        dataset_id: 'weather-sensors-001',
        title: 'Live Weather Sensor Network',
        license: 'CC-BY-4.0',
        classification: 'public',
        created_at: new Date().toISOString(),
        manifest_json: JSON.stringify({
          version: '1.0',
          type: 'streaming',
          metadata: {
            title: 'Live Weather Sensor Network',
            mediaType: 'application/x-stream',
            category: 'weather',
            producer: 'WeatherNet Labs'
          }
        }),
        content_hash: 'weather-stream-hash',
        manifest_hash: 'manifest-weather-hash',
        is_streaming: true,
        stream_config: JSON.stringify({ packet_frequency: 30000, price_per_packet: 0.001 })
      },
      {
        version_id: 'stream-002-crypto-prices',
        dataset_id: 'crypto-prices-002',
        title: 'Cryptocurrency Price Feed',
        license: 'MIT',
        classification: 'public',
        created_at: new Date().toISOString(),
        manifest_json: JSON.stringify({
          version: '1.0',
          type: 'streaming',
          metadata: {
            title: 'Cryptocurrency Price Feed',
            mediaType: 'application/x-stream',
            category: 'finance',
            producer: 'CryptoStream Inc'
          }
        }),
        content_hash: 'crypto-stream-hash',
        manifest_hash: 'manifest-crypto-hash',
        is_streaming: true,
        stream_config: JSON.stringify({ packet_frequency: 5000, price_per_packet: 0.002 })
      },
      {
        version_id: 'stream-003-social-sentiment',
        dataset_id: 'social-sentiment-003',
        title: 'Social Media Sentiment Stream',
        license: 'Apache-2.0',
        classification: 'public',
        created_at: new Date().toISOString(),
        manifest_json: JSON.stringify({
          version: '1.0',
          type: 'streaming',
          metadata: {
            title: 'Social Media Sentiment Stream',
            mediaType: 'application/x-stream',
            category: 'social',
            producer: 'SentimentAI Corp'
          }
        }),
        content_hash: 'social-stream-hash',
        manifest_hash: 'manifest-social-hash',
        is_streaming: true,
        stream_config: JSON.stringify({ packet_frequency: 60000, price_per_packet: 0.0015 })
      },
      {
        version_id: 'stream-004-traffic-data',
        dataset_id: 'traffic-data-004',
        title: 'City Traffic Flow Monitor',
        license: 'GPL-3.0',
        classification: 'public',
        created_at: new Date().toISOString(),
        manifest_json: JSON.stringify({
          version: '1.0',
          type: 'streaming',
          metadata: {
            title: 'City Traffic Flow Monitor',
            mediaType: 'application/x-stream',
            category: 'transportation',
            producer: 'SmartCity Solutions'
          }
        }),
        content_hash: 'traffic-stream-hash',
        manifest_hash: 'manifest-traffic-hash',
        is_streaming: true,
        stream_config: JSON.stringify({ packet_frequency: 120000, price_per_packet: 0.0008 })
      }
    ];

    // Insert manifests
    for (const manifest of streamingManifests) {
      await db.pg.query(`
        INSERT INTO manifests (
          version_id, dataset_id, title, license, classification, created_at,
          manifest_json, content_hash, manifest_hash, is_streaming, stream_config
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (version_id) DO UPDATE SET
          title = EXCLUDED.title,
          is_streaming = EXCLUDED.is_streaming,
          stream_config = EXCLUDED.stream_config
      `, [
        manifest.version_id,
        manifest.dataset_id,
        manifest.title,
        manifest.license,
        manifest.classification,
        manifest.created_at,
        manifest.manifest_json,
        manifest.content_hash,
        manifest.manifest_hash,
        manifest.is_streaming,
        manifest.stream_config
      ]);
    }

    // Insert stream metadata
    const streamMetadata = [
      {
        version_id: 'stream-001-weather-sensors',
        producer_id: 'WeatherNet Labs',
        status: 'active',
        tags: JSON.stringify(['weather', 'iot', 'sensors', 'real-time']),
        price_per_packet: 1,
        last_packet_sequence: 12452,
        last_packet_at: new Date().toISOString()
      },
      {
        version_id: 'stream-002-crypto-prices',
        producer_id: 'CryptoStream Inc',
        status: 'active',
        tags: JSON.stringify(['crypto', 'finance', 'prices', 'trading']),
        price_per_packet: 2,
        last_packet_sequence: 8921,
        last_packet_at: new Date(Date.now() - 30000).toISOString() // 30 seconds ago
      },
      {
        version_id: 'stream-003-social-sentiment',
        producer_id: 'SentimentAI Corp',
        status: 'active',
        tags: JSON.stringify(['social', 'sentiment', 'ai', 'nlp']),
        price_per_packet: 1,
        last_packet_sequence: 5671,
        last_packet_at: new Date(Date.now() - 60000).toISOString() // 1 minute ago
      },
      {
        version_id: 'stream-004-traffic-data',
        producer_id: 'SmartCity Solutions',
        status: 'paused',
        tags: JSON.stringify(['traffic', 'transportation', 'smart-city']),
        price_per_packet: 1,
        last_packet_sequence: 3450,
        last_packet_at: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
      }
    ];

    for (const metadata of streamMetadata) {
      await db.pg.query(`
        INSERT INTO stream_metadata (version_id, producer_id, status, tags, price_per_packet, last_packet_sequence, last_packet_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (version_id, producer_id) DO UPDATE SET
          status = EXCLUDED.status,
          last_packet_sequence = EXCLUDED.last_packet_sequence,
          last_packet_at = EXCLUDED.last_packet_at
      `, [
        metadata.version_id,
        metadata.producer_id,
        metadata.status,
        metadata.tags,
        metadata.price_per_packet,
        metadata.last_packet_sequence,
        metadata.last_packet_at
      ]);
    }

    // Insert some realtime packets to show activity
    const packets = [
      // Weather stream packets
      { version_id: 'stream-001-weather-sensors', sequence: 12450, packets_today: 24680 },
      { version_id: 'stream-001-weather-sensors', sequence: 12451, packets_today: 24681 },
      { version_id: 'stream-001-weather-sensors', sequence: 12452, packets_today: 24682 },

      // Crypto stream packets
      { version_id: 'stream-002-crypto-prices', sequence: 8920, packets_today: 15340 },
      { version_id: 'stream-002-crypto-prices', sequence: 8921, packets_today: 15341 },

      // Sentiment stream packets
      { version_id: 'stream-003-social-sentiment', sequence: 5670, packets_today: 9200 },
      { version_id: 'stream-003-social-sentiment', sequence: 5671, packets_today: 9201 },

      // Traffic stream packets (fewer due to paused status)
      { version_id: 'stream-004-traffic-data', sequence: 3450, packets_today: 4800 }
    ];

    for (const packet of packets) {
      const packetTime = new Date(Date.now() - Math.random() * 3600000); // Random time in last hour
      const dataSize = 1024 + Math.floor(Math.random() * 2048); // Random size 1-3KB
      await db.pg.query(`
        INSERT INTO realtime_packets (
          version_id, packet_sequence, packet_timestamp, txid, overlay_data,
          data_hash, confirmation_status, confirmations, data_payload,
          data_size_bytes, producer_public_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (version_id, packet_sequence) DO NOTHING
      `, [
        packet.version_id,
        packet.sequence,
        packetTime.toISOString(),
        'mock-tx-' + packet.version_id + '-' + packet.sequence,
        Buffer.from(JSON.stringify({ type: 'test', data: 'mock-overlay-data' })),
        'mock-hash-' + packet.sequence,
        'confirmed',
        3,
        JSON.stringify({
          timestamp: packetTime.toISOString(),
          value: Math.random() * 100,
          metadata: { packets_today: packet.packets_today }
        }),
        dataSize,
        'mock-public-key-' + packet.version_id
      ]);
    }

    // Add some webhook subscribers to show activity
    const webhooks = [
      {
        version_id: 'stream-001-weather-sensors',
        webhook_url: 'https://api.weatherapp.com/webhook',
        subscriber_id: 'weather-app-001',
        status: 'active'
      },
      {
        version_id: 'stream-001-weather-sensors',
        webhook_url: 'https://alerts.climateai.com/stream',
        subscriber_id: 'climate-ai-002',
        status: 'active'
      },
      {
        version_id: 'stream-002-crypto-prices',
        webhook_url: 'https://trading.bot/crypto-feed',
        subscriber_id: 'trading-bot-001',
        status: 'active'
      },
      {
        version_id: 'stream-003-social-sentiment',
        webhook_url: 'https://analytics.socialmedia.com/sentiment',
        subscriber_id: 'social-analytics-001',
        status: 'active'
      }
    ];

    for (const webhook of webhooks) {
      await db.pg.query(`
        INSERT INTO stream_webhooks (
          version_id, webhook_url, subscriber_id, status,
          delivery_mode, min_confirmations, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [
        webhook.version_id,
        webhook.webhook_url,
        webhook.subscriber_id,
        webhook.status,
        'confirmed',
        1,
        new Date().toISOString()
      ]);
    }

    console.log('✅ Successfully created test streaming data:');
    console.log('   - 4 streaming packages with live indicators');
    console.log('   - Packet activity for today');
    console.log('   - Active webhook subscribers');
    console.log('   - Mixed active/paused stream statuses');
    console.log('');
    console.log('🌐 Visit the marketplace at http://localhost:5173/market to see streaming items!');
    console.log('   Look for items with 🔴 LIVE indicators and packet counts');

  } catch (error) {
    console.error('❌ Error creating test streaming data:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  populateStreamingTestData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { populateStreamingTestData };