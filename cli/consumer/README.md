# BSV Overlay Network Consumer CLI (D14)

A comprehensive Python-based CLI tool for consuming data and services on the BSV Overlay Network, leveraging the complete BRC stack for enterprise-grade functionality.

## Features

### Complete BRC Stack Integration
- **BRC-31**: Identity Authentication with cryptographic signatures
- **BRC-24**: Service Discovery & Content Lookup
- **BRC-88**: SHIP/SLAP Service Advertisement Discovery
- **BRC-41**: PacketPay HTTP Micropayments
- **BRC-26**: UHRP Content Storage Access
- **BRC-22**: Transaction Submission to BSV Network
- **BRC-64**: History Tracking & Usage Analytics
- **D21**: BSV Native Payments with ARC Integration
- **D22**: Multi-node Storage Backend Access

### Consumer Capabilities
- **Service Discovery**: Find producers by capability, region, and price
- **Content Access**: Download files via UHRP with integrity verification
- **Live Streaming**: Subscribe to real-time data feeds with micropayments
- **Payment Management**: HTTP micropayments and native BSV transactions
- **Usage Analytics**: Comprehensive consumption tracking and reporting
- **Multi-producer Support**: Aggregate data from multiple sources
- **Ready Validation**: CI/CD integration for deployment readiness

## Installation

### Prerequisites
- Python 3.8 or higher
- PostgreSQL database
- Access to BSV Overlay Network

### Install Dependencies
```bash
cd cli/consumer
pip install -r requirements.txt
```

### Database Setup
1. Create PostgreSQL database for consumer data:
```sql
CREATE DATABASE overlay_consumer;
```

2. Set environment variables:
```bash
export DATABASE_URL="postgresql://user:password@localhost/overlay_consumer"
export OVERLAY_URL="http://localhost:3000"
```

## Quick Start

### 1. Initialize Consumer Identity
```bash
python overlay-consumer-cli.py identity setup --generate-key --register-overlay
```

### 2. Discover Available Services
```bash
python overlay-consumer-cli.py discover --capability="market-data" --region="US" --max-price=1000
```

### 3. Subscribe to Live Stream
```bash
python overlay-consumer-cli.py subscribe \
  --producer-id="binance_feed_official" \
  --stream-id="btc_usdt_ticker" \
  --payment-method="http" \
  --max-price-per-minute=10 \
  --duration="1hour"
```

### 4. Purchase and Download Data
```bash
python overlay-consumer-cli.py purchase \
  --dataset-id="btc_1min_candles_2024" \
  --payment-method="d21-native" \
  --amount=50000 \
  --download-immediately
```

### 5. View Usage History
```bash
python overlay-consumer-cli.py history --days=30 --show-costs --export-format="csv"
```

## CLI Commands

### Identity Management
```bash
# Setup new identity
python overlay-consumer-cli.py identity setup --generate-key --register-overlay

# Verify identity status
python overlay-consumer-cli.py identity verify --check-reputation
```

### Service Discovery
```bash
# Discover services by capability
python overlay-consumer-cli.py discover --capability="financial-data" --region="US" --max-price=1000

# Find streaming services
python overlay-consumer-cli.py discover --type="stream" --topic="market-data"

# Find specific producer
python overlay-consumer-cli.py discover --producer-id="prod_12345" --show-capabilities
```

### Content Access
```bash
# Search content
python overlay-consumer-cli.py search \
  --content-type="application/json" \
  --tags="real-time,market-data" \
  --producer="producer_123" \
  --max-price=500

# Download content
python overlay-consumer-cli.py download \
  --uhrp-hash="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" \
  --verify-integrity \
  --output="./downloads/market_data.json"
```

### Payments
```bash
# Create payment quote
python overlay-consumer-cli.py quote \
  --provider="producer_123" \
  --service-type="content-access" \
  --resource-id="dataset_abc" \
  --expected-cost=1000

# Submit payment
python overlay-consumer-cli.py pay \
  --quote-id="quote_123" \
  --confirm \
  --wait-for-confirmation

# Native BSV payment
python overlay-consumer-cli.py purchase \
  --dataset-id="premium_data" \
  --payment-method="d21-native" \
  --amount=100000 \
  --arc-provider="taal"
```

### Streaming & Subscriptions
```bash
# Subscribe to real-time stream
python overlay-consumer-cli.py subscribe \
  --producer-id="data_provider_123" \
  --stream-id="live_prices" \
  --payment-method="http" \
  --max-price-per-minute=50 \
  --duration="24hours"

# Stream content to stdout
python overlay-consumer-cli.py stream \
  --subscription-id="sub_12345" \
  --format="json" \
  --output="stdout"
```

### Analytics & History
```bash
# View consumption history
python overlay-consumer-cli.py history \
  --days=30 \
  --show-costs \
  --export-format="csv" \
  --output="consumption_report.csv"

# Track specific usage
python overlay-consumer-cli.py track \
  --resource-id="dataset_abc123" \
  --action="download" \
  --metadata='{"source": "cli", "version": "1.0"}'

# Generate analytics report
python overlay-consumer-cli.py analytics \
  --time-range="7d" \
  --include-cost-analysis \
  --include-producer-breakdown
```

### Ready Check (CI/CD Integration)
```bash
# Basic ready check
python overlay-consumer-cli.py ready \
  --version-id="v1.2.3" \
  --policy='{"min_confirmations": 3, "max_age_hours": 24}' \
  --exit-code-on-failure

# Extended ready check with BRC validation
python overlay-consumer-cli.py ready \
  --version-id="v1.2.3" \
  --validate-brc-stack \
  --check-overlay-connectivity \
  --verify-payment-endpoints
```

