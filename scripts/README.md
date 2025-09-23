# Scripts Directory

This directory contains utility scripts for the BSV Overlay Network project.

## Directory Structure

### `/setup/`
Contains database setup and data population scripts:
- `setup-d08-realtime-streaming.ts` - Sets up D08 real-time streaming schema and tables
- `populate-market-data.ts` - Populates sample marketplace data for testing
- `clean-policy-structured-data.ts` - Cleans up policy data structures

### `/testing/`
Contains test scripts and simulations:
- `test-iot-to-ai-workflow.ts` - End-to-end test from IoT device to AI agent via overlay network
- `simulate-iot-producer.ts` - Simulates IoT temperature sensor producing real-time data
- `demo-pdf-workflow.ts` - Demonstrates PDF processing workflow through the overlay

## Usage

All scripts should be run from the project root directory with proper environment variables:

```bash
# Setup script example
PG_HOST=localhost PG_PORT=5432 PG_DATABASE=overlay PG_USER=postgres PG_PASSWORD="password" REDIS_URL=redis://localhost:6379 npx tsx scripts/setup/setup-d08-realtime-streaming.ts

# Testing script example
PG_HOST=localhost PG_PORT=5432 PG_DATABASE=overlay PG_USER=postgres PG_PASSWORD="password" REDIS_URL=redis://localhost:6379 npx tsx scripts/testing/test-iot-to-ai-workflow.ts
```

## Integration Features Tested

- BSV Overlay Network for data transport
- D07 streaming delivery with quota tracking
- D08 real-time packet confirmation system
- AI agent webhook notification system
- Real-time statistics and monitoring
- IoT device simulation and data streaming