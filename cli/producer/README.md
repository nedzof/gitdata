# BSV Overlay Network Producer CLI (D15)

A comprehensive TypeScript-based CLI tool for producing data and services on the BSV Overlay Network, leveraging the complete BRC stack for enterprise-grade functionality.

## Features

### Complete BRC Stack Integration
- **BRC-31**: Identity Authentication with cryptographic signatures
- **BRC-88**: SHIP/SLAP Service Advertisement
- **BRC-22**: Transaction Submission to BSV Network
- **BRC-26**: UHRP Content Publishing and Distribution
- **BRC-24**: Service Registration with lookup services
- **BRC-64**: Usage Analytics and History Tracking
- **BRC-41**: PacketPay HTTP Micropayments Reception
- **D21**: BSV Native Payments with ARC Integration
- **D22**: Multi-node Storage Backend Distribution

### Producer Capabilities
- **Service Advertisement**: Advertise capabilities via SHIP/SLAP protocols
- **Content Publishing**: Publish datasets with UHRP addressing and integrity verification
- **Live Streaming**: Create and manage real-time data streams with micropayments
- **Payment Reception**: Accept both HTTP micropayments and native BSV transactions
- **Multi-node Distribution**: Distribute content across overlay network nodes
- **Analytics Dashboard**: Comprehensive business intelligence and reporting
- **Consumer Management**: Track relationships and payment history

## Installation

### Prerequisites
- Node.js 16.0 or higher
- PostgreSQL database
- Access to BSV Overlay Network

### Install Dependencies
```bash
cd cli/producer
npm install
```

### Database Setup
1. Create PostgreSQL database for producer data:
```sql
CREATE DATABASE overlay_producer;
```

2. Set environment variables:
```bash
export OVERLAY_URL="http://localhost:3000"
export DATABASE_URL="postgresql://user:password@localhost/overlay_producer"
export PRODUCER_IDENTITY_FILE="./producer_identity.key"
```

## Quick Start

### 1. Initialize Producer Identity
```bash
node producer.js identity setup \
  --generate-key \
  --display-name "Financial Data Provider" \
  --description "Real-time market data and analytics" \
  --register-overlay
```

### 2. Advertise Services
```bash
node producer.js advertise create \
  --service-type "data-feed" \
  --capability "market-data" \
  --pricing-model "per-request" \
  --rate 100 \
  --max-consumers 1000 \
  --availability "99.9%"
```

### 3. Publish Dataset
```bash
node producer.js publish dataset \
  --file "./datasets/btc_historical_2024.json" \
  --title "Bitcoin Historical Data 2024" \
  --description "1-minute OHLCV data for Bitcoin 2024" \
  --tags "bitcoin,historical,ohlcv" \
  --price 5000
```

### 4. Setup Payment Reception
```bash
node producer.js payments setup \
  --enable-http \
  --enable-d21 \
  --min-payment 1 \
  --max-payment 100000 \
  --auto-settle
```

### 5. Create Live Stream
```bash
node producer.js stream create \
  --stream-id "btc_live_ticker" \
  --title "Bitcoin Live Price Feed" \
  --format "json" \
  --update-frequency 1000 \
  --price-per-minute 10
```

## CLI Commands

### Identity Management
```bash
# Setup producer identity
node producer.js identity setup \
  --generate-key \
  --display-name "Premium Data Corp" \
  --register-overlay \
  --backup-key "./identity_backup.key"

# Verify identity and reputation
node producer.js identity verify \
  --check-reputation \
  --validate-advertisements \
  --test-payment-endpoints

# Rotate identity key
node producer.js identity rotate \
  --generate-new \
  --transition-period "7d" \
  --notify-consumers
```

### Producer Registration
```bash
# Register with full BRC stack
node producer.js register \
  --name "CryptoMarkets Pro" \
  --description "Professional cryptocurrency market data and analytics" \
  --capabilities "market-data,analytics,streaming,historical-data" \
  --regions "global" \
  --generate-identity \
  --advertise-on-overlay
```

### Service Advertisement
```bash
# Create service advertisement
node producer.js advertise create \
  --service-type "data-feed" \
  --capability "crypto-price-feeds" \
  --pricing-model "per-minute" \
  --rate 20 \
  --availability "99.9%" \
  --max-consumers 5000 \
  --geographic-scope "global"

# Update existing advertisement
node producer.js advertise update \
  --advertisement-id "ad_12345" \
  --new-rate 25 \
  --increase-capacity 1000
```

### Content Publishing
```bash
# Publish single dataset
node producer.js publish dataset \
  --file "./data/premium_analytics.json" \
  --title "Premium Analytics Dataset" \
  --description "Advanced market analytics and predictions" \
  --tags "analytics,premium,predictions" \
  --price 10000 \
  --license "commercial" \
  --distribute-nodes 5

# Batch publish multiple files
node producer.js publish batch \
  --directory "./datasets/" \
  --pattern "*.json" \
  --base-price 2500 \
  --auto-generate-descriptions \
  --parallel-uploads 5

# Publish with D21 native payments
node producer.js publish dataset \
  --file "./data/exclusive_data.json" \
  --payment-method "d21-native" \
  --split-rules '{"overlay": 0.1, "producer": 0.85, "agents": 0.05}' \
  --arc-provider "taal"
```

