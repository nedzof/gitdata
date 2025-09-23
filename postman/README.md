# BSV Overlay Network API - Postman Collections

This directory contains comprehensive Postman collections for testing the BSV Overlay Network API with full BRC standards integration.

## Collections

### 1. BSV-Overlay-Network-API.postman_collection.json
Main collection covering all overlay network functionality:

- **🚀 Quick Start**: Essential endpoints for getting started
- **🤖 Agent Marketplace (D24)**: Complete agent lifecycle management
- **📋 BRC-22 Job Orchestration**: Distributed job coordination
- **🔍 BRC-24 Service Discovery**: Service lookup and discovery
- **📦 BRC-26 UHRP Storage**: Universal Hash Resolution Protocol
- **🔐 BRC-31 Identity Verification**: Cryptographic identity management
- **📡 BRC-88 Service Advertisement**: SHIP/SLAP protocols
- **🗂️ Search & Discovery**: Enhanced content search
- **⚡ Real-time Events**: Event ingestion and streaming
- **📊 Monitoring & Health**: System health and metrics
- **🧪 End-to-End Workflows**: Complete integration scenarios

### 2. collection.postman_collection.json
Legacy E2E collection for backward compatibility

## Environments

### BSV-Overlay-Network.postman_environment.json
Local development environment with:
- `BASE_URL`: http://localhost:8788
- PostgreSQL and Redis configuration
- Test identity keys and webhook URLs
- Dynamic variables for agent/job/content tracking

### BSV-Overlay-Network-Production.postman_environment.json
Production environment template with:
- `BASE_URL`: https://api.overlay-network.com
- Production-ready configuration
- Placeholder values for secure deployment

### env.postman_environment.json
Legacy environment file for backward compatibility

## Quick Start

1. **Import Collections**:
   - Import `BSV-Overlay-Network-API.postman_collection.json`
   - Import your preferred environment file

2. **Configure Environment**:
   - Update `BASE_URL` to match your server
   - Set valid `IDENTITY_KEY` for BRC-31 operations
   - Configure `WEBHOOK_URL` for agent testing

3. **Run Health Check**:
   ```
   GET {{BASE_URL}}/overlay/health
   ```

4. **Test Agent Registration**:
   ```
   POST {{BASE_URL}}/overlay/agents/register
   ```

## Test Scenarios

### Basic Overlay Network Testing
1. Health Check → Status → Topics
2. Agent Registration → Search → Details
3. Rule Creation → Execution → Job Monitoring

### BRC Standards Integration
1. **BRC-22**: Job orchestration and distributed coordination
2. **BRC-24**: Service discovery and capability matching
3. **BRC-26**: Content storage and UHRP resolution
4. **BRC-31**: Identity verification and message signing
5. **BRC-88**: Service advertisement (SHIP/SLAP)

### End-to-End Workflows
1. **Agent Marketplace**: Complete agent lifecycle
2. **Data Processing Pipeline**: Multi-agent coordination
3. **Content Distribution**: Storage and retrieval
4. **Real-time Events**: Event ingestion and certification

## Environment Variables

### Core Configuration
- `BASE_URL`: API base URL
- `OVERLAY_ENABLED`: Enable overlay features
- `API_VERSION`: API version (v1)

### Identity & Security
- `IDENTITY_KEY`: BRC-31 identity key
- `WEBHOOK_URL`: Agent webhook endpoint

### Dynamic Variables (Auto-set)
- `agentId`: Current agent ID
- `ruleId`: Current rule ID
- `jobId`: Current job ID
- `contentHash`: Current content hash
- `versionId`: Current version ID
- `receiptId`: Current receipt ID

## Testing Best Practices

### 1. Environment Setup
```bash
# Start local services
docker-compose up -d postgres redis
npm run dev

# Set environment variables
OVERLAY_ENABLED=true
PG_HOST=localhost
PG_DATABASE=overlay
REDIS_URL=redis://localhost:6379
```

### 2. Agent Testing
- Always start with agent registration
- Use search to verify discovery
- Test capability matching
- Monitor performance metrics

### 3. BRC Standards Compliance
- Verify BRC-31 signature validation
- Test BRC-22 job orchestration
- Validate BRC-26 content resolution
- Check BRC-88 service advertisements

### 4. Error Handling
- Test with invalid parameters
- Verify graceful degradation
- Check error message clarity
- Validate status codes

## Newman CLI Usage

### Run Complete Test Suite
```bash
npm install -g newman

# Local environment
newman run BSV-Overlay-Network-API.postman_collection.json \
  -e BSV-Overlay-Network.postman_environment.json \
  --reporters cli,junit,htmlextra \
  --delay-request 250

# Production environment
newman run BSV-Overlay-Network-API.postman_collection.json \
  -e BSV-Overlay-Network-Production.postman_environment.json \
  --delay-request 500
```

### Run Specific Folders
```bash
# Test only agent marketplace
newman run BSV-Overlay-Network-API.postman_collection.json \
  -e BSV-Overlay-Network.postman_environment.json \
  --folder "🤖 Agent Marketplace (D24)"

# Test BRC standards
newman run BSV-Overlay-Network-API.postman_collection.json \
  -e BSV-Overlay-Network.postman_environment.json \
  --folder "📋 BRC-22 Job Orchestration"
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run API Tests
  run: |
    newman run postman/BSV-Overlay-Network-API.postman_collection.json \
      -e postman/BSV-Overlay-Network.postman_environment.json \
      --reporters junit \
      --reporter-junit-export test-results.xml
```

### Docker Testing
```bash
docker run --rm -v $(pwd)/postman:/workspace \
  postman/newman:latest run BSV-Overlay-Network-API.postman_collection.json \
  -e BSV-Overlay-Network.postman_environment.json
```

## Advanced Features

### Dynamic Data Generation
- Uses Postman's `{{$randomFirstName}}` for agent names
- Auto-generates timestamps for nonces
- Creates unique IDs for testing

### Variable Chaining
- Captures IDs from responses
- Chains requests using environment variables
- Maintains state across test runs

### Comprehensive Validation
- Status code verification
- Response schema validation
- BRC standards compliance checks
- Performance threshold testing

## Troubleshooting

### Common Issues

1. **Overlay Network Unavailable**
   - Check `OVERLAY_ENABLED=true` in environment
   - Verify BSV wallet connection
   - Test overlay service health

2. **Agent Registration Failures**
   - Validate webhook URL accessibility
   - Check BRC-31 identity key format
   - Verify geographic region settings

3. **Job Execution Timeouts**
   - Increase delay between requests
   - Check agent availability
   - Monitor overlay network latency

### Debug Mode
```bash
# Run with verbose logging
newman run BSV-Overlay-Network-API.postman_collection.json \
  -e BSV-Overlay-Network.postman_environment.json \
  --verbose
```

## Contributing

When adding new endpoints:

1. **Follow Naming Convention**: Use emojis and descriptive names
2. **Add Comprehensive Tests**: Include status, schema, and business logic validation
3. **Update Environment**: Add new variables as needed
4. **Document Changes**: Update this README with new scenarios

## Related Documentation

- [BSV Overlay Network Documentation](../docs/)
- [BRC Standards Specifications](../docs/BRCs/)
- [Agent Marketplace Guide](../issues/D24-agent-marketplace-automation.md)
- [API Documentation](../issues/D20-docs-postman.md)