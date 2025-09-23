// D24 Agent Marketplace Integration Tests - Updated for Overlay Network
// Tests the complete overlay-based agent marketplace with BRC standards integration

import { test, expect, beforeAll, afterAll, beforeEach, describe } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getPostgreSQLClient } from '../../src/db/postgresql';
import { initializeOverlayServices } from '../../src/overlay';
import { agentMarketplaceRouter } from '../../src/routes/agent-marketplace';
import { enhancedOverlayRouter } from '../../src/routes/overlay-brc';
import { rateLimit } from '../../src/middleware/limits';
import {
  enforceAgentRegistrationPolicy,
  enforceRuleConcurrency,
  enforceJobCreationPolicy,
  enforceResourceLimits,
  enforceAgentSecurityPolicy,
  resetPolicyState
} from '../../src/middleware/policy';

let app: express.Application;
let pgClient: any;
let overlayServices: any;

beforeAll(async () => {
  // Initialize PostgreSQL for testing
  pgClient = getPostgreSQLClient();
  const pgPool = pgClient.getPool();

  // Mock overlay services for tests
  overlayServices = {
    manager: {
      isInitialized: () => true,
      initialize: async () => {},
      shutdown: async () => {}
    },
    brc22: {
      initialized: true,
      initialize: async () => {},
      shutdown: async () => {}
    },
    brc24: {
      initialized: true,
      initialize: async () => {},
      shutdown: async () => {}
    },
    agentRegistry: {
      registerAgent: async () => ({ success: true, agentId: 'test-agent-id' }),
      searchAgents: async () => ({ agents: [], total: 0 }),
      updateAgentPing: async () => ({ success: true }),
      getRegistryStats: async () => ({ totalAgents: 0, activeAgents: 0, regions: [] }),
      getMarketplaceOffers: async () => ({ offers: [] }),
      createSHIPAdvertisement: async () => ({ success: true, advertisementId: 'test-ad-id' })
    },
    ruleEngine: {
      createRule: async () => ({ success: true, ruleId: 'rule_test-rule-id' }),
      triggerRule: async () => ({ success: true, jobId: 'test-job-id' }),
      listRules: async () => ([]),
      listJobs: async () => ([]),
      stopJobProcessor: () => {}
    },
    executionService: {
      storeEvidence: async () => ({ success: true }),
      getReputation: async () => ({ reputation: 0, performance: {} }),
      updateCapabilities: async () => ({ success: true }),
      coordinateAgents: async () => ({ success: true, coordinationId: 'test-coord-id' }),
      getJobLineage: async () => ({ lineage: [] }),
      getBRC31Stats: async () => ({ identities: 0, verifications: 0 })
    }
  };

  // Setup Express app with overlay-based agent marketplace
  app = express();
  app.use(express.json({ limit: '5mb' }));

  // Create router instances
  const agentMarketplaceRouterInstance = agentMarketplaceRouter();
  const enhancedOverlayRouterInstance = enhancedOverlayRouter();

  // Connect services to routers
  agentMarketplaceRouterInstance.setServices({
    agentRegistry: overlayServices.agentRegistry,
    ruleEngine: overlayServices.ruleEngine,
    executionService: overlayServices.executionService
  });

  enhancedOverlayRouterInstance.setOverlayServices(overlayServices);

  // Mount routes with middleware
  app.use('/overlay',
    rateLimit('overlay'),
    enforceResourceLimits(),
    enforceAgentSecurityPolicy(),
    enforceAgentRegistrationPolicy(),
    agentMarketplaceRouterInstance.router
  );

  app.use('/overlay',
    rateLimit('overlay'),
    enhancedOverlayRouterInstance.router
  );

  console.log('[TEST] D24 Agent Marketplace initialized with overlay services');
});

afterAll(async () => {
  await cleanupTestData();
  if (overlayServices?.ruleEngine) {
    overlayServices.ruleEngine.stopJobProcessor();
  }
  await pgClient.close();
});

beforeEach(async () => {
  await cleanupTestData();
  resetPolicyState();
});