### Live Streaming
```bash
# Create live data stream
node producer.js stream create \
  --stream-id "btc_live" \
  --title "Bitcoin Real-time Price Feed" \
  --format "json" \
  --update-frequency 100 \
  --price-per-minute 15 \
  --max-consumers 2000 \
  --quality "ultra-high"

# Start streaming service
node producer.js stream start \
  --stream-id "btc_live" \
  --source "websocket://stream.binance.com:9443/ws/btcusdt@ticker" \
  --enable-historical-buffer "24h" \
  --redundancy 5

# Update stream configuration
node producer.js stream update \
  --stream-id "btc_live" \
  --increase-frequency 50 \
  --add-consumer-capacity 500
```

### Payment Configuration
```bash
# Setup HTTP micropayments (BRC-41)
node producer.js payments setup \
  --enable-http \
  --min-payment 10 \
  --max-payment 10000 \
  --payment-window "1h" \
  --auto-settle

# Enable D21 native BSV payments
node producer.js payments setup-native \
  --enable-d21 \
  --arc-providers "taal,gorillapool" \
  --default-splits '{"overlay": 0.1, "producer": 0.9}' \
  --template-expiry "24h"

# Configure payment routing
node producer.js payments configure-routing \
  --route-small-payments "http" \
  --route-large-payments "d21-native" \
  --threshold 50000 \
  --auto-convert-rates
```

### Content Distribution
```bash
# Distribute content across nodes
node producer.js distribute content \
  --content-hash "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" \
  --target-nodes "node1.overlay.com,node2.overlay.com,node3.overlay.com" \
  --replication-factor 3 \
  --geographic-distribution "global"

# Setup automatic distribution rules
node producer.js distribute setup-rules \
  --rule-name "global-financial-data" \
  --content-filter '{"tags": ["financial"], "size": {"max": "100MB"}}' \
  --min-nodes 5 \
  --geographic-spread "all-regions" \
  --auto-scale
```

### Analytics & Reporting
```bash
# View producer analytics
node producer.js analytics view \
  --period "30d" \
  --metrics "revenue,downloads,streaming_hours,consumer_satisfaction" \
  --export-format "json" \
  --include-forecasts

# Track specific events
node producer.js analytics track \
  --event "dataset-download" \
  --resource-id "btc_historical_2024" \
  --consumer-id "cons_12345" \
  --revenue 5000 \
  --metadata '{"source": "api", "quality": "high"}'

# Generate comprehensive reports
node producer.js analytics report \
  --type "monthly-revenue" \
  --period "2024-09" \
  --breakdown-by "service,region,payment_method" \
  --export "./reports/september_2024.pdf"
```

### Dashboard & Management
```bash
# Generate producer dashboard
node producer.js dashboard \
  --include-charts \
  --real-time-metrics \
  --export-html "./dashboard.html" \
  --auto-refresh 30

# Manage consumer relationships
node producer.js manage consumers \
  --list-active \
  --show-payment-status \
  --identify-high-value-customers \
  --export-csv "consumers.csv"

# Service optimization
node producer.js optimize \
  --analyze-performance \
  --recommend-pricing \
  --suggest-improvements \
  --auto-apply-safe-changes
```

## Configuration

### Environment Variables
```bash
# Required
export OVERLAY_URL="http://localhost:3000"
export DATABASE_URL="postgresql://user:pass@localhost/overlay_producer"

# Optional
export PRODUCER_IDENTITY_FILE="./producer_identity.key"
export DEFAULT_REGION="global"
export MAX_REVENUE_SPLITS="10"
export DEBUG="false"
```

### Configuration File
Create `producer_config.json`:
```json
{
  "overlayUrl": "http://localhost:3000",
  "databaseUrl": "postgresql://user:pass@localhost/overlay_producer",
  "identityFile": "./producer_identity.key",
  "defaultRegion": "global",
  "maxRevenueSplits": 10,
  "preferences": {
    "autoAdvertise": true,
    "autoDistribute": true,
    "enableAnalytics": true
  }
}
```

Use with: `node producer.js --config producer_config.json [command]`

## Real-World Usage Examples

### Financial Data Producer Setup
```bash
#!/bin/bash
# Complete financial data producer setup

# 1. Setup producer identity
node producer.js identity setup \
  --generate-key \
  --display-name "CryptoMarkets Pro" \
  --description "Professional cryptocurrency market data and analytics" \
  --register-overlay

# 2. Register with capabilities
node producer.js register \
  --name "CryptoMarkets Pro" \
  --capabilities "market-data,analytics,streaming,historical-data" \
  --regions "global" \
  --advertise-on-overlay

# 3. Setup payment reception
node producer.js payments setup \
  --enable-http \
  --enable-d21 \
  --min-payment 1 \
  --max-payment 100000 \
  --split-rules '{"overlay": 0.05, "producer": 0.95}'

# 4. Publish historical datasets
node producer.js publish batch \
  --directory "./historical_data/" \
  --pattern "crypto_*.json" \
  --base-price 2500 \
  --tags "crypto,historical,ohlcv" \
  --distribute-globally \
  --parallel-uploads 5

# 5. Create live streams
node producer.js stream create \
  --stream-id "btc_live" \
  --title "Bitcoin Real-time Price Feed" \
  --format "json" \
  --update-frequency 100 \
  --price-per-minute 15 \
  --max-consumers 2000

# 6. Start streaming
node producer.js stream start \
  --stream-id "btc_live" \
  --source "websocket://stream.binance.com:9443/ws/btcusdt@ticker" \
  --enable-historical-buffer "24h"

# 7. Generate dashboard
node producer.js dashboard \
  --include-real-time-metrics \
  --export-html "./dashboard.html"
```

