/**
 * D07 Performance Test - 1GB Data Streaming
 * Tests the BSV Overlay Network Data Streaming system under heavy load
 */

// Use native fetch if available (Node.js 18+), otherwise import node-fetch
const fetch = globalThis.fetch || require('node-fetch');
import crypto from 'crypto';

const BASE_URL = 'http://localhost:8788';
const TEST_SIZE_MB = 1024; // 1GB = 1024MB
const CHUNK_SIZE_MB = 50; // Stream in 50MB chunks for better efficiency
const CHUNKS = TEST_SIZE_MB / CHUNK_SIZE_MB;

interface PerformanceMetrics {
  totalBytes: number;
  totalTime: number;
  avgThroughputMbps: number;
  avgLatencyMs: number;
  successfulRequests: number;
  failedRequests: number;
  quotaStatus: any;
  peakThroughputMbps: number;
  minLatencyMs: number;
  maxLatencyMs: number;
}

async function generateLargeContent(sizeMB: number): Promise<string> {
  const sizeBytes = sizeMB * 1024 * 1024;
  const chunks: string[] = [];
  const chunkSize = 1024 * 1024; // 1MB chunks for generation

  console.log(`📝 Generating ${sizeMB}MB of test content...`);

  for (let i = 0; i < sizeBytes; i += chunkSize) {
    const remainingBytes = Math.min(chunkSize, sizeBytes - i);
    const chunk = 'A'.repeat(remainingBytes);
    chunks.push(chunk);
  }

  return chunks.join('');
}

async function createLargeStreamingSession(receiptId: string, sizeMB: number): Promise<string> {
  const sessionData = {
    receiptId,
    agentId: `performance-test-${sizeMB}mb`,
    webhookUrl: 'https://example.com/webhook/performance-1gb',
    sessionType: 'webhook',
    estimatedBytes: sizeMB * 1024 * 1024
  };

  console.log(`🚀 Creating streaming session for ${sizeMB}MB (1GB)...`);

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
  console.log(`✅ Session created: ${session.sessionId}`);
  return session.sessionId;
}

