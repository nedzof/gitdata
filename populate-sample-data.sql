-- Sample data population for automatic Docker setup
-- This file is automatically loaded during database initialization

-- Add missing category column
ALTER TABLE manifests ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Insert sample datasets for immediate market visibility
INSERT INTO manifests (version_id, manifest_hash, content_hash, title, license, classification, dataset_id, producer_id, manifest_json, category) VALUES
('data-finance-001', 'hash-finance-1', 'content-finance-1', 'Financial Market Data', 'MIT', 'public', 'finance-dataset', 'producer-1', '{"type": "dataset", "category": "finance", "tags": ["stocks", "trading"], "description": "Real-time financial market data including stock prices, trading volumes, and market indicators"}', 'finance'),
('data-weather-002', 'hash-weather-2', 'content-weather-2', 'Global Weather Patterns', 'CC-BY', 'public', 'weather-dataset', 'producer-2', '{"type": "dataset", "category": "weather", "tags": ["climate", "meteorology"], "description": "Comprehensive weather data from global monitoring stations"}', 'weather'),
('data-social-003', 'hash-social-3', 'content-social-3', 'Social Media Analytics', 'GPL-3.0', 'public', 'social-dataset', 'producer-3', '{"type": "dataset", "category": "social", "tags": ["sentiment", "analytics"], "description": "Social media sentiment analysis and engagement metrics"}', 'social'),
('data-iot-004', 'hash-iot-4', 'content-iot-4', 'IoT Sensor Networks', 'Apache-2.0', 'public', 'iot-dataset', 'producer-4', '{"type": "dataset", "category": "iot", "tags": ["sensors", "telemetry"], "description": "Industrial IoT sensor data from manufacturing and smart city deployments"}', 'iot'),
('data-health-005', 'hash-health-5', 'content-health-5', 'Medical Research Data', 'CC-BY-NC', 'public', 'health-dataset', 'producer-5', '{"type": "dataset", "category": "health", "tags": ["medical", "research"], "description": "Anonymized medical research datasets for healthcare analytics"}', 'health'),
('data-crypto-006', 'hash-crypto-6', 'content-crypto-6', 'Cryptocurrency Trading Data', 'MIT', 'public', 'crypto-dataset', 'producer-6', '{"type": "dataset", "category": "crypto", "tags": ["bitcoin", "blockchain"], "description": "Bitcoin and cryptocurrency trading data with technical indicators"}', 'crypto'),
('data-retail-007', 'hash-retail-7', 'content-retail-7', 'E-commerce Analytics', 'CC-BY', 'public', 'retail-dataset', 'producer-7', '{"type": "dataset", "category": "retail", "tags": ["sales", "analytics"], "description": "E-commerce sales data and customer behavior analytics"}', 'retail'),
('data-transport-008', 'hash-transport-8', 'content-transport-8', 'Transportation Networks', 'Apache-2.0', 'public', 'transport-dataset', 'producer-8', '{"type": "dataset", "category": "transport", "tags": ["logistics", "gps"], "description": "Transportation and logistics data including GPS tracking and delivery metrics"}', 'transport');

-- Add some prices for the datasets
INSERT INTO prices (version_id, satoshis) VALUES
('data-finance-001', 1000),
('data-weather-002', 500),
('data-social-003', 750),
('data-iot-004', 1200),
('data-health-005', 2000),
('data-crypto-006', 800),
('data-retail-007', 600),
('data-transport-008', 900);

-- Update the streaming data to have category
UPDATE manifests SET category = 'weather' WHERE version_id = 'stream-weather-001';