### IoT Data Producer
```bash
#!/bin/bash
# IoT sensor data producer

# Setup IoT producer
node producer.js register \
  --name "IoT Sensor Network" \
  --description "Industrial IoT sensor data and analytics" \
  --capabilities "sensor-data,environmental,industrial" \
  --regions "US,EU"

# Create multiple sensor streams
node producer.js stream create \
  --stream-id "temp_sensors" \
  --title "Temperature Sensor Network" \
  --format "json" \
  --update-frequency 5000 \
  --price-per-minute 5

node producer.js stream create \
  --stream-id "humidity_sensors" \
  --title "Humidity Sensor Network" \
  --format "json" \
  --update-frequency 5000 \
  --price-per-minute 5

# Setup tiered pricing
node producer.js payments setup \
  --enable-http \
  --route-small-payments "http" \
  --route-large-payments "d21-native" \
  --threshold 10000
```

## Database Schema

The producer CLI uses a comprehensive PostgreSQL schema:

- **producer_identities**: Identity and profile management
- **producer_advertisements**: BRC-88 service advertisements
- **published_content**: BRC-26 content records
- **producer_streams**: Live streaming services
- **producer_consumers**: Consumer relationship management
- **producer_revenue**: Payment and revenue tracking
- **producer_analytics**: BRC-64 analytics events
- **content_distribution**: D22 multi-node distribution

All tables include appropriate indexes for optimal performance.

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
# Start overlay network first
npm run dev

# Run integration tests
npm run test:integration
```

### Test Coverage
```bash
npm run test:coverage
```

## Architecture

### BRC Integration Flow
```
Producer CLI
├── BRC-31 Identity Management
├── BRC-88 Service Advertisement
├── BRC-22 Transaction Submission
├── BRC-26 Content Publishing
├── BRC-24 Service Registration
├── BRC-64 Analytics Tracking
├── BRC-41 Payment Reception
├── D21 Native BSV Payments
└── D22 Multi-node Distribution
```

### Service Architecture
- **CLI Layer**: Command-line interface with comprehensive commands
- **BRC Integration Layer**: Individual BRC standard implementations
- **Orchestration Layer**: Cross-BRC workflow management
- **Database Layer**: PostgreSQL persistence and analytics
- **Network Layer**: HTTP/WebSocket communication with overlay network

## Security Considerations

- **Identity Protection**: Private keys are stored encrypted locally
- **Payment Security**: Revenue splitting and confirmation requirements
- **Content Verification**: Automatic integrity checking with SHA-256
- **Access Control**: BRC-31 signature-based authentication
- **Audit Logging**: Comprehensive activity tracking for compliance

## Performance Optimizations

- **Database Connection Pooling**: Efficient PostgreSQL connections
- **Advertisement Caching**: TTL-based service advertisement caching
- **Batch Analytics**: Efficient event logging and reporting
- **Stream Optimization**: WebSocket connection management
- **Content Distribution**: Multi-node replication for availability

## Troubleshooting

### Common Issues

1. **Identity Not Found**
   ```bash
   # Regenerate identity
   node producer.js identity setup --generate-key --force
   ```

2. **Database Connection Failed**
   ```bash
   # Check database URL
   echo $DATABASE_URL

   # Test connection
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Overlay Network Unreachable**
   ```bash
   # Test connectivity
   curl $OVERLAY_URL/health

   # Check all BRC components
   node producer.js identity verify --test-payment-endpoints
   ```

4. **Advertisement Not Propagating**
   ```bash
   # Check advertisement status
   node producer.js advertise list --show-metrics

   # Update advertisement
   node producer.js advertise update --advertisement-id "ad_123" --refresh
   ```

### Debug Mode
Enable detailed logging:
```bash
node producer.js --debug [command]
```

Or set environment variable:
```bash
export DEBUG=true
node producer.js [command]
```

## License

This implementation is part of the BSV Overlay Network project and follows the project's licensing terms.

## Support

For issues and support:
1. Check the troubleshooting section
2. Run with `--debug` for detailed logs
3. Verify BRC stack health with identity verify
4. Contact the overlay network support team

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Ensure all tests pass
5. Submit a pull request

## Changelog

### v1.0.0
- Complete D15 Producer CLI implementation
- Full BRC stack integration (9 standards)
- Comprehensive database schema
- Real-time streaming support
- Multi-node content distribution
- Analytics dashboard
- Complete test suite