async function streamDataChunk(
  contentHash: string,
  receiptId: string,
  sessionId: string,
  chunkIndex: number,
  chunkSizeMB: number
): Promise<{
  success: boolean;
  responseTime: number;
  bytesReceived: number;
  throughputMbps: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    console.log(`📦 Streaming chunk ${chunkIndex + 1}/${CHUNKS} (${chunkSizeMB}MB)...`);

    const response = await fetch(
      `${BASE_URL}/v1/streaming/data/${contentHash}?receiptId=${receiptId}&sessionId=${sessionId}&chunkIndex=${chunkIndex}`,
      {
        method: 'GET',
        timeout: 60000 // 60 second timeout for larger chunks
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
    const megabytesReceived = bytesReceived / (1024 * 1024);
    const throughputMbps = (megabytesReceived * 8) / (responseTime / 1000); // Convert to Mbps

    console.log(`   ✅ Chunk ${chunkIndex + 1} received: ${megabytesReceived.toFixed(2)}MB in ${responseTime}ms (${throughputMbps.toFixed(2)} Mbps)`);

    return {
      success: true,
      responseTime,
      bytesReceived,
      throughputMbps,
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`   ❌ Chunk ${chunkIndex + 1} failed:`, error.message);

    return {
      success: false,
      responseTime,
      bytesReceived: 0,
      throughputMbps: 0,
      error: error.message
    };
  }
}

async function checkQuotaStatus(receiptId: string): Promise<any> {
  try {
    const response = await fetch(`${BASE_URL}/v1/streaming/quotas/${receiptId}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.warn('Quota status check failed:', error.message);
    return null;
  }
}

async function performanceTest(): Promise<PerformanceMetrics> {
  console.log('🏁 Starting D07 Performance Test - 1GB Data Streaming');
  console.log('=' .repeat(70));

  // Generate test identifiers
  const testReceiptId = crypto.randomUUID();
  const testContentHash = `perf-test-1gb-${Date.now()}`;

  const startTime = Date.now();
  let totalBytesReceived = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  const latencies: number[] = [];
  const throughputs: number[] = [];

  try {
    // Create streaming session
    const sessionId = await createLargeStreamingSession(testReceiptId, TEST_SIZE_MB);

    // Check initial quota status
    const initialQuota = await checkQuotaStatus(testReceiptId);
    console.log('📊 Initial quota status:', initialQuota ? 'Available' : 'Not configured');

    // Stream data in chunks
    console.log(`\n📡 Streaming ${TEST_SIZE_MB}MB (1GB) in ${CHUNKS} chunks of ${CHUNK_SIZE_MB}MB each...`);
    console.log(`⚡ Expected completion time: ~${Math.ceil(CHUNKS * 2)}s at optimal performance\n`);

    for (let chunkIndex = 0; chunkIndex < CHUNKS; chunkIndex++) {
      const result = await streamDataChunk(
        testContentHash,
        testReceiptId,
        sessionId,
        chunkIndex,
        CHUNK_SIZE_MB
      );

      if (result.success) {
        successfulRequests++;
        totalBytesReceived += result.bytesReceived;
        latencies.push(result.responseTime);
        throughputs.push(result.throughputMbps);
      } else {
        failedRequests++;
        console.error(`❌ Chunk ${chunkIndex + 1} failed: ${result.error}`);

        // If we get quota exceeded, log it but continue to test the system behavior
        if (result.error?.includes('429') || result.error?.includes('quota')) {
          console.log('💡 Quota limit reached - this is expected behavior for 1GB data tests');
        }
      }

      // Small delay between chunks to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 200));

      // Progress indicator every 5 chunks
      if ((chunkIndex + 1) % 5 === 0) {
        const progressPercent = ((chunkIndex + 1) / CHUNKS * 100).toFixed(1);
        const currentMB = (totalBytesReceived / (1024 * 1024)).toFixed(1);
        console.log(`📈 Progress: ${progressPercent}% (${currentMB}MB received)`);
      }
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Check final quota status
    const finalQuota = await checkQuotaStatus(testReceiptId);

    // Calculate comprehensive performance metrics
    const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const minLatencyMs = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatencyMs = latencies.length > 0 ? Math.max(...latencies) : 0;

    const totalMB = totalBytesReceived / (1024 * 1024);
    const totalGB = totalMB / 1024;
    const avgThroughputMbps = (totalMB * 8) / (totalTime / 1000); // Convert to Mbps
    const peakThroughputMbps = throughputs.length > 0 ? Math.max(...throughputs) : 0;

    const metrics: PerformanceMetrics = {
      totalBytes: totalBytesReceived,
      totalTime,
      avgThroughputMbps,
      avgLatencyMs,
      successfulRequests,
      failedRequests,
      quotaStatus: finalQuota,
      peakThroughputMbps,
      minLatencyMs,
      maxLatencyMs
    };

    // Print comprehensive results
    console.log('\n📈 1GB PERFORMANCE TEST RESULTS');
    console.log('=' .repeat(70));
    console.log(`🎯 Total Data Requested: ${TEST_SIZE_MB}MB (1GB)`);
    console.log(`✅ Total Data Received: ${totalMB.toFixed(2)}MB (${totalGB.toFixed(3)}GB)`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)}s (${(totalTime / 60000).toFixed(2)} minutes)`);
    console.log(`🚄 Average Throughput: ${avgThroughputMbps.toFixed(2)} Mbps`);
    console.log(`🏃 Peak Throughput: ${peakThroughputMbps.toFixed(2)} Mbps`);
    console.log(`⚡ Average Latency: ${avgLatencyMs.toFixed(2)}ms`);
    console.log(`⚡ Min/Max Latency: ${minLatencyMs.toFixed(2)}ms / ${maxLatencyMs.toFixed(2)}ms`);
    console.log(`✅ Successful Requests: ${successfulRequests}/${CHUNKS}`);
    console.log(`❌ Failed Requests: ${failedRequests}/${CHUNKS}`);
    console.log(`📊 Success Rate: ${((successfulRequests / CHUNKS) * 100).toFixed(1)}%`);
    console.log(`💰 Data Efficiency: ${((totalBytesReceived / (TEST_SIZE_MB * 1024 * 1024)) * 100).toFixed(1)}%`);

    if (finalQuota) {
      console.log('\n📋 Final Quota Status:');
      if (finalQuota.windows) {
        Object.entries(finalQuota.windows).forEach(([window, data]: [string, any]) => {
          const utilization = ((data.bytesUsed / data.bytesAllowed) * 100).toFixed(1);
          const usedMB = (data.bytesUsed / (1024 * 1024)).toFixed(2);
          const allowedMB = (data.bytesAllowed / (1024 * 1024)).toFixed(2);
          console.log(`   ${window}: ${usedMB}MB / ${allowedMB}MB (${utilization}%)`);
        });
      }
    }

    // Performance analysis
    console.log('\n🔍 Performance Analysis:');
    if (avgThroughputMbps > 100) {
      console.log('🟢 Excellent throughput - System performing optimally');
    } else if (avgThroughputMbps > 50) {
      console.log('🟡 Good throughput - System performing well');
    } else {
      console.log('🔴 Low throughput - Consider system optimization');
    }

    if (avgLatencyMs < 100) {
      console.log('🟢 Excellent latency - Very responsive system');
    } else if (avgLatencyMs < 500) {
      console.log('🟡 Good latency - Acceptable response times');
    } else {
      console.log('🔴 High latency - System may be under stress');
    }

    console.log('\n🏁 1GB Performance test completed!');
    return metrics;

  } catch (error) {
    console.error('❌ Performance test failed:', error);
    throw error;
  }
}

// Run the performance test
if (require.main === module) {
  performanceTest()
    .then((metrics) => {
      console.log('\n✅ 1GB Test completed successfully');
      console.log(`📊 Final Score: ${metrics.avgThroughputMbps.toFixed(2)} Mbps avg, ${metrics.peakThroughputMbps.toFixed(2)} Mbps peak`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 1GB Test failed:', error);
      process.exit(1);
    });
}

export { performanceTest, PerformanceMetrics };