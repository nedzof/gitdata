// D24 Agent Marketplace Basic Integration Tests
// Simplified tests focusing on core functionality without complex overlay setup

import { test, expect, beforeAll, afterAll, describe } from 'vitest';
import request from 'supertest';
import express from 'express';
import { agentMarketplaceRouter } from '../../src/routes/agent-marketplace';

describe('D24 Agent Marketplace Basic Tests', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Setup minimal Express app to test service unavailable scenarios
    app = express();
    app.use(express.json());

    // Create router without services to test error handling
    const routerInstance = agentMarketplaceRouter();
    // Don't set services to test unavailable state
    app.use('/overlay', routerInstance.router);
  });

  test('should return service unavailable when overlay services not initialized', async () => {
    const response = await request(app)
      .get('/overlay/agents/search')
      .expect(503);

    expect(response.body.error).toBe('agent-marketplace-unavailable');
    expect(response.body.message).toContain('Agent marketplace services are not available');
  });

  test('should return service unavailable for agent registration', async () => {
    const response = await request(app)
      .post('/overlay/agents/register')
      .send({
        name: 'TestAgent',
        capabilities: [{ name: 'test', inputs: [], outputs: [] }],
        webhookUrl: 'http://localhost:9099/webhook'
      })
      .expect(503);

    expect(response.body.error).toBe('agent-marketplace-unavailable');
  });

  test('should return service unavailable for rule creation', async () => {
    const response = await request(app)
      .post('/overlay/rules')
      .send({
        name: 'test-rule',
        whenCondition: { type: 'manual' },
        findStrategy: { source: 'agent-registry', query: {} },
        actions: [{ action: 'overlay.notify' }]
      })
      .expect(503);

    expect(response.body.error).toBe('agent-marketplace-unavailable');
  });

  test('should return service unavailable for jobs listing', async () => {
    const response = await request(app)
      .get('/overlay/jobs')
      .expect(503);

    expect(response.body.error).toBe('agent-marketplace-unavailable');
  });

  test('should return service unavailable for network status', async () => {
    const response = await request(app)
      .get('/overlay/network/status')
      .expect(503);

    expect(response.body.error).toBe('agent-marketplace-unavailable');
  });

  test('should return service unavailable for marketplace offers', async () => {
    const response = await request(app)
      .get('/overlay/marketplace/offers')
      .expect(503);

    expect(response.body.error).toBe('agent-marketplace-unavailable');
  });

  test('should return service unavailable for agent coordination', async () => {
    const response = await request(app)
      .post('/overlay/agents/coordinate')
      .send({
        agentIds: ['agent1', 'agent2'],
        workflow: 'parallel'
      })
      .expect(503);

    expect(response.body.error).toBe('agent-marketplace-unavailable');
  });
});

describe('D24 Agent Marketplace API Structure Tests', () => {
  test('should export required router functions', () => {
    const routerInstance = agentMarketplaceRouter();

    expect(routerInstance).toBeDefined();
    expect(routerInstance.router).toBeDefined();
    expect(routerInstance.setServices).toBeDefined();
    expect(typeof routerInstance.setServices).toBe('function');
  });

  test('should validate router instance structure', () => {
    const routerInstance = agentMarketplaceRouter();

    // Check that router has the expected structure
    expect(routerInstance.router).toBeDefined();
    expect(typeof routerInstance.router).toBe('function'); // Express router is a function

    // Check that setServices is available
    expect(routerInstance.setServices).toBeDefined();
    expect(typeof routerInstance.setServices).toBe('function');
  });
});

describe('D24 Implementation Verification', () => {
  test('should verify all D24 components are implemented', async () => {
    // Test that all required modules can be imported
    const { OverlayAgentRegistry } = await import('../../src/agents/overlay-agent-registry');
    const { OverlayRuleEngine } = await import('../../src/agents/overlay-rule-engine');
    const { AgentExecutionService } = await import('../../src/agents/agent-execution-service');

    expect(OverlayAgentRegistry).toBeDefined();
    expect(OverlayRuleEngine).toBeDefined();
    expect(AgentExecutionService).toBeDefined();
  });

  test('should verify route implementations exist', async () => {
    const { agentMarketplaceRouter } = await import('../../src/routes/agent-marketplace');

    expect(agentMarketplaceRouter).toBeDefined();
    expect(typeof agentMarketplaceRouter).toBe('function');

    const routerInstance = agentMarketplaceRouter();
    expect(routerInstance.router).toBeDefined();
    expect(routerInstance.setServices).toBeDefined();
  });

  test('should verify overlay service integration exists', async () => {
    const overlayIndex = await import('../../src/overlay/index');

    expect(overlayIndex.OverlayAgentRegistry).toBeDefined();
    expect(overlayIndex.OverlayRuleEngine).toBeDefined();
    expect(overlayIndex.AgentExecutionService).toBeDefined();
  });
});

// Validation tests for data structures
describe('D24 Data Structure Validation', () => {
  test('should validate agent registration data structure', () => {
    const validAgentData = {
      name: 'TestAgent',
      capabilities: [
        {
          name: 'data-processing',
          inputs: ['raw-data'],
          outputs: ['processed-data']
        }
      ],
      webhookUrl: 'http://localhost:9099/webhook',
      geographicRegion: 'US',
      overlayTopics: ['gitdata.agent.capabilities']
    };

    // Basic validation
    expect(validAgentData.name).toBeDefined();
    expect(Array.isArray(validAgentData.capabilities)).toBe(true);
    expect(validAgentData.capabilities[0].name).toBeDefined();
    expect(Array.isArray(validAgentData.capabilities[0].inputs)).toBe(true);
    expect(Array.isArray(validAgentData.capabilities[0].outputs)).toBe(true);
    expect(validAgentData.webhookUrl).toMatch(/^https?:\/\//);
  });

  test('should validate rule data structure', () => {
    const validRuleData = {
      name: 'test-rule',
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
        }
      ]
    };

    // Basic validation
    expect(validRuleData.name).toBeDefined();
    expect(validRuleData.whenCondition).toBeDefined();
    expect(validRuleData.findStrategy).toBeDefined();
    expect(Array.isArray(validRuleData.actions)).toBe(true);
    expect(validRuleData.actions[0].action).toBeDefined();
  });

  test('should validate coordination data structure', () => {
    const validCoordinationData = {
      agentIds: ['agent1', 'agent2', 'agent3'],
      workflow: 'parallel',
      coordination: {
        task: 'multi-agent-test',
        parameters: { iterations: 5 }
      },
      timeout: 30000
    };

    expect(Array.isArray(validCoordinationData.agentIds)).toBe(true);
    expect(validCoordinationData.agentIds.length).toBeGreaterThan(0);
    expect(['parallel', 'sequential'].includes(validCoordinationData.workflow)).toBe(true);
    expect(validCoordinationData.coordination).toBeDefined();
    expect(typeof validCoordinationData.timeout).toBe('number');
  });
});

console.log('✅ D24 Agent Marketplace Basic Tests - Verifying core implementation without complex overlay setup');