## Configuration

### Environment Variables
```bash
# Required
export OVERLAY_URL="http://localhost:3000"
export DATABASE_URL="postgresql://user:pass@localhost/overlay_consumer"

# Optional
export CONSUMER_IDENTITY_FILE="./consumer_identity.json"
export PAYMENT_METHOD="http"
export MAX_BUDGET_PER_HOUR="10000"
export DEFAULT_REGION="global"
export DEBUG="false"
```

### Configuration File
Create `consumer_config.json`:
```json
{
  "overlay_url": "http://localhost:3000",
  "database_url": "postgresql://user:pass@localhost/overlay_consumer",
  "identity_file": "./consumer_identity.json",
  "payment_method": "http",
  "max_budget_per_hour": 10000,
  "default_region": "global",
  "preferences": {
    "auto_pay": true,
    "verify_content": true,
    "cache_content": true
  }
}
```

Use with: `python overlay-consumer-cli.py --config=consumer_config.json [command]`

## Real-World Usage Examples

### Financial Data Consumer
```bash
#!/bin/bash
# Financial data consumer workflow

# 1. Setup consumer identity
python overlay-consumer-cli.py identity setup --generate-key --register-overlay

# 2. Discover financial data providers
python overlay-consumer-cli.py discover \
  --capability="market-data" \
  --region="global" \
  --max-price=100 \
  --min-reputation=0.8

# 3. Subscribe to real-time BTC price feed
python overlay-consumer-cli.py subscribe \
  --producer-id="binance_feed_official" \
  --stream-id="btc_usdt_ticker" \
  --payment-method="http" \
  --max-price-per-minute=10 \
  --duration="1hour"

# 4. Purchase historical data
python overlay-consumer-cli.py purchase \
  --dataset-id="btc_1min_candles_2024" \
  --payment-method="d21-native" \
  --amount=50000 \
  --download-immediately

# 5. Monitor consumption and costs
python overlay-consumer-cli.py history --days=1 --show-costs --export-csv="consumption_report.csv"
```

### IoT Data Consumer
```bash
#!/bin/bash
# IoT sensor data consumer

# Discover IoT data providers
python overlay-consumer-cli.py discover \
  --capability="sensor-data" \
  --region="US-West" \
  --service-type="real-time"

# Subscribe to multiple sensor streams
python overlay-consumer-cli.py subscribe \
  --producer-id="iot_provider_123" \
  --stream-id="temperature_sensors" \
  --payment-method="http" \
  --max-price-per-minute=5

python overlay-consumer-cli.py subscribe \
  --producer-id="iot_provider_123" \
  --stream-id="humidity_sensors" \
  --payment-method="http" \
  --max-price-per-minute=5

# Stream aggregated data to file
python overlay-consumer-cli.py stream \
  --subscription-id="multi_sensor_stream" \
  --output="./sensor_data.jsonl" \
  --duration="24hours"
```

## Testing

### Unit Tests
```bash
cd cli/consumer
python -m pytest tests/ -v
```

### Integration Tests
```bash
# Start overlay network first
npm run dev

# Run integration tests
python -m pytest tests/test_consumer_cli.py::TestConsumerCLI -v
```

### Manual Testing
```bash
# Test service discovery
python overlay-consumer-cli.py discover --capability="test" --debug

# Test ready check
python overlay-consumer-cli.py ready --version-id="test" --validate-brc-stack
```

## Troubleshooting

### Common Issues

1. **Identity Not Found**
   ```bash
   # Regenerate identity
   python overlay-consumer-cli.py identity setup --generate-key --register-overlay --force
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

   # Check service status
   python overlay-consumer-cli.py ready --validate-brc-stack
   ```

4. **Payment Failed**
   ```bash
   # Check payment methods
   python overlay-consumer-cli.py identity verify --check-reputation

   # Validate wallet capability
   python overlay-consumer-cli.py wallet status --check-balance
   ```

### Debug Mode
Enable detailed logging:
```bash
python overlay-consumer-cli.py --debug [command]
```

Or set environment variable:
```bash
export DEBUG=true
python overlay-consumer-cli.py [command]
```

## Architecture

### BRC Integration Flow
```
Consumer CLI
├── BRC-31 Identity Management
├── BRC-88 Service Discovery
├── BRC-24 Content Lookup
├── BRC-41 Micropayments
├── BRC-26 Content Access
├── BRC-22 Transaction Submission
├── BRC-64 Usage Analytics
├── D21 Native BSV Payments
└── D22 Multi-node Storage
```

### Database Schema
- **consumer_identities**: Identity and preferences
- **consumer_subscriptions**: Active service subscriptions
- **consumer_payments**: Payment history and receipts
- **consumer_content_access**: Content access records
- **consumer_usage_events**: Analytics and tracking data
- **discovered_services**: Cached service information

## Security Considerations

- **Identity Protection**: Private keys are stored encrypted locally
- **Payment Security**: Budget limits and confirmation requirements
- **Content Verification**: Automatic integrity checking with SHA-256
- **Access Control**: BRC-31 signature-based authentication
- **Audit Logging**: Comprehensive activity tracking for compliance

## Performance

- **Concurrent Operations**: Async/await for non-blocking I/O
- **Database Pooling**: Connection pooling for optimal performance
- **Content Caching**: Local caching to reduce network usage
- **Service Discovery Cache**: Cached service information with TTL
- **Batch Analytics**: Efficient event logging and reporting

## License

This implementation is part of the BSV Overlay Network project and follows the project's licensing terms.

## Support

For issues and support:
1. Check the troubleshooting section
2. Run with `--debug` for detailed logs
3. Verify BRC stack health with ready check
4. Contact the overlay network support team