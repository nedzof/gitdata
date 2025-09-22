/**
 * D07 Concurrent Performance Test - 10 Simultaneous 1GB Streams with 100KB packets
 * Tests the BSV Overlay Network Data Streaming system under concurrent load
 */

// Use native fetch if available (Node.js 18+), otherwise import node-fetch
const fetch = globalThis.fetch || require('node-fetch');
import crypto from 'crypto';

const BASE_URL = 'http://localhost:8788';
const STREAM_COUNT = 10; // Number of simultaneous streams
const STREAM_SIZE_GB = 1; // 1GB per stream
const STREAM_SIZE_MB = STREAM_SIZE_GB * 1024; // 1024MB per stream
const PACKET_SIZE_KB = 100; // 100KB packets
const PACKET_SIZE_MB = PACKET_SIZE_KB / 1024; // 0.09765625MB per packet
const PACKETS_PER_STREAM = Math.ceil(STREAM_SIZE_MB / PACKET_SIZE_MB); // ~10,486 packets per stream
const TOTAL_DATA_GB = STREAM_COUNT * STREAM_SIZE_GB; // 10GB total

interface StreamResult {
  streamId: number;
  receiptId: string;
  sessionId: string;
  totalBytes: number;
  totalTime: number;
  successfulPackets: number;
  failedPackets: number;
  avgThroughputMbps: number;
  avgLatencyMs: number;
  errors: string[];
}

interface ConcurrentMetrics {
  totalStreams: number;
  totalDataGB: number;
  totalTime: number;
  overallThroughputGbps: number;
  successfulStreams: number;
  failedStreams: number;
  totalPackets: number;
  successfulPackets: number;
  failedPackets: number;
  avgStreamThroughputMbps: number;
  peakStreamThroughputMbps: number;
  avgLatencyMs: number;
  streamResults: StreamResult[];
}

async function createStreamingSession(receiptId: string, streamId: number): Promise<string> {
  const agentId = crypto.randomUUID(); // Generate a proper UUID for the agent
  const sessionData = {
    receiptId,
    agentId: `performance-test-${agentId}`, // Include performance-test prefix for bypass logic
    webhookUrl: `https://example.com/webhook/concurrent-${streamId}`,
    sessionType: 'webhook',
    estimatedBytes: STREAM_SIZE_MB * 1024 * 1024
  };

  console.log(`🚀 [Stream ${streamId}] Creating streaming session for 1GB...`);

  const response = await fetch(`${BASE_URL}/v1/streaming/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Session creation failed: ${response.status} - ${error}`);
  }

  const session = await response.json();
  console.log(`✅ [Stream ${streamId}] Session created: ${session.sessionId}`);
  return session.sessionId;
}