describe('D24 Overlay Agent Marketplace E2E Tests', () => {

  describe('Agent Registration via BRC-88', () => {
    test('should register agent with SHIP advertisement on overlay network', async () => {
      const agentData = {
        name: 'ContractBot',
        capabilities: [
          {
            name: 'contract-generation',
            inputs: ['manifest', 'template'],
            outputs: ['contract-pdf', 'metadata']
          },
          {
            name: 'legal-review',
            inputs: ['contract'],
            outputs: ['review-report', 'approval-status']
          }
        ],
        overlayTopics: ['gitdata.agent.capabilities', 'gitdata.agent.jobs'],
        webhookUrl: 'http://localhost:9099/webhook',
        geographicRegion: 'EU',
        identityKey: '0339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2'
      };

      const response = await request(app)
        .post('/overlay/agents/register')
        .send(agentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.agent).toBeDefined();
      expect(response.body.agent.agentId).toMatch(/^agent_/);
      expect(response.body.agent.name).toBe('ContractBot');
      expect(response.body.agent.capabilities).toHaveLength(2);
      expect(response.body.agent.overlayTopics).toContain('gitdata.agent.capabilities');
      expect(response.body.agent.reputationScore).toBe(0.0);
      expect(response.body.agent.status).toBe('unknown');
    });

    test('should reject invalid agent registration', async () => {
      const invalidData = {
        name: 'InvalidAgent',
        // Missing required capabilities and webhookUrl
        overlayTopics: ['gitdata.agent.capabilities']
      };

      const response = await request(app)
        .post('/overlay/agents/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('invalid-request');
      expect(response.body.message).toContain('capabilities');
    });

    test('should search agents by capability and region', async () => {
      // Register multiple agents
      const agents = [
        {
          name: 'DataProcessor-US',
          capabilities: [{ name: 'data-processing', inputs: ['data'], outputs: ['results'] }],
          webhookUrl: 'http://localhost:9099/webhook1',
          geographicRegion: 'US'
        },
        {
          name: 'DataProcessor-EU',
          capabilities: [{ name: 'data-processing', inputs: ['data'], outputs: ['results'] }],
          webhookUrl: 'http://localhost:9099/webhook2',
          geographicRegion: 'EU'
        },
        {
          name: 'ContractBot-EU',
          capabilities: [{ name: 'contract-generation', inputs: ['template'], outputs: ['contract'] }],
          webhookUrl: 'http://localhost:9099/webhook3',
          geographicRegion: 'EU'
        }
      ];

      for (const agent of agents) {
        await request(app)
          .post('/overlay/agents/register')
          .send(agent)
          .expect(200);
      }

      // Search by capability
      const capabilitySearch = await request(app)
        .get('/overlay/agents/search?capability=data-processing')
        .expect(200);

      expect(capabilitySearch.body.success).toBe(true);
      expect(capabilitySearch.body.agents).toHaveLength(2);

      // Search by region
      const regionSearch = await request(app)
        .get('/overlay/agents/search?region=EU')
        .expect(200);

      expect(regionSearch.body.success).toBe(true);
      expect(regionSearch.body.agents).toHaveLength(2);

      // Search by both
      const combinedSearch = await request(app)
        .get('/overlay/agents/search?capability=data-processing&region=EU')
        .expect(200);

      expect(combinedSearch.body.success).toBe(true);
      expect(combinedSearch.body.agents).toHaveLength(1);
      expect(combinedSearch.body.agents[0].name).toBe('DataProcessor-EU');
    });

    test('should update agent ping status', async () => {
      // Register agent
      const agentResponse = await request(app)
        .post('/overlay/agents/register')
        .send({
          name: 'TestAgent',
          capabilities: [{ name: 'test', inputs: [], outputs: [] }],
          webhookUrl: 'http://localhost:9099/webhook'
        })
        .expect(200);

      const agentId = agentResponse.body.agent.agentId;

      // Update ping status
      const pingResponse = await request(app)
        .post(`/overlay/agents/${agentId}/ping`)
        .send({ status: true })
        .expect(200);

      expect(pingResponse.body.success).toBe(true);
      expect(pingResponse.body.status).toBe('up');

      // Verify agent status updated
      const searchResponse = await request(app)
        .get('/overlay/agents/search')
        .expect(200);

      const updatedAgent = searchResponse.body.agents.find(a => a.agentId === agentId);
      expect(updatedAgent.status).toBe('up');
    });
  });

  describe('Rule Engine with Overlay Events', () => {
    test('should create overlay-aware rules', async () => {
      const ruleData = {
        name: 'auto-contract-generation',
        overlayTopics: ['gitdata.d01a.manifest'],
        whenCondition: {
          type: 'overlay-event',
          topic: 'gitdata.d01a.manifest',
          predicate: {
            and: [
              { includes: { tags: 'premium' } },
              { eq: { classification: 'public' } }
            ]
          }
        },
        findStrategy: {
          source: 'agent-registry',
          query: { capability: 'contract-generation' },
          limit: 5
        },
        actions: [
          {
            action: 'overlay.notify',
            capability: 'contract-generation',
            payload: { type: 'contract-request' }
          },
          {
            action: 'brc26.store',
            type: 'contract-template',
            templateId: 'premium-data-agreement'
          }
        ]
      };

      const response = await request(app)
        .post('/overlay/rules')
        .send(ruleData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.rule).toBeDefined();
      expect(response.body.rule.ruleId).toMatch(/^rule_/);
      expect(response.body.rule.name).toBe('auto-contract-generation');
      expect(response.body.rule.enabled).toBe(true);
      expect(response.body.rule.overlayTopics).toContain('gitdata.d01a.manifest');
      expect(response.body.rule.actions).toHaveLength(2);
    });

    test('should trigger rules manually and create jobs', async () => {
      // Register agent first
      const agentResponse = await request(app)
        .post('/overlay/agents/register')
        .send({
          name: 'ContractBot',
          capabilities: [{ name: 'contract-generation', inputs: ['template'], outputs: ['contract'] }],
          webhookUrl: 'http://localhost:9099/webhook'
        })
        .expect(200);

      // Create rule
      const ruleResponse = await request(app)
        .post('/overlay/rules')
        .send({
          name: 'test-rule',
          whenCondition: { type: 'manual' },
          findStrategy: {
            source: 'agent-registry',
            query: { capability: 'contract-generation' }
          },
          actions: [{ action: 'overlay.notify', capability: 'contract-generation' }]
        })
        .expect(200);

      const ruleId = ruleResponse.body.rule.ruleId;

      // Trigger rule
      const triggerResponse = await request(app)
        .post(`/overlay/rules/${ruleId}/trigger`)
        .send({
          triggerEvent: {
            type: 'manual-test',
            datasetId: 'test-dataset',
            tags: ['test']
          }
        })
        .expect(200);

      expect(triggerResponse.body.success).toBe(true);
      expect(triggerResponse.body.createdJobs).toBeDefined();
      expect(Array.isArray(triggerResponse.body.createdJobs)).toBe(true);
    });

    test('should list rules and jobs', async () => {
      // Create a rule first
      await request(app)
        .post('/overlay/rules')
        .send({
          name: 'test-listing-rule',
          whenCondition: { type: 'manual' },
          findStrategy: { source: 'agent-registry', query: {} },
          actions: [{ action: 'overlay.notify' }]
        })
        .expect(200);

      // List rules
      const rulesResponse = await request(app)
        .get('/overlay/rules')
        .expect(200);

      expect(rulesResponse.body.success).toBe(true);
      expect(Array.isArray(rulesResponse.body.rules)).toBe(true);
      expect(rulesResponse.body.rules.length).toBeGreaterThan(0);

      // List jobs
      const jobsResponse = await request(app)
        .get('/overlay/jobs')
        .expect(200);

      expect(jobsResponse.body.success).toBe(true);
      expect(Array.isArray(jobsResponse.body.jobs)).toBe(true);
    });
  });

  describe('Agent Execution with BRC-31 Identity', () => {
    test('should store job execution evidence', async () => {
      // Register agent
      const agentResponse = await request(app)
        .post('/overlay/agents/register')
        .send({
          name: 'TestAgent',
          capabilities: [{ name: 'data-processing', inputs: ['data'], outputs: ['results'] }],
          webhookUrl: 'http://localhost:9099/webhook',
          identityKey: '0339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2'
        })
        .expect(200);

      const agentId = agentResponse.body.agent.agentId;

      // Create rule and trigger to get job
      const ruleResponse = await request(app)
        .post('/overlay/rules')
        .send({
          name: 'evidence-test-rule',
          whenCondition: { type: 'manual' },
          findStrategy: {
            source: 'agent-registry',
            query: { capability: 'data-processing' }
          },
          actions: [{ action: 'overlay.notify', capability: 'data-processing' }]
        })
        .expect(200);

      const triggerResponse = await request(app)
        .post(`/overlay/rules/${ruleResponse.body.rule.ruleId}/trigger`)
        .expect(200);

      // Wait for job processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // List jobs to get job ID
      const jobsResponse = await request(app)
        .get('/overlay/jobs')
        .expect(200);

      if (jobsResponse.body.jobs.length > 0) {
        const jobId = jobsResponse.body.jobs[0].jobId;

        // Store execution evidence
        const evidenceResponse = await request(app)
          .post(`/overlay/jobs/${jobId}/evidence`)
          .send({
            agentId,
            artifacts: [
              {
                type: 'processed-data',
                hash: 'brc26_test_hash',
                contentType: 'application/json',
                size: 1024,
                metadata: { processedAt: Date.now() }
              }
            ],
            executionTime: 2500,
            success: true,
            signature: 'mock_signature_12345',
            nonce: 'test_nonce_67890',
            clientFeedback: {
              quality: 'excellent',
              notes: 'Processed successfully'
            }
          })
          .expect(200);

        expect(evidenceResponse.body.success).toBe(true);
        expect(evidenceResponse.body.jobId).toBe(jobId);
        expect(evidenceResponse.body.artifactCount).toBe(1);
      }
    });

    test('should get agent reputation and performance', async () => {
      // Register agent
      const agentResponse = await request(app)
        .post('/overlay/agents/register')
        .send({
          name: 'ReputationAgent',
          capabilities: [{ name: 'quality-service', inputs: ['request'], outputs: ['response'] }],
          webhookUrl: 'http://localhost:9099/webhook'
        })
        .expect(200);

      const agentId = agentResponse.body.agent.agentId;

      // Get reputation (should be initial state)
      const reputationResponse = await request(app)
        .get(`/overlay/agents/${agentId}/reputation`)
        .expect(200);

      expect(reputationResponse.body.success).toBe(true);
      expect(reputationResponse.body.agent).toBeDefined();
      expect(reputationResponse.body.agent.agentId).toBe(agentId);
      expect(reputationResponse.body.agent.reputationScore).toBe(0.0);
      expect(reputationResponse.body.performanceHistory).toEqual([]);
      expect(reputationResponse.body.identityVerification).toBeDefined();
    });

    test('should update agent capabilities', async () => {
      // Register agent
      const agentResponse = await request(app)
        .post('/overlay/agents/register')
        .send({
          name: 'UpdatableAgent',
          capabilities: [{ name: 'basic-service', inputs: ['input'], outputs: ['output'] }],
          webhookUrl: 'http://localhost:9099/webhook'
        })
        .expect(200);

      const agentId = agentResponse.body.agent.agentId;

      // Update capabilities
      const updateResponse = await request(app)
        .put(`/overlay/agents/${agentId}/capabilities`)
        .send({
          capabilities: [
            { name: 'basic-service', inputs: ['input'], outputs: ['output'] },
            { name: 'advanced-service', inputs: ['complex-input'], outputs: ['complex-output'] }
          ],
          overlayTopics: ['gitdata.agent.capabilities', 'gitdata.advanced.services']
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.agentId).toBe(agentId);

      // Verify capabilities updated
      const searchResponse = await request(app)
        .get(`/overlay/agents/search?capability=advanced-service`)
        .expect(200);

      expect(searchResponse.body.agents).toHaveLength(1);
      expect(searchResponse.body.agents[0].agentId).toBe(agentId);
    });
  });

  describe('Multi-Agent Coordination', () => {
    test('should coordinate multiple agents', async () => {
      // Register multiple agents
      const agentIds: string[] = [];

      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/overlay/agents/register')
          .send({
            name: `CoordAgent${i}`,
            capabilities: [{ name: 'coordination-task', inputs: ['task'], outputs: ['result'] }],
            webhookUrl: `http://localhost:909${i}/webhook`
          })
          .expect(200);

        agentIds.push(response.body.agent.agentId);
      }

      // Initiate coordination
      const coordinationResponse = await request(app)
        .post('/overlay/agents/coordinate')
        .send({
          agentIds,
          workflow: 'parallel',
          coordination: {
            task: 'multi-agent-test',
            parameters: { iterations: 5 }
          },
          timeout: 30000
        })
        .expect(200);

      expect(coordinationResponse.body.success).toBe(true);
      expect(coordinationResponse.body.coordinationId).toBeDefined();
      expect(coordinationResponse.body.agentIds).toEqual(agentIds);
      expect(coordinationResponse.body.workflow).toBe('parallel');
      expect(coordinationResponse.body.createdJobs).toBeDefined();
    });

    test('should get job lineage information', async () => {
      // Register agent and create job
      const agentResponse = await request(app)
        .post('/overlay/agents/register')
        .send({
          name: 'LineageAgent',
          capabilities: [{ name: 'lineage-test', inputs: ['data'], outputs: ['traced-data'] }],
          webhookUrl: 'http://localhost:9099/webhook'
        })
        .expect(200);

      const ruleResponse = await request(app)
        .post('/overlay/rules')
        .send({
          name: 'lineage-rule',
          whenCondition: { type: 'manual' },
          findStrategy: {
            source: 'agent-registry',
            query: { capability: 'lineage-test' }
          },
          actions: [{ action: 'overlay.notify', capability: 'lineage-test' }]
        })
        .expect(200);

      const triggerResponse = await request(app)
        .post(`/overlay/rules/${ruleResponse.body.rule.ruleId}/trigger`)
        .expect(200);

      if (triggerResponse.body.createdJobs.length > 0) {
        const jobId = triggerResponse.body.createdJobs[0];

        // Get lineage information
        const lineageResponse = await request(app)
          .get(`/overlay/jobs/${jobId}/lineage`)
          .expect(200);

        expect(lineageResponse.body.success).toBe(true);
        expect(lineageResponse.body.job).toBeDefined();
        expect(lineageResponse.body.job.jobId).toBe(jobId);
        expect(lineageResponse.body.lineageGraph).toBeDefined();
        expect(lineageResponse.body.lineageGraph.nodes).toBeDefined();
        expect(lineageResponse.body.lineageGraph.edges).toBeDefined();
      }
    });
  });

  describe('Overlay Network Integration', () => {
    test('should get network status', async () => {
      const response = await request(app)
        .get('/overlay/network/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.overlayNetwork).toBeDefined();
      expect(response.body.overlayNetwork.status).toBe('connected');
      expect(response.body.agentRegistry).toBeDefined();
      expect(response.body.identityVerification).toBeDefined();
      expect(response.body.services).toBeDefined();
      expect(response.body.services.brc22).toContain('Active');
      expect(response.body.services.brc26).toContain('Active');
    });

    test('should get marketplace offers', async () => {
      const response = await request(app)
        .get('/overlay/marketplace/offers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.offers)).toBe(true);
      expect(response.body.count).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle service unavailable gracefully', async () => {
      // Create a temporary app without services
      const tempApp = express();
      tempApp.use(express.json());

      const tempRouter = agentMarketplaceRouter();
      // Don't set services - should trigger unavailable response
      tempApp.use('/overlay', tempRouter.router);

      const response = await request(tempApp)
        .get('/overlay/agents/search')
        .expect(503);

      expect(response.body.error).toBe('agent-marketplace-unavailable');
    });

    test('should validate agent registration data', async () => {
      const testCases = [
        {
          data: { name: 'Test' }, // Missing capabilities and webhookUrl
          expectedError: 'invalid-request'
        },
        {
          data: {
            name: 'Test',
            capabilities: 'not-an-array',
            webhookUrl: 'http://test.com'
          },
          expectedError: 'invalid-request'
        },
        {
          data: {
            name: 'Test',
            capabilities: [{ name: 'test' }], // Missing inputs/outputs
            webhookUrl: 'http://test.com'
          },
          expectedError: 'invalid-capabilities'
        },
        {
          data: {
            name: 'Test',
            capabilities: [{ name: 'test', inputs: [], outputs: [] }],
            webhookUrl: 'invalid-url'
          },
          expectedError: 'invalid-webhook-url'
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/overlay/agents/register')
          .send(testCase.data)
          .expect(400);

        expect(response.body.error).toBe(testCase.expectedError);
      }
    });

    test('should handle rule validation', async () => {
      const invalidRule = {
        name: 'invalid-rule'
        // Missing required fields
      };

      const response = await request(app)
        .post('/overlay/rules')
        .send(invalidRule)
        .expect(400);

      expect(response.body.error).toBe('invalid-rule');
    });
  });
});

// Helper functions

async function cleanupTestData(): Promise<void> {
  if (!pgClient) return;

  try {
    await pgClient.query('DELETE FROM agent_performance');
    await pgClient.query('DELETE FROM agent_executions');
    await pgClient.query('DELETE FROM brc31_verifications');
    await pgClient.query('DELETE FROM rule_executions');
    await pgClient.query('DELETE FROM overlay_jobs');
    await pgClient.query('DELETE FROM overlay_rules');
    await pgClient.query('DELETE FROM overlay_agents');
    console.log('[TEST] Cleaned up test data');
  } catch (error) {
    console.warn('[TEST] Cleanup warning:', error.message);
  }
}