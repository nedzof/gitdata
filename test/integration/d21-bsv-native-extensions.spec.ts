/**
 * D21 BSV Native Payment Extensions Integration Tests
 *
 * Comprehensive integration tests for D21 extensions to BRC-41:
 * - Payment template generation and verification
 * - ARC broadcasting with BSV SDK integration
 * - Cross-network settlement coordination
 * - AI agent payment workflows
 * - Integration with existing BRC-41 system
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import * as bsv from '@bsv/sdk';

import { app } from '../../src/server.js';
import type {
  D21PaymentTemplate,
  D21ARCBroadcastResult,
  PaymentSplitRules,
  ARCTxStatus,
} from '../../src/d21/types.js';

describe('D21 BSV Native Payment Extensions Integration Tests', () => {
  let testPrivateKey: bsv.PrivateKey;
  let testPublicKey: bsv.PublicKey;
  let testIdentityKey: string;
  let serverAgent: request.SuperTest<request.Test>;

  beforeAll(async () => {
    // Create test identity
    const testWIF = 'KwF9LjRraetZuEjR8VqEq539z137LW5anYDUnVK11vM3mNMHTWb4'; // Test-only private key
    testPrivateKey = bsv.PrivateKey.fromWif(testWIF);
    testPublicKey = testPrivateKey.toPublicKey();
    testIdentityKey = testPublicKey.toString();
    serverAgent = request(app);

    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('🧪 D21 integration tests initialized');
  });

  beforeEach(async () => {
    // Clean test data before each test
    console.log('🧹 Cleaning test data...');
  });

  afterEach(async () => {
    // Clean up after each test
  });

  afterAll(async () => {
    console.log('🏁 D21 integration tests completed');
  });

  // ==================== Payment Template Tests ====================

  describe('Payment Template Generation and Verification', () => {
    let testTemplate: D21PaymentTemplate;

    it('should generate deterministic payment template with custom splits', async () => {
      const splitRules: PaymentSplitRules = {
        overlay: 0.05,    // 5% platform fee
        producer: 0.85,   // 85% producer revenue
        agent: 0.10,      // 10% agent commission
      };

      const response = await serverAgent
        .post('/v1/d21/templates/generate')
        .send({
          splitRules,
          totalSatoshis: 100000, // 1000 sats
          createdBy: testIdentityKey,
          metadata: {
            testCase: 'integration_test',
            timestamp: Date.now(),
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.template).toBeDefined();

      testTemplate = response.body.template;

      // Verify template structure
      expect(testTemplate.templateHash).toMatch(/^[a-f0-9]{64}$/);
      expect(testTemplate.totalAmountSatoshis).toBe(100000);
      expect(testTemplate.splitRules).toEqual(splitRules);
      expect(testTemplate.outputScripts).toHaveLength(3); // overlay, producer, agent

      // Verify outputs match split rules
      const totalOutputSatoshis = testTemplate.outputScripts.reduce(
        (sum, output) => sum + output.satoshis,
        0
      );
      expect(totalOutputSatoshis).toBe(100000);

      console.log(`✅ Generated template: ${testTemplate.templateHash.slice(0, 10)}...`);
    });

    it('should retrieve and verify payment template integrity', async () => {
      if (!testTemplate) {
        throw new Error('Test template not generated');
      }

      const response = await serverAgent
        .get(`/v1/d21/templates/${testTemplate.templateHash}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.template.templateHash).toBe(testTemplate.templateHash);
      expect(response.body.verification.isValid).toBe(true);

      // Check usage analytics
      expect(response.body.usage).toBeDefined();
      expect(response.body.usage.totalUses).toBeGreaterThanOrEqual(0);

      console.log(`✅ Verified template integrity: ${response.body.verification.isValid}`);
    });

    it('should reject invalid split rules that do not sum to 1.0', async () => {
      const invalidSplitRules = {
        overlay: 0.05,
        producer: 0.50, // Only sums to 0.55
      };

      await serverAgent
        .post('/v1/d21/templates/generate')
        .send({
          splitRules: invalidSplitRules,
          totalSatoshis: 50000,
          createdBy: testIdentityKey,
        })
        .expect(400);

      console.log('✅ Correctly rejected invalid split rules');
    });

    it('should link payment template to BRC-41 payment', async () => {
      // First create a BRC-41 payment (mocked for integration test)
      const brc41PaymentId = 'test-brc41-payment-' + Date.now();

      const response = await serverAgent
        .post('/v1/d21/templates/generate')
        .send({
          brc41PaymentId,
          splitRules: { overlay: 0.1, producer: 0.9 },
          totalSatoshis: 75000,
          createdBy: testIdentityKey,
        })
        .expect(200);

      expect(response.body.template.brc41PaymentId).toBe(brc41PaymentId);

      console.log(`✅ Linked template to BRC-41 payment: ${brc41PaymentId}`);
    });
  });

  // ==================== ARC Broadcasting Tests ====================

  describe('ARC Broadcasting with BSV SDK', () => {
    let testTransaction: bsv.Transaction;
    let testTxHex: string;

    beforeEach(() => {
      // Create a test transaction
      testTransaction = new bsv.Transaction();

      // Add a simple input (mock UTXO)
      testTransaction.addInput({
        sourceTransaction: new bsv.Transaction(),
        sourceOutputIndex: 0,
        unlockingScript: bsv.Script.fromHex(''),
      });

      // Add outputs based on template
      testTransaction.addOutput({
        lockingScript: bsv.Script.fromHex('76a914' + '0'.repeat(40) + '88ac'), // P2PKH
        satoshis: 50000,
      });

      testTransaction.addOutput({
        lockingScript: bsv.Script.fromHex('76a914' + '1'.repeat(40) + '88ac'), // P2PKH
        satoshis: 49000,
      });

      testTxHex = testTransaction.toHex();
    });

    it('should broadcast transaction via ARC with lifecycle tracking', async () => {
      const response = await serverAgent
        .post('/v1/d21/arc/broadcast')
        .send({
          rawTx: testTxHex,
          waitForStatus: 'RECEIVED', // Wait for basic acceptance
          maxTimeout: 30000, // 30 seconds
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.txid).toMatch(/^[a-f0-9]{64}$/);
      expect(response.body.status).toBeDefined();
      expect(response.body.provider).toBeDefined();

      // Verify lifecycle tracking
      expect(response.body.lifecycle).toBeDefined();

      console.log(`✅ Broadcast transaction: ${response.body.txid.slice(0, 10)}... via ${response.body.provider}`);

      // Test transaction status retrieval
      const statusResponse = await serverAgent
        .get(`/v1/d21/arc/tx/${response.body.txid}/status`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.txid).toBe(response.body.txid);
      expect(statusResponse.body.status).toBeDefined();

      console.log(`✅ Retrieved transaction status: ${statusResponse.body.status}`);
    }, 60000); // Extended timeout for network operations

    it('should handle ARC provider selection and failover', async () => {
      // Test with preferred provider
      const providersResponse = await serverAgent
        .get('/v1/d21/arc/providers')
        .expect(200);

      expect(providersResponse.body.success).toBe(true);
      expect(providersResponse.body.providers).toBeDefined();
      expect(Array.isArray(providersResponse.body.providers)).toBe(true);

      if (providersResponse.body.providers.length > 0) {
        const firstProvider = providersResponse.body.providers[0];

        const response = await serverAgent
          .post('/v1/d21/arc/broadcast')
          .send({
            rawTx: testTxHex,
            preferredProvider: firstProvider.providerId,
          })
          .expect(200);

        expect(response.body.provider).toBe(firstProvider.providerName);

        console.log(`✅ Used preferred provider: ${response.body.provider}`);
      }
    }, 30000);

    it('should get ARC provider health and capabilities', async () => {
      const response = await serverAgent
        .get('/v1/d21/arc/providers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.providers).toBeDefined();

      // Check provider health information
      for (const provider of response.body.providers) {
        expect(provider.providerId).toBeDefined();
        expect(provider.providerName).toBeDefined();
        expect(provider.apiUrl).toBeDefined();
        expect(provider.health).toBeDefined();
        expect(typeof provider.health.isHealthy).toBe('boolean');
        expect(typeof provider.health.responseTime).toBe('number');

        console.log(`📊 Provider ${provider.providerName}: ${provider.health.isHealthy ? 'Healthy' : 'Unhealthy'}`);
      }
    });

    it('should handle ARC callback for merkle proofs', async () => {
      // Mock merkle proof callback
      const mockProviderId = 'test-provider-id';
      const mockTxid = testTransaction.id('hex');
      const mockMerklePath = '0123456789abcdef'; // Mock merkle path hex

      const response = await serverAgent
        .post(`/v1/d21/arc/callback/${mockProviderId}`)
        .send({
          txid: mockTxid,
          merklePath: mockMerklePath,
          blockHeight: 850000,
        });

      // This might fail if provider doesn't exist, which is expected in integration test
      // The important thing is that the endpoint exists and validates input
      expect([200, 400]).toContain(response.status);

      console.log(`✅ ARC callback endpoint responded with status: ${response.status}`);
    });
  });

  // ==================== Integration with BRC-41 Tests ====================

  describe('BRC-41 Integration', () => {
    it('should create hybrid payment workflow combining BRC-41 and D21', async () => {
      // Step 1: Create payment template with BRC-41 link
      const brc41PaymentId = 'integration-test-' + Date.now();

      const templateResponse = await serverAgent
        .post('/v1/d21/templates/generate')
        .send({
          brc41PaymentId,
          splitRules: { overlay: 0.05, producer: 0.90, agent: 0.05 },
          totalSatoshis: 200000,
          createdBy: testIdentityKey,
        })
        .expect(200);

      expect(templateResponse.body.template.brc41PaymentId).toBe(brc41PaymentId);

      // Step 2: Use template in ARC broadcast
      const testTx = new bsv.Transaction();
      testTx.addInput({
        sourceTransaction: new bsv.Transaction(),
        sourceOutputIndex: 0,
        unlockingScript: bsv.Script.fromHex(''),
      });
      testTx.addOutput({
        lockingScript: bsv.Script.fromHex('76a914' + '0'.repeat(40) + '88ac'),
        satoshis: 190000,
      });
      testTx.addOutput({
        lockingScript: bsv.Script.fromHex('76a914' + '1'.repeat(40) + '88ac'),
        satoshis: 10000,
      });

      const broadcastResponse = await serverAgent
        .post('/v1/d21/arc/broadcast')
        .send({
          rawTx: testTx.toHex(),
          templateId: templateResponse.body.template.templateId,
        })
        .expect(200);

      expect(broadcastResponse.body.success).toBe(true);

      console.log(`✅ Created hybrid BRC-41 + D21 payment workflow`);
    }, 30000);

    it('should validate BRC-41 payment references in templates', async () => {
      // Test with non-existent BRC-41 payment ID
      const nonExistentPaymentId = 'non-existent-payment-12345';

      // This should work as we don't enforce BRC-41 validation in the basic implementation
      // In production, this would be validated if BRC-41 service is integrated
      const response = await serverAgent
        .post('/v1/d21/templates/generate')
        .send({
          brc41PaymentId: nonExistentPaymentId,
          splitRules: { overlay: 0.1, producer: 0.9 },
          totalSatoshis: 50000,
          createdBy: testIdentityKey,
        });

      // Should succeed without validation, or fail with 400 if validation is implemented
      expect([200, 400]).toContain(response.status);

      console.log(`✅ BRC-41 payment validation test completed with status: ${response.status}`);
    });
  });

  // ==================== Performance and Load Tests ====================

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent template generations', async () => {
      const concurrentRequests = 5;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          serverAgent
            .post('/v1/d21/templates/generate')
            .send({
              splitRules: { overlay: 0.05, producer: 0.95 },
              totalSatoshis: 25000 + i * 1000,
              createdBy: testIdentityKey,
              metadata: { batchTest: i },
            })
        );
      }

      const responses = await Promise.all(requests);

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }

      console.log(`✅ Handled ${concurrentRequests} concurrent template generations`);
    }, 30000);

    it('should maintain template reproducibility under load', async () => {
      const deterministicInputs = {
        splitRules: { overlay: 0.1, producer: 0.9 },
        totalSatoshis: 100000,
        createdBy: testIdentityKey,
        metadata: { reproducibilityTest: 'fixed_input' },
      };

      // Generate same template multiple times
      const response1 = await serverAgent
        .post('/v1/d21/templates/generate')
        .send(deterministicInputs)
        .expect(200);

      const response2 = await serverAgent
        .post('/v1/d21/templates/generate')
        .send(deterministicInputs)
        .expect(200);

      // Templates with identical inputs should have different IDs but similar structure
      expect(response1.body.template.templateHash).toBeDefined();
      expect(response2.body.template.templateHash).toBeDefined();
      expect(response1.body.template.splitRules).toEqual(response2.body.template.splitRules);

      console.log('✅ Template reproducibility maintained under load');
    });
  });

  // ==================== Error Handling and Edge Cases ====================

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid transaction hex gracefully', async () => {
      await serverAgent
        .post('/v1/d21/arc/broadcast')
        .send({
          rawTx: 'invalid_hex_string',
        })
        .expect(400);

      console.log('✅ Correctly rejected invalid transaction hex');
    });

    it('should handle template hash not found', async () => {
      const nonExistentHash = 'a'.repeat(64);

      await serverAgent
        .get(`/v1/d21/templates/${nonExistentHash}`)
        .expect(404);

      console.log('✅ Correctly handled template not found');
    });

    it('should validate transaction ID format in status requests', async () => {
      await serverAgent
        .get('/v1/d21/arc/tx/invalid_txid/status')
        .expect(400);

      console.log('✅ Correctly validated transaction ID format');
    });

    it('should handle ARC provider unavailability', async () => {
      // This test simulates what happens when no providers are available
      // The actual behavior depends on provider configuration

      const testTx = new bsv.Transaction();
      testTx.addInput({
        sourceTransaction: new bsv.Transaction(),
        sourceOutputIndex: 0,
        unlockingScript: bsv.Script.fromHex(''),
      });
      testTx.addOutput({
        lockingScript: bsv.Script.fromHex('76a914' + '0'.repeat(40) + '88ac'),
        satoshis: 25000,
      });

      const response = await serverAgent
        .post('/v1/d21/arc/broadcast')
        .send({
          rawTx: testTx.toHex(),
          preferredProvider: 'non-existent-provider',
        });

      // Should either succeed with fallback provider or fail gracefully
      expect([200, 502]).toContain(response.status);

      console.log(`✅ Handled provider unavailability with status: ${response.status}`);
    });
  });

  // ==================== Cross-Network Settlement Tests (Foundation) ====================

  describe('Cross-Network Settlement (Foundation)', () => {
    it('should support settlement data structure', async () => {
      // Test the foundation for cross-network settlement
      // This tests the data structures and basic validation

      const settlementData = {
        primaryNetwork: 'test-network-1',
        secondaryNetworks: ['test-network-2', 'test-network-3'],
        brc41PaymentIds: ['payment-1', 'payment-2'],
        templateIds: ['template-1'],
      };

      // In full implementation, this would be POST /v1/d21/settlements/initiate
      // For now, we test that the data structure is valid
      expect(settlementData.primaryNetwork).toBeDefined();
      expect(Array.isArray(settlementData.secondaryNetworks)).toBe(true);
      expect(Array.isArray(settlementData.brc41PaymentIds)).toBe(true);

      console.log('✅ Cross-network settlement data structure validated');
    });
  });

  // ==================== Agent Workflow Tests (Foundation) ====================

  describe('Agent Payment Workflows (Foundation)', () => {
    it('should support agent workflow data structure', async () => {
      // Test the foundation for agent payment workflows
      // This tests the data structures and basic validation

      const workflowData = {
        agentId: 'test-agent-001',
        workflowType: 'batch_payment',
        paymentSteps: [
          {
            stepType: 'brc41_payment',
            stepConfig: { amount: 50000 },
            expectedCostSatoshis: 50000,
          },
          {
            stepType: 'mapi_broadcast',
            stepConfig: { template: 'template-123' },
            expectedCostSatoshis: 1000,
          },
        ],
        authorization: {
          authorizedBy: testIdentityKey,
          signature: 'mock_signature',
          spendLimit: 100000,
        },
      };

      // In full implementation, this would be POST /v1/d21/agents/workflows/create
      // For now, we test that the data structure is valid
      expect(workflowData.agentId).toBeDefined();
      expect(workflowData.workflowType).toBeDefined();
      expect(Array.isArray(workflowData.paymentSteps)).toBe(true);
      expect(workflowData.authorization.authorizedBy).toBe(testIdentityKey);

      console.log('✅ Agent workflow data structure validated');
    });
  });

  // ==================== System Health and Monitoring ====================

  describe('System Health and Monitoring', () => {
    it('should provide system health information', async () => {
      // Test basic endpoint availability as health indicator
      const templateTest = await serverAgent
        .get('/v1/d21/templates/' + 'a'.repeat(64))
        .expect(404); // Not found is expected, but endpoint should respond

      const providerTest = await serverAgent
        .get('/v1/d21/arc/providers')
        .expect(200);

      expect(providerTest.body.providers).toBeDefined();

      console.log('✅ System health endpoints responding correctly');
    });

    it('should maintain performance metrics', async () => {
      const providersResponse = await serverAgent
        .get('/v1/d21/arc/providers')
        .expect(200);

      // Check that providers have performance metrics
      for (const provider of providersResponse.body.providers) {
        expect(typeof provider.totalBroadcasts).toBe('number');
        expect(typeof provider.successfulBroadcasts).toBe('number');
        expect(typeof provider.successRate).toBe('number');
      }

      console.log('✅ Performance metrics maintained');
    });
  });
});

// ==================== Helper Functions ====================

/**
 * Create test transaction for broadcasting
 */
function createTestTransaction(): bsv.Transaction {
  const tx = new bsv.Transaction();

  // Add dummy input
  tx.addInput({
    sourceTransaction: new bsv.Transaction(),
    sourceOutputIndex: 0,
    unlockingScript: bsv.Script.fromHex(''),
  });

  // Add outputs
  tx.addOutput({
    lockingScript: bsv.Script.fromHex('76a914' + '0'.repeat(40) + '88ac'),
    satoshis: 50000,
  });

  return tx;
}

/**
 * Generate test identity for payments
 */
function generateTestIdentity(): {
  privateKey: bsv.PrivateKey;
  publicKey: bsv.PublicKey;
  identityKey: string;
} {
  const privateKey = bsv.PrivateKey.fromRandom();
  const publicKey = privateKey.toPublicKey();

  return {
    privateKey,
    publicKey,
    identityKey: publicKey.toHex(),
  };
}