async function streamPacket(
  contentHash: string,
  receiptId: string,
  sessionId: string,
  streamId: number,
  packetIndex: number
): Promise<{
  success: boolean;
  responseTime: number;
  bytesReceived: number;
  throughputMbps: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(
      `${BASE_URL}/v1/streaming/data/${contentHash}?receiptId=${receiptId}&sessionId=${sessionId}&packetIndex=${packetIndex}`,
      {
        method: 'GET',
        timeout: 30000 // 30 second timeout per packet
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        responseTime,
        bytesReceived: 0,
        throughputMbps: 0,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const content = await response.text();
    const bytesReceived = Buffer.byteLength(content);
    const kilobytesReceived = bytesReceived / 1024;
    const throughputMbps = (kilobytesReceived * 8) / (responseTime / 1000) / 1024; // Convert to Mbps

    return {
      success: true,
      responseTime,
      bytesReceived,
      throughputMbps,
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      responseTime,
      bytesReceived: 0,
      throughputMbps: 0,
      error: error.message
    };
  }
}

async function runSingleStream(streamId: number): Promise<StreamResult> {
  const receiptId = crypto.randomUUID();
  const contentHash = `perf-test-concurrent-1gb-stream-${streamId}-${Date.now()}`;

  console.log(`\n🎯 [Stream ${streamId}] Starting 1GB stream with ${PACKETS_PER_STREAM} packets of ${PACKET_SIZE_KB}KB each`);

  const startTime = Date.now();
  let totalBytesReceived = 0;
  let successfulPackets = 0;
  let failedPackets = 0;
  const latencies: number[] = [];
  const throughputs: number[] = [];
  const errors: string[] = [];

  try {
    // Create streaming session
    const sessionId = await createStreamingSession(receiptId, streamId);

    // Stream all packets for this stream
    for (let packetIndex = 0; packetIndex < PACKETS_PER_STREAM; packetIndex++) {
      const result = await streamPacket(
        contentHash,
        receiptId,
        sessionId,
        streamId,
        packetIndex
      );

      if (result.success) {
        successfulPackets++;
        totalBytesReceived += result.bytesReceived;
        latencies.push(result.responseTime);
        throughputs.push(result.throughputMbps);
      } else {
        failedPackets++;
        if (result.error) {
          errors.push(result.error);
        }
      }

      // Progress logging every 1000 packets
      if ((packetIndex + 1) % 1000 === 0) {
        const progressPercent = ((packetIndex + 1) / PACKETS_PER_STREAM * 100).toFixed(1);
        const currentMB = (totalBytesReceived / (1024 * 1024)).toFixed(1);
        console.log(`📈 [Stream ${streamId}] Progress: ${progressPercent}% (${currentMB}MB received)`);
      }

      // Small delay between packets to avoid overwhelming the system
      if (packetIndex % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Calculate metrics for this stream
    const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const totalMB = totalBytesReceived / (1024 * 1024);
    const avgThroughputMbps = (totalMB * 8) / (totalTime / 1000);

    const streamResult: StreamResult = {
      streamId,
      receiptId,
      sessionId,
      totalBytes: totalBytesReceived,
      totalTime,
      successfulPackets,
      failedPackets,
      avgThroughputMbps,
      avgLatencyMs,
      errors: [...new Set(errors)] // Remove duplicates
    };

    console.log(`✅ [Stream ${streamId}] Completed: ${totalMB.toFixed(2)}MB in ${(totalTime/1000).toFixed(2)}s (${avgThroughputMbps.toFixed(2)} Mbps)`);
    return streamResult;

  } catch (error) {
    console.error(`❌ [Stream ${streamId}] Failed:`, error.message);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    return {
      streamId,
      receiptId,
      sessionId: '',
      totalBytes: totalBytesReceived,
      totalTime,
      successfulPackets,
      failedPackets: failedPackets + (PACKETS_PER_STREAM - successfulPackets - failedPackets),
      avgThroughputMbps: 0,
      avgLatencyMs: 0,
      errors: [...new Set([...errors, error.message])]
    };
  }
}

async function concurrentPerformanceTest(): Promise<ConcurrentMetrics> {
  console.log('🏁 Starting D07 Concurrent Performance Test');
  console.log(`🎯 Configuration: ${STREAM_COUNT} simultaneous 1GB streams`);
  console.log(`📦 Packet Size: ${PACKET_SIZE_KB}KB per packet`);
  console.log(`📊 Total Data: ${TOTAL_DATA_GB}GB across all streams`);
  console.log(`⚡ Expected Packets: ~${PACKETS_PER_STREAM * STREAM_COUNT} total packets`);
  console.log('=' .repeat(80));

  const startTime = Date.now();

  // Create promises for all concurrent streams
  const streamPromises: Promise<StreamResult>[] = [];

  for (let streamId = 1; streamId <= STREAM_COUNT; streamId++) {
    streamPromises.push(runSingleStream(streamId));

    // Stagger stream startup by 500ms to avoid overwhelming the session creation
    if (streamId < STREAM_COUNT) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n🚀 All ${STREAM_COUNT} streams initiated, running concurrently...`);

  // Wait for all streams to complete
  const streamResults = await Promise.all(streamPromises);

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  // Calculate overall metrics
  const successfulStreams = streamResults.filter(r => r.successfulPackets > 0).length;
  const failedStreams = STREAM_COUNT - successfulStreams;

  const totalBytes = streamResults.reduce((sum, r) => sum + r.totalBytes, 0);
  const totalPackets = streamResults.reduce((sum, r) => sum + r.successfulPackets + r.failedPackets, 0);
  const successfulPackets = streamResults.reduce((sum, r) => sum + r.successfulPackets, 0);
  const failedPackets = streamResults.reduce((sum, r) => sum + r.failedPackets, 0);

  const totalGB = totalBytes / (1024 * 1024 * 1024);
  const overallThroughputGbps = (totalGB * 8) / (totalTime / 1000); // Convert to Gbps

  const streamThroughputs = streamResults.map(r => r.avgThroughputMbps).filter(t => t > 0);
  const avgStreamThroughputMbps = streamThroughputs.length > 0
    ? streamThroughputs.reduce((a, b) => a + b, 0) / streamThroughputs.length
    : 0;
  const peakStreamThroughputMbps = streamThroughputs.length > 0
    ? Math.max(...streamThroughputs)
    : 0;

  const streamLatencies = streamResults.map(r => r.avgLatencyMs).filter(l => l > 0);
  const avgLatencyMs = streamLatencies.length > 0
    ? streamLatencies.reduce((a, b) => a + b, 0) / streamLatencies.length
    : 0;

  const metrics: ConcurrentMetrics = {
    totalStreams: STREAM_COUNT,
    totalDataGB: TOTAL_DATA_GB,
    totalTime,
    overallThroughputGbps,
    successfulStreams,
    failedStreams,
    totalPackets,
    successfulPackets,
    failedPackets,
    avgStreamThroughputMbps,
    peakStreamThroughputMbps,
    avgLatencyMs,
    streamResults
  };

  // Print comprehensive results
  console.log('\n📈 CONCURRENT PERFORMANCE TEST RESULTS');
  console.log('=' .repeat(80));
  console.log(`🎯 Total Streams: ${STREAM_COUNT}`);
  console.log(`✅ Successful Streams: ${successfulStreams}/${STREAM_COUNT}`);
  console.log(`❌ Failed Streams: ${failedStreams}/${STREAM_COUNT}`);
  console.log(`📊 Total Data Requested: ${TOTAL_DATA_GB}GB`);
  console.log(`✅ Total Data Received: ${totalGB.toFixed(3)}GB`);
  console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)}s (${(totalTime / 60000).toFixed(2)} minutes)`);
  console.log(`🚄 Overall Throughput: ${overallThroughputGbps.toFixed(2)} Gbps`);
  console.log(`🏃 Average Stream Throughput: ${avgStreamThroughputMbps.toFixed(2)} Mbps`);
  console.log(`🏃 Peak Stream Throughput: ${peakStreamThroughputMbps.toFixed(2)} Mbps`);
  console.log(`⚡ Average Latency: ${avgLatencyMs.toFixed(2)}ms`);
  console.log(`📦 Total Packets: ${totalPackets}`);
  console.log(`✅ Successful Packets: ${successfulPackets}/${totalPackets}`);
  console.log(`❌ Failed Packets: ${failedPackets}/${totalPackets}`);
  console.log(`📊 Packet Success Rate: ${((successfulPackets / totalPackets) * 100).toFixed(1)}%`);
  console.log(`💰 Data Efficiency: ${((totalBytes / (TOTAL_DATA_GB * 1024 * 1024 * 1024)) * 100).toFixed(1)}%`);

  // Individual stream results
  console.log('\n📋 Individual Stream Results:');
  streamResults.forEach((result, index) => {
    const dataMB = (result.totalBytes / (1024 * 1024)).toFixed(2);
    const timeS = (result.totalTime / 1000).toFixed(2);
    const successRate = result.successfulPackets + result.failedPackets > 0
      ? ((result.successfulPackets / (result.successfulPackets + result.failedPackets)) * 100).toFixed(1)
      : '0.0';

    console.log(`   Stream ${result.streamId}: ${dataMB}MB in ${timeS}s (${result.avgThroughputMbps.toFixed(2)} Mbps, ${successRate}% success)`);

    if (result.errors.length > 0) {
      console.log(`      Errors: ${result.errors.join(', ')}`);
    }
  });

  // Performance analysis
  console.log('\n🔍 Concurrent Performance Analysis:');
  if (overallThroughputGbps > 5) {
    console.log('🟢 Excellent concurrent throughput - System handling multiple streams optimally');
  } else if (overallThroughputGbps > 2) {
    console.log('🟡 Good concurrent throughput - System performing well under load');
  } else {
    console.log('🔴 Low concurrent throughput - System may be saturated');
  }

  if (successfulStreams === STREAM_COUNT) {
    console.log('🟢 Perfect stream success rate - All streams completed successfully');
  } else if (successfulStreams >= STREAM_COUNT * 0.8) {
    console.log('🟡 Good stream success rate - Most streams completed successfully');
  } else {
    console.log('🔴 Poor stream success rate - Many streams failed');
  }

  const packetSuccessRate = (successfulPackets / totalPackets) * 100;
  if (packetSuccessRate > 95) {
    console.log('🟢 Excellent packet delivery - Very high reliability');
  } else if (packetSuccessRate > 85) {
    console.log('🟡 Good packet delivery - Acceptable reliability');
  } else {
    console.log('🔴 Poor packet delivery - Low reliability under concurrent load');
  }

  console.log('\n🏁 Concurrent performance test completed!');
  return metrics;
}

// Run the concurrent performance test
if (require.main === module) {
  concurrentPerformanceTest()
    .then((metrics) => {
      console.log('\n✅ Concurrent test completed successfully');
      console.log(`📊 Final Score: ${metrics.overallThroughputGbps.toFixed(2)} Gbps overall, ${metrics.avgStreamThroughputMbps.toFixed(2)} Mbps avg per stream`);
      console.log(`🎯 Stream Success: ${metrics.successfulStreams}/${metrics.totalStreams}, Packet Success: ${metrics.successfulPackets}/${metrics.totalPackets}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Concurrent test failed:', error);
      process.exit(1);
    });
}

export { concurrentPerformanceTest, ConcurrentMetrics, StreamResult };