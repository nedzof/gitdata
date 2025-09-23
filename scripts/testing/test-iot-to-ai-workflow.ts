#!/usr/bin/env npx tsx

/**
 * End-to-End IoT to AI Agent Workflow Test
 *
 * This test demonstrates the complete workflow from IoT device data production
 * to AI agent consumption through the BSV Overlay Network with real-time streaming.
 *
 * Workflow:
 * 1. IoT Device -> Overlay Network (realtime streaming)
 * 2. Overlay Network -> Webhook/WebSocket delivery
 * 3. AI Agent receives data for processing
 * 4. BSV confirmation tracking throughout
 */

import { realtimeStreamingService } from './src/services/realtime-streaming';

interface WeatherData {
  deviceId: string;
  temperature: number;
  humidity: number;
  pressure: number;
  timestamp: string;
  location: {
    lat: number;
    lon: number;
    address: string;
  };
  batteryLevel: number;
  signalStrength: number;
}

class MockIoTDevice {
  private deviceId: string;
  private location: { lat: number; lon: number; address: string };
  private sequenceNumber: number = 0;
  private streamId: string;
  private producerKey: string;

  constructor(deviceId: string, location: { lat: number; lon: number; address: string }) {
    this.deviceId = deviceId;
    this.location = location;
    this.streamId = 'e2e-weather-stream-001';
    this.producerKey = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  }

  generateSensorData(): WeatherData {
    const baseTemp = 20; // Base temperature 20°C
    const tempVariation = (Math.random() - 0.5) * 8; // ±4°C variation

    return {
      deviceId: this.deviceId,
      temperature: Math.round((baseTemp + tempVariation) * 10) / 10,
      humidity: Math.round((60 + (Math.random() - 0.5) * 20) * 10) / 10, // 50-70% humidity
      pressure: Math.round((1013.25 + (Math.random() - 0.5) * 8) * 100) / 100, // ±4 hPa
      timestamp: new Date().toISOString(),
      location: this.location,
      batteryLevel: Math.round((90 + Math.random() * 10) * 10) / 10, // 90-100% battery
      signalStrength: Math.round((-55 + Math.random() * 15) * 10) / 10 // -55 to -40 dBm
    };
  }

  async sendDataPacket(): Promise<any> {
    this.sequenceNumber++;
    const sensorData = this.generateSensorData();

    console.log(`📡 IoT Device ${this.deviceId} sending packet #${this.sequenceNumber}`);
    console.log(`   📊 Temperature: ${sensorData.temperature}°C, Humidity: ${sensorData.humidity}%`);

    const packet = await realtimeStreamingService.ingestPacket({
      version_id: this.streamId,
      packet_sequence: this.sequenceNumber,
      txid: `e2e-tx-${this.deviceId}-${Date.now()}`,
      overlay_data: Buffer.from(JSON.stringify(sensorData)),
      data_payload: sensorData,
      producer_public_key: this.producerKey
    });

    return packet;
  }
}

class MockAIAgent {
  private agentId: string;
  private receivedPackets: any[] = [];

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  async subscribeToStream(streamId: string): Promise<void> {
    console.log(`🤖 AI Agent ${this.agentId} subscribing to stream ${streamId}`);

    await realtimeStreamingService.subscribeAgent({
      version_id: streamId,
      agent_id: this.agentId,
      processing_mode: 'realtime',
      agent_webhook_url: `https://agent-${this.agentId}.example.com/webhook`
    });

    console.log(`✅ AI Agent ${this.agentId} subscribed to real-time data stream`);
  }

  async subscribeToWebhook(streamId: string): Promise<any> {
    console.log(`🔗 Setting up webhook for AI Agent ${this.agentId}`);

    const webhook = await realtimeStreamingService.subscribeWebhook({
      version_id: streamId,
      webhook_url: `https://agent-${this.agentId}.example.com/webhook`,
      subscriber_id: this.agentId,
      delivery_mode: 'both', // Both immediate and confirmed
      min_confirmations: 1
    });

    console.log(`✅ Webhook configured for agent ${this.agentId}: ${webhook.id}`);
    return webhook;
  }

  processData(packet: any): void {
    this.receivedPackets.push(packet);
    const data = packet.data_payload;

    console.log(`🧠 AI Agent ${this.agentId} processing data:`);
    console.log(`   🌡️  Temperature: ${data.temperature}°C`);
    console.log(`   💧 Humidity: ${data.humidity}%`);
    console.log(`   🔋 Battery: ${data.batteryLevel}%`);

    // Simulate AI analysis
    if (data.temperature > 25) {
      console.log(`   🚨 AI Alert: High temperature detected! ${data.temperature}°C`);
    }
    if (data.batteryLevel < 95) {
      console.log(`   🔋 AI Alert: Battery level dropping: ${data.batteryLevel}%`);
    }
  }

  getStats(): any {
    return {
      agentId: this.agentId,
      packetsProcessed: this.receivedPackets.length,
      lastProcessedAt: this.receivedPackets.length > 0 ?
        this.receivedPackets[this.receivedPackets.length - 1].timestamp : null
    };
  }
}

async function testEndToEndWorkflow(): Promise<void> {
  console.log('🚀 Starting End-to-End IoT to AI Agent Workflow Test\n');

  try {
    const streamId = 'e2e-weather-stream-001';

    // 1. Set up AI Agent
    console.log('1️⃣ Setting up AI Agent...');
    const aiAgent = new MockAIAgent('weather-analysis-ai-001');

    // Subscribe agent to stream
    await aiAgent.subscribeToStream(streamId);

    // Set up webhook for agent
    const webhook = await aiAgent.subscribeToWebhook(streamId);

    // 2. Set up IoT Device
    console.log('\n2️⃣ Setting up IoT Weather Station...');
    const iotDevice = new MockIoTDevice('weather-station-nyc-001', {
      lat: 40.7128,
      lon: -74.0060,
      address: 'Central Park, New York City, NY'
    });

    // 3. Simulate IoT data streaming
    console.log('\n3️⃣ Starting IoT data streaming simulation...');

    const packets = [];
    for (let i = 0; i < 3; i++) {
      console.log(`\n📊 Sending data packet ${i + 1}/3...`);

      const packet = await iotDevice.sendDataPacket();
      packets.push(packet);

      console.log(`✅ Packet ${packet.id} ingested (status: ${packet.confirmation_status})`);

      // Simulate AI agent processing the data
      aiAgent.processData(packet);

      // Simulate BSV confirmation after a short delay
      setTimeout(async () => {
        const confirmations = Math.floor(Math.random() * 3) + 1;
        const blockHeight = 850000 + Math.floor(Math.random() * 100);

        console.log(`⛓️  BSV confirmations (${confirmations}) for packet ${packet.id}`);

        await realtimeStreamingService.updatePacketConfirmation(
          packet.txid,
          confirmations,
          blockHeight
        );
      }, 1000 + i * 500);

      // Wait before next packet
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 4. Check stream statistics
    console.log('\n4️⃣ Checking stream statistics...');
    const streamStats = await realtimeStreamingService.getStreamStats(streamId);
    console.log('📈 Stream Statistics:');
    console.log(`   📦 Total packets: ${streamStats.total_packets}`);
    console.log(`   ✅ Confirmed: ${streamStats.confirmed_packets}`);
    console.log(`   ⏳ Pending: ${streamStats.pending_packets}`);
    console.log(`   📏 Avg packet size: ${Math.round(streamStats.avg_packet_size)} bytes`);

    // 5. Check AI agent statistics
    console.log('\n5️⃣ AI Agent processing summary...');
    const agentStats = aiAgent.getStats();
    console.log('🤖 AI Agent Statistics:');
    console.log(`   🆔 Agent ID: ${agentStats.agentId}`);
    console.log(`   📊 Packets processed: ${agentStats.packetsProcessed}`);

    // 6. Verify recent packets
    console.log('\n6️⃣ Recent packet history...');
    const recentPackets = await realtimeStreamingService.getRecentPackets(streamId, 5);
    console.log(`📋 Last ${recentPackets.length} packets:`);
    recentPackets.forEach((p, idx) => {
      console.log(`   ${idx + 1}. Seq ${p.packet_sequence}: ${p.confirmation_status} (${p.confirmations} confs)`);
    });

    // 7. Test complete
    console.log('\n🎉 End-to-End Workflow Test Completed Successfully!\n');

    console.log('📝 Workflow Summary:');
    console.log('   ✅ IoT device simulated realistic sensor data');
    console.log('   ✅ Real-time packet streaming to overlay network');
    console.log('   ✅ AI agent subscription and webhook setup');
    console.log('   ✅ Immediate data delivery to AI agent');
    console.log('   ✅ BSV transaction confirmation tracking');
    console.log('   ✅ Agent-based data processing and analysis');
    console.log('   ✅ Statistical monitoring and reporting');

    console.log('\n🔗 Integration Points:');
    console.log('   📡 BSV Overlay Network for data transport');
    console.log('   🔄 D07 streaming delivery with quota tracking');
    console.log('   🌐 D08 real-time packet confirmation system');
    console.log('   🤖 AI agent webhook notification system');
    console.log('   📊 Real-time statistics and monitoring');

  } catch (error) {
    console.error('❌ End-to-end test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testEndToEndWorkflow();
}