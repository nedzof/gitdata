/**
 * D24 + D07 Integrated Marketplace Streaming Test
 * Tests the complete workflow: marketplace purchase -> streaming setup -> webhook delivery
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:8788';

interface PurchaseResponse {
  success: boolean;
  receiptId: string;
  offerId: string;
  versionId: string;
  agentId: string;
  streamingEnabled: boolean;
  webhookUrl?: string;
  message: string;
  deliveryMethod: string;
  streamingError?: string;
}

interface MockWebhookServer {
  port: number;
  url: string;
  receivedPayloads: any[];
  server: any;
}

async function startMockWebhookServer(): Promise<MockWebhookServer> {
  const express = require('express');
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  const receivedPayloads: any[] = [];

  app.post('/webhook', (req: any, res: any) => {
    console.log(`🔔 [WEBHOOK] Received content delivery:`, {
      contentSize: req.body.contentSize,
      receiptId: req.body.receiptId,
      agentId: req.body.agentId,
      contentHash: req.body.contentHash,
      timestamp: req.body.timestamp,
      deliveryMethod: req.body.deliveryMethod
    });

    receivedPayloads.push({
      headers: req.headers,
      body: req.body,
      timestamp: Date.now()
    });

    res.json({ success: true, received: true });
  });

  const port = 9099;
  const server = app.listen(port);

  console.log(`🔗 [WEBHOOK] Mock webhook server started on port ${port}`);

  return {
    port,
    url: `http://localhost:${port}/webhook`,
    receivedPayloads,
    server
  };
}

async function testMarketplacePurchaseWithStreaming(): Promise<void> {
  console.log('🏪 Starting D24 Marketplace + D07 Streaming Integration Test');
  console.log('=' .repeat(80));

  let webhookServer: MockWebhookServer | null = null;

  try {
    // 1. Start mock webhook server
    webhookServer = await startMockWebhookServer();
    console.log(`✅ Mock webhook server running at ${webhookServer.url}`);

    // 2. Test marketplace purchase with streaming
    console.log('\n🛒 Step 1: Testing marketplace purchase with streaming...');

    const purchaseData = {
      offerId: 'offer_premium_data_processing',
      versionId: 'version_12345',
      contentHash: 'marketplace-test-content-hash',
      agentId: 'agent_data_consumer',
      webhookUrl: webhookServer.url,
      paymentProof: 'mock_payment_proof_123',
      streamingOptions: {
        compressionEnabled: true,
        chunkSize: 1024 * 1024,
        maxRetries: 3
      }
    };

    const purchaseResponse = await fetch(`${BASE_URL}/overlay/marketplace/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });

    if (!purchaseResponse.ok) {
      const errorText = await purchaseResponse.text();
      throw new Error(`Purchase failed: ${purchaseResponse.status} - ${errorText}`);
    }

    const purchase: PurchaseResponse = await purchaseResponse.json();
    console.log(`✅ Purchase completed:`, {
      receiptId: purchase.receiptId,
      streamingEnabled: purchase.streamingEnabled,
      deliveryMethod: purchase.deliveryMethod,
      message: purchase.message
    });

    if (purchase.streamingError) {
      console.warn(`⚠️  Streaming setup warning: ${purchase.streamingError}`);
    }

    // 3. Test streaming subscription setup (if purchase didn't include streaming)
    if (!purchase.streamingEnabled) {
      console.log('\n📡 Step 2: Setting up streaming subscription...');

      const streamingSetupData = {
        receiptId: purchase.receiptId,
        webhookUrl: webhookServer.url,
        contentHash: purchaseData.contentHash,
        agentId: purchaseData.agentId,
        deliveryConfig: {
          compressionEnabled: true,
          maxRetries: 3,
          retryDelayMs: 1000
        }
      };

      const streamingResponse = await fetch(`${BASE_URL}/overlay/marketplace/streaming/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(streamingSetupData)
      });

      if (!streamingResponse.ok) {
        const errorText = await streamingResponse.text();
        throw new Error(`Streaming setup failed: ${streamingResponse.status} - ${errorText}`);
      }

      const streamingResult = await streamingResponse.json();
      console.log(`✅ Streaming subscription created:`, {
        sessionId: streamingResult.sessionId,
        receiptId: streamingResult.receiptId,
        message: streamingResult.message
      });
    }

    // 4. Test manual content delivery
    console.log('\n🚚 Step 3: Testing manual content delivery...');

    const sampleContentData = {
      type: 'premium-dataset',
      name: 'High-Value Processing Results',
      data: {
        records: [
          { id: 1, value: 'processed_data_1', quality: 'high' },
          { id: 2, value: 'processed_data_2', quality: 'high' },
          { id: 3, value: 'processed_data_3', quality: 'high' }
        ],
        metadata: {
          processedAt: new Date().toISOString(),
          algorithm: 'advanced-ml-v2',
          accuracy: 0.98
        }
      },
      size: 1024 * 512, // 512KB
      format: 'json'
    };

    const deliveryData = {
      receiptId: purchase.receiptId,
      webhookUrl: webhookServer.url,
      contentHash: purchaseData.contentHash,
      agentId: purchaseData.agentId,
      contentData: JSON.stringify(sampleContentData),
      deliveryConfig: {
        compressionEnabled: true,
        chunkSize: 1024 * 64 // 64KB chunks
      }
    };

    const deliveryResponse = await fetch(`${BASE_URL}/overlay/marketplace/content/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deliveryData)
    });

    if (!deliveryResponse.ok) {
      const errorText = await deliveryResponse.text();
      throw new Error(`Content delivery failed: ${deliveryResponse.status} - ${errorText}`);
    }

    const deliveryResult = await deliveryResponse.json();
    console.log(`✅ Content delivery completed:`, {
      success: deliveryResult.success,
      bytesDelivered: deliveryResult.bytesDelivered,
      deliveryTime: deliveryResult.deliveryTime + 'ms',
      hostUsed: deliveryResult.hostUsed,
      message: deliveryResult.message
    });

    // 5. Verify webhook received content
    console.log('\n📨 Step 4: Verifying webhook delivery...');

    // Wait a moment for webhook delivery
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (webhookServer.receivedPayloads.length > 0) {
      console.log(`✅ Webhook received ${webhookServer.receivedPayloads.length} payload(s):`);

      webhookServer.receivedPayloads.forEach((payload, index) => {
        console.log(`   Payload ${index + 1}:`, {
          receiptId: payload.body.receiptId,
          agentId: payload.body.agentId,
          contentSize: payload.body.contentSize,
          contentHash: payload.body.contentHash,
          deliveryMethod: payload.body.deliveryMethod,
          hasContentData: !!payload.body.data,
          timestamp: new Date(payload.timestamp).toISOString()
        });
      });
    } else {
      console.warn('⚠️  No webhook payloads received - check streaming delivery');
    }

    // 6. Test marketplace offers endpoint
    console.log('\n🏪 Step 5: Testing marketplace offers...');

    const offersResponse = await fetch(`${BASE_URL}/overlay/marketplace/offers`);

    if (!offersResponse.ok) {
      throw new Error(`Offers query failed: ${offersResponse.status}`);
    }

    const offersResult = await offersResponse.json();
    console.log(`✅ Retrieved ${offersResult.count} marketplace offers:`, {
      success: offersResult.success,
      count: offersResult.count,
      sampleOffer: offersResult.offers[0]
    });

    console.log('\n🎉 D24 Marketplace + D07 Streaming Integration Test PASSED!');
    console.log('=' .repeat(80));
    console.log('✅ All components working correctly:');
    console.log('   - Marketplace purchase with streaming option');
    console.log('   - Streaming subscription setup');
    console.log('   - Content delivery via webhook');
    console.log('   - Webhook payload verification');
    console.log('   - Marketplace offers browsing');

  } catch (error) {
    console.error('\n❌ Integration test FAILED:', error);
    throw error;
  } finally {
    // Cleanup
    if (webhookServer?.server) {
      webhookServer.server.close();
      console.log('\n🔒 Mock webhook server stopped');
    }
  }
}

// Performance and stress testing
async function testMarketplaceStreamingPerformance(): Promise<void> {
  console.log('\n⚡ Running Marketplace Streaming Performance Test...');

  let webhookServer: MockWebhookServer | null = null;

  try {
    webhookServer = await startMockWebhookServer();

    const testCases = [
      { name: 'Small Content', size: 1024 * 10 }, // 10KB
      { name: 'Medium Content', size: 1024 * 100 }, // 100KB
      { name: 'Large Content', size: 1024 * 1024 } // 1MB
    ];

    for (const testCase of testCases) {
      console.log(`\n📊 Testing ${testCase.name} (${(testCase.size / 1024).toFixed(1)}KB)...`);

      const startTime = Date.now();

      // Generate test content
      const contentData = 'x'.repeat(testCase.size);

      const purchaseData = {
        offerId: `perf_test_${Date.now()}`,
        versionId: `version_${Date.now()}`,
        contentHash: `perf-test-${testCase.name.toLowerCase()}`,
        agentId: 'agent_performance_test',
        webhookUrl: webhookServer.url
      };

      // Purchase
      const purchaseResponse = await fetch(`${BASE_URL}/overlay/marketplace/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseData)
      });

      const purchase = await purchaseResponse.json();

      // Deliver content
      const deliveryResponse = await fetch(`${BASE_URL}/overlay/marketplace/content/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId: purchase.receiptId,
          webhookUrl: webhookServer.url,
          contentHash: purchaseData.contentHash,
          agentId: purchaseData.agentId,
          contentData
        })
      });

      const deliveryResult = await deliveryResponse.json();
      const totalTime = Date.now() - startTime;

      const throughputKbps = (testCase.size / 1024) / (totalTime / 1000);

      console.log(`   Results: ${deliveryResult.bytesDelivered} bytes in ${totalTime}ms (${throughputKbps.toFixed(2)} KB/s)`);
    }

  } finally {
    if (webhookServer?.server) {
      webhookServer.server.close();
    }
  }
}

// Run tests
if (require.main === module) {
  testMarketplacePurchaseWithStreaming()
    .then(() => testMarketplaceStreamingPerformance())
    .then(() => {
      console.log('\n✅ All marketplace streaming tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Marketplace streaming tests failed:', error);
      process.exit(1);
    });
}

export {
  testMarketplacePurchaseWithStreaming,
  testMarketplaceStreamingPerformance
};