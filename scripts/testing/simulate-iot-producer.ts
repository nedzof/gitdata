#!/usr/bin/env npx tsx

/**
 * IoT Device Producer Simulation
 *
 * Simulates an IoT device (temperature sensor) that:
 * 1. Generates sensor data every few seconds
 * 2. Sends data packets to the overlay network
 * 3. Each packet gets confirmed on-chain via microtransactions
 */

import { realtimeStreamingService } from './src/services/realtime-streaming';

interface TemperatureSensorData {
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

class IoTTemperatureSensor {
  private deviceId: string;
  private location: { lat: number; lon: number; address: string };
  private sequenceNumber: number = 0;
  private isRunning: boolean = false;
  private streamId: string;
  private producerKey: string;

  constructor(deviceId: string, location: { lat: number; lon: number; address: string }) {
    this.deviceId = deviceId;
    this.location = location;
    this.streamId = 'iot-temperature-stream-001';
    this.producerKey = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  }

  /**
   * Generate realistic sensor data with some randomness
   */
  private generateSensorData(): TemperatureSensorData {
    const baseTemp = 22; // Base temperature 22°C
    const tempVariation = (Math.random() - 0.5) * 10; // ±5°C variation

    return {
      deviceId: this.deviceId,
      temperature: Math.round((baseTemp + tempVariation) * 10) / 10,
      humidity: Math.round((65 + (Math.random() - 0.5) * 20) * 10) / 10, // 55-75% humidity
      pressure: Math.round((1013.25 + (Math.random() - 0.5) * 10) * 100) / 100, // ±5 hPa
      timestamp: new Date().toISOString(),
      location: this.location,
      batteryLevel: Math.round((85 + Math.random() * 15) * 10) / 10, // 85-100% battery
      signalStrength: Math.round((-60 + Math.random() * 20) * 10) / 10 // -60 to -40 dBm
    };
  }

  /**
   * Send sensor data as overlay packet
   */
  private async sendDataPacket(): Promise<void> {
    try {
      this.sequenceNumber++;
      const sensorData = this.generateSensorData();

      console.log(`📡 IoT Device ${this.deviceId} sending packet #${this.sequenceNumber}`);
      console.log(`   Temperature: ${sensorData.temperature}°C`);
      console.log(`   Humidity: ${sensorData.humidity}%`);
      console.log(`   Battery: ${sensorData.batteryLevel}%`);

      // Send to overlay network for real-time streaming
      const packet = await realtimeStreamingService.ingestPacket({
        version_id: this.streamId,
        packet_sequence: this.sequenceNumber,
        txid: `iot-tx-${this.deviceId}-${Date.now()}`,
        overlay_data: Buffer.from(JSON.stringify(sensorData)),
        data_payload: sensorData,
        producer_public_key: this.producerKey
      });

      console.log(`✅ Packet ingested with ID: ${packet.id}`);

      // Simulate BSV confirmation after a short delay
      setTimeout(async () => {
        const confirmations = Math.floor(Math.random() * 3) + 1; // 1-3 confirmations
        const blockHeight = 850000 + Math.floor(Math.random() * 100);

        console.log(`⛓️  Simulating ${confirmations} BSV confirmations for packet ${packet.id}`);

        await realtimeStreamingService.updatePacketConfirmation(
          packet.txid,
          confirmations,
          blockHeight
        );

        console.log(`✅ Packet ${packet.id} confirmed on-chain`);
      }, 2000 + Math.random() * 3000); // 2-5 second delay for confirmation

    } catch (error) {
      console.error(`❌ Failed to send IoT data packet:`, error);
    }
  }

  /**
   * Start the IoT device simulation
   */
  async start(intervalMs: number = 5000): Promise<void> {
    console.log(`🌡️  Starting IoT Temperature Sensor: ${this.deviceId}`);
    console.log(`📍 Location: ${this.location.address}`);
    console.log(`📊 Streaming to: ${this.streamId}`);
    console.log(`⏱️  Update interval: ${intervalMs}ms\n`);

    this.isRunning = true;

    // Send initial packet
    await this.sendDataPacket();

    // Set up periodic data sending
    const interval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }
      await this.sendDataPacket();
    }, intervalMs);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down IoT device...');
      this.isRunning = false;
      clearInterval(interval);
      process.exit(0);
    });
  }

  /**
   * Stop the IoT device simulation
   */
  stop(): void {
    this.isRunning = false;
    console.log(`🛑 IoT Device ${this.deviceId} stopped`);
  }
}

async function runIoTSimulation(): Promise<void> {
  try {
    // Create IoT temperature sensor
    const sensor = new IoTTemperatureSensor(
      'temp-sensor-001',
      {
        lat: 40.7128,
        lon: -74.0060,
        address: 'New York City, NY'
      }
    );

    // Start streaming sensor data every 5 seconds
    await sensor.start(5000);

  } catch (error) {
    console.error('❌ IoT simulation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  console.log('🚀 Starting IoT Producer Simulation...\n');
  runIoTSimulation();
}