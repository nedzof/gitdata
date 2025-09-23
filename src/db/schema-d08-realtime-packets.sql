-- D08 Real-time Overlay Packet Streaming Extensions
-- Extends D07 streaming with real-time packet confirmation and delivery

-- Extend manifests for streaming packages
ALTER TABLE manifests ADD COLUMN IF NOT EXISTS is_streaming BOOLEAN DEFAULT FALSE;
ALTER TABLE manifests ADD COLUMN IF NOT EXISTS stream_config JSONB DEFAULT '{}';
ALTER TABLE manifests ADD COLUMN IF NOT EXISTS producer_public_key TEXT;

-- Stream metadata for producer management
CREATE TABLE IF NOT EXISTS stream_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id VARCHAR(64) NOT NULL,
  producer_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  tags JSONB,
  price_per_packet INTEGER DEFAULT 0,
  last_packet_sequence BIGINT DEFAULT 0,
  last_packet_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(version_id, producer_id)
);

-- Real-time data packets (each packet is an overlay transaction)
CREATE TABLE IF NOT EXISTS realtime_packets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id VARCHAR(64) NOT NULL, -- Links to manifests.version_id

    -- Packet identification
    packet_sequence BIGINT NOT NULL,
    packet_timestamp TIMESTAMP DEFAULT NOW(),

    -- BSV Overlay transaction
    txid VARCHAR(64) NOT NULL,
    overlay_data BYTEA NOT NULL,
    data_hash VARCHAR(64) NOT NULL,

    -- Confirmation tracking
    confirmation_status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, failed
    confirmations INTEGER DEFAULT 0,
    block_height INTEGER,
    confirmed_at TIMESTAMP,

    -- Data payload (any JSON data)
    data_payload JSONB NOT NULL,
    data_size_bytes INTEGER NOT NULL,
    producer_public_key VARCHAR(66) NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(version_id, packet_sequence)
);

-- Stream webhook subscriptions
CREATE TABLE IF NOT EXISTS stream_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id VARCHAR(64) NOT NULL,

    -- Webhook configuration
    webhook_url TEXT NOT NULL,
    webhook_secret VARCHAR(64),
    subscriber_id VARCHAR(100) NOT NULL,

    -- Delivery settings
    delivery_mode VARCHAR(20) DEFAULT 'confirmed', -- confirmed, immediate, both
    min_confirmations INTEGER DEFAULT 1,
    batch_size INTEGER DEFAULT 1,

    -- Status tracking
    status VARCHAR(20) DEFAULT 'active',
    last_delivery TIMESTAMP,
    total_deliveries BIGINT DEFAULT 0,
    failed_deliveries BIGINT DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW()
);

-- WebSocket connections for real-time streaming
CREATE TABLE IF NOT EXISTS stream_websockets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id VARCHAR(64) UNIQUE NOT NULL,
    version_id VARCHAR(64) NOT NULL,

    -- Connection details
    subscriber_id VARCHAR(100),
    delivery_mode VARCHAR(20) DEFAULT 'confirmed',
    last_packet_sent BIGINT DEFAULT 0,

    -- Status
    connected_at TIMESTAMP DEFAULT NOW(),
    last_ping TIMESTAMP DEFAULT NOW(),
    packets_sent BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW()
);

-- Agent subscriptions to streams
CREATE TABLE IF NOT EXISTS stream_agent_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,

    -- Processing configuration
    processing_mode VARCHAR(20) DEFAULT 'realtime',
    trigger_conditions JSONB,
    last_processed_packet BIGINT DEFAULT 0,

    -- Agent callback
    agent_webhook_url TEXT,

    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(version_id, agent_id)
);

-- Webhook delivery tracking
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID REFERENCES stream_webhooks(id),
    packet_id UUID REFERENCES realtime_packets(id),

    -- Delivery details
    delivery_attempt INTEGER NOT NULL,
    http_status INTEGER,
    response_time_ms INTEGER,

    -- Status and retry
    status VARCHAR(20) NOT NULL, -- success, failed, retry
    error_message TEXT,
    retry_at TIMESTAMP,

    attempted_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_realtime_packets_version_seq ON realtime_packets(version_id, packet_sequence);
CREATE INDEX IF NOT EXISTS idx_realtime_packets_txid ON realtime_packets(txid);
CREATE INDEX IF NOT EXISTS idx_realtime_packets_status ON realtime_packets(confirmation_status);
CREATE INDEX IF NOT EXISTS idx_realtime_packets_timestamp ON realtime_packets(packet_timestamp);

CREATE INDEX IF NOT EXISTS idx_stream_webhooks_version ON stream_webhooks(version_id);
CREATE INDEX IF NOT EXISTS idx_stream_webhooks_subscriber ON stream_webhooks(subscriber_id);

CREATE INDEX IF NOT EXISTS idx_stream_websockets_version ON stream_websockets(version_id);
CREATE INDEX IF NOT EXISTS idx_stream_websockets_status ON stream_websockets(status);

CREATE INDEX IF NOT EXISTS idx_stream_agents_version ON stream_agent_subscriptions(version_id);
CREATE INDEX IF NOT EXISTS idx_stream_agents_agent ON stream_agent_subscriptions(agent_id);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_packet ON webhook_deliveries(packet_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(retry_at) WHERE status = 'retry';

-- Sample streaming data package
INSERT INTO manifests (
    version_id, dataset_id, title, license, classification,
    content_hash, manifest_hash, is_streaming, stream_config, manifest_json
)
SELECT
    'stream-weather-001',
    'weather-stream-dataset',
    'Real-time Weather Data Stream',
    'CC-BY-4.0',
    'public',
    'weather-stream-hash',
    'manifest-weather-hash',
    TRUE,
    '{"packet_frequency": 60000, "price_per_packet": 2}'::jsonb,
    '{"version": "1.0", "type": "streaming", "metadata": {"title": "Real-time Weather Data Stream"}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM manifests WHERE version_id = 'stream-weather-001');