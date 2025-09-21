import { test, expect, beforeAll, afterAll, beforeEach, describe } from 'vitest';
import request from 'supertest';
import express from 'express';
import { agentsRouter } from '../../src/routes/agents';
import { rulesRouter } from '../../src/routes/rules';
import { jobsRouter } from '../../src/routes/jobs';
import { templatesRouter } from '../../src/routes/templates';
import { artifactsRouter } from '../../src/routes/artifacts';
import { startJobsWorker } from '../../src/agents/worker';
import { initSchema } from '../../src/db';
import {
  enforceAgentRegistrationPolicy,
  enforceRuleConcurrency,
  enforceJobCreationPolicy,
  enforceResourceLimits,
  enforceAgentSecurityPolicy,
  resetPolicyState
} from '../../src/middleware/policy';

let app: express.Application;
let workerCleanup: any;

beforeAll(async () => {
  // Initialize PostgreSQL database
  await initSchema();

  // Setup Express app with agent marketplace routes - PostgreSQL only, no database parameters
  app = express();
  app.use(express.json({ limit: '5mb' })); // Increase limit to test resource limits middleware
  app.use('/agents', enforceResourceLimits(), enforceAgentSecurityPolicy(), enforceAgentRegistrationPolicy(), agentsRouter());
  app.use('/rules', enforceResourceLimits(), enforceRuleConcurrency(), enforceJobCreationPolicy(), rulesRouter());
  app.use('/jobs', jobsRouter());
  app.use('/templates', enforceResourceLimits(), templatesRouter());
  app.use('/artifacts', artifactsRouter());

  // Start worker - disabled for PostgreSQL-only tests
  // workerCleanup = startJobsWorker(db);

  // Wait a bit for setup
  await new Promise(resolve => setTimeout(resolve, 100));
});

beforeEach(async () => {
  // Reset policy state between tests to avoid rate limiting carryover
  resetPolicyState();

  // Clean up database between tests
  const { getPostgreSQLClient } = await import('../../src/db/postgresql');
  const pgClient = getPostgreSQLClient();
  await pgClient.query('DELETE FROM agents WHERE name LIKE $1', ['%Test%']);
  await pgClient.query('DELETE FROM agents WHERE name LIKE $1', ['%Lifecycle%']);
  await pgClient.query('DELETE FROM rules WHERE name LIKE $1', ['%Test%']);
  await pgClient.query('DELETE FROM contract_templates WHERE name LIKE $1 OR name LIKE $2', ['%Test%', '%Data Processing%']);
});

afterAll(() => {
  if (workerCleanup) workerCleanup();
  // PostgreSQL cleanup handled by connection pool
});

test('D24 Agent Marketplace - Full Workflow', async () => {
  // 1. Register an agent
  const agentResponse = await request(app)
    .post('/agents/register')
    .send({
      name: 'Test Data Processor',
      webhookUrl: 'http://localhost:9999/webhook',
      capabilities: ['notify', 'contract.generate']
    });

  expect(agentResponse.status).toBe(201);
  expect(agentResponse.body.status).toBe('active');
  expect(agentResponse.body.agentId).toBeDefined();

  const agentId = agentResponse.body.agentId;

  // 2. Search for agents
  const searchResponse = await request(app)
    .get('/agents/search?q=Test')
    .expect(200);

  expect(searchResponse.body.items).toHaveLength(1);
  expect(searchResponse.body.items[0].agentId).toBe(agentId);
  expect(searchResponse.body.items[0].name).toBe('Test Data Processor');

  // 3. Create a contract template
  const templateResponse = await request(app)
    .post('/templates')
    .send({
      name: 'Test Agreement',
      content: 'Agreement for {{DATASET_ID}} processing',
      type: 'markdown',
      variables: {
        variables: [
          { name: 'DATASET_ID', type: 'string', required: true }
        ]
      }
    });

  expect(templateResponse.status).toBe(200);
  const templateId = templateResponse.body.templateId;

  // 4. Create a rule that uses the agent and template
  const ruleResponse = await request(app)
    .post('/rules')
    .send({
      name: 'Test Automation Rule',
      enabled: true,
      when: { type: 'ready', predicate: {} },
      find: { source: 'search', query: { q: '' }, limit: 1 },
      actions: [
        { action: 'notify', agentId },
        {
          action: 'contract.generate',
          templateId,
          variables: { DATASET_ID: 'test-dataset' }
        }
      ]
    });

  expect(ruleResponse.status).toBe(201);
  const ruleId = ruleResponse.body.ruleId;

  // 5. Get the created rule
  const getRuleResponse = await request(app)
    .get(`/rules/${ruleId}`)
    .expect(200);

  expect(getRuleResponse.body.name).toBe('Test Automation Rule');
  expect(getRuleResponse.body.actions).toBeDefined();

  // 6. List templates
  const listTemplatesResponse = await request(app)
    .get('/templates')
    .expect(200);

  expect(listTemplatesResponse.body.items).toHaveLength(1);
  expect(listTemplatesResponse.body.items[0].templateId).toBe(templateId);

  // 7. Generate contract from template
  const generateResponse = await request(app)
    .post(`/templates/${templateId}/generate`)
    .send({
      variables: { DATASET_ID: 'example-dataset' }
    });

  expect(generateResponse.status).toBe(200);
  expect(generateResponse.body.status).toBe('ok');
  expect(generateResponse.body.content).toContain('Agreement for example-dataset processing');

  // 8. Check initial jobs
  const initialJobsResponse = await request(app)
    .get('/jobs')
    .expect(200);

  expect(initialJobsResponse.body.items).toHaveLength(0);
}, 15000);

test('D24 Policy Enforcement', async () => {
  // Test agent registration rate limiting by creating multiple agents
  const results = [];

  for (let i = 0; i < 6; i++) {
    const response = await request(app)
      .post('/agents/register')
      .set('x-test-rate-limits', 'true')
      .send({
        name: `Test Agent ${i}`,
        webhookUrl: `http://localhost:999${i}/webhook`,
        capabilities: ['test']
      });
    results.push(response.status);
  }

  // Should succeed for first 5 (default limit), fail on 6th
  expect(results.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
  expect(results[5]).toBe(429); // Rate limited
}, 10000);

test('D24 Template Validation', async () => {
  // Test template with invalid variables
  const invalidTemplateResponse = await request(app)
    .post('/templates')
    .send({
      name: 'Invalid Template',
      content: 'Content with {{MISSING_VAR}}',
      variables: {
        variables: [
          { name: 'REQUIRED_VAR', type: 'string', required: true }
        ]
      }
    });

  expect(invalidTemplateResponse.status).toBe(200);
  const templateId = invalidTemplateResponse.body.templateId;

  // Try to generate contract without required variable
  const generateResponse = await request(app)
    .post(`/templates/${templateId}/generate`)
    .send({
      variables: { WRONG_VAR: 'value' }
    });

  expect(generateResponse.status).toBe(400);
  expect(generateResponse.body.error).toBe('generation-failed');
  expect(generateResponse.body.message).toContain('Required variable');
});

test('D24 Security Policies', async () => {
  // Test invalid webhook URL
  const invalidWebhookResponse = await request(app)
    .post('/agents/register')
    .send({
      name: 'Invalid Agent',
      webhookUrl: 'not-a-url',
      capabilities: ['test']
    });

  expect(invalidWebhookResponse.status).toBe(400);
  expect(invalidWebhookResponse.body.error).toBe('invalid-webhook-url');

  // Test too many capabilities
  const tooManyCapabilities = Array.from({ length: 25 }, (_, i) => `capability-${i}`);

  const tooManyCapabilitiesResponse = await request(app)
    .post('/agents/register')
    .send({
      name: 'Overloaded Agent',
      webhookUrl: 'http://localhost:9999/webhook',
      capabilities: tooManyCapabilities
    });

  expect(tooManyCapabilitiesResponse.status).toBe(400);
  expect(tooManyCapabilitiesResponse.body.error).toBe('too-many-capabilities');
});

describe('D24 Comprehensive Testing Suite', () => {

  describe('Agent Management', () => {
    test('should handle agent lifecycle (register, search, ping)', async () => {
      // Register
      const registerResponse = await request(app)
        .post('/agents/register')
        .send({
          name: 'Lifecycle Test Agent',
          webhookUrl: 'https://api.example.com/webhook',
          capabilities: ['notify', 'process', 'validate'],
          identityKey: 'test-identity-key'
        });

      expect(registerResponse.status).toBe(201);
      const agentId = registerResponse.body.agentId;

      // Search by name
      const searchByNameResponse = await request(app)
        .get('/agents/search?q=Lifecycle');
      expect(searchByNameResponse.status).toBe(200);
      expect(searchByNameResponse.body.items.length).toBeGreaterThanOrEqual(1);
      expect(searchByNameResponse.body.items[0].name).toBe('Lifecycle Test Agent');

      // Search by capability
      const searchByCapabilityResponse = await request(app)
        .get('/agents/search?capability=process');
      expect(searchByCapabilityResponse.status).toBe(200);
      expect(searchByCapabilityResponse.body.items.length).toBeGreaterThan(0);

      // Ping agent
      const pingResponse = await request(app)
        .post(`/agents/${agentId}/ping`);
      expect(pingResponse.status).toBe(200);
      expect(pingResponse.body.status).toBe('pinged');
    });

    test('should validate agent registration data', async () => {
      // Missing required fields
      const missingFieldsResponse = await request(app)
        .post('/agents/register')
        .send({ name: 'Test Agent' });
      expect(missingFieldsResponse.status).toBe(400);

      // Invalid capability names
      const invalidCapabilityResponse = await request(app)
        .post('/agents/register')
        .send({
          name: 'Invalid Agent',
          webhookUrl: 'https://api.example.com/webhook',
          capabilities: ['valid-capability', 'invalid capability with spaces!']
        });
      expect(invalidCapabilityResponse.status).toBe(400);
      expect(invalidCapabilityResponse.body.error).toBe('invalid-capability');
    });
  });

  describe('Rule Management', () => {
    let testAgentId: string;

    beforeAll(async () => {
      // Create a test agent for rule tests
      const agentResponse = await request(app)
        .post('/agents/register')
        .send({
          name: 'Rule Test Agent',
          webhookUrl: 'https://api.example.com/webhook',
          capabilities: ['notify', 'process']
        });
      testAgentId = agentResponse.body.agentId;
    });

    test('should create and manage rules', async () => {
      // Create rule
      const createResponse = await request(app)
        .post('/rules')
        .send({
          name: 'Test Processing Rule',
          enabled: true,
          when: { type: 'ready', predicate: { eq: { status: 'pending' } } },
          find: { source: 'search', query: { q: 'test-data' }, limit: 5 },
          actions: [
            { action: 'notify', agentId: testAgentId, payload: { message: 'Processing started' } }
          ]
        });

      expect(createResponse.status).toBe(201);
      const ruleId = createResponse.body.ruleId;

      // Get rule
      const getResponse = await request(app).get(`/rules/${ruleId}`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.name).toBe('Test Processing Rule');
      expect(getResponse.body.enabled).toBe(true);

      // Update rule
      const updateResponse = await request(app)
        .patch(`/rules/${ruleId}`)
        .send({ enabled: false, name: 'Updated Rule Name' });
      expect(updateResponse.status).toBe(200);

      // Verify update
      const getUpdatedResponse = await request(app).get(`/rules/${ruleId}`);
      expect(getUpdatedResponse.body.enabled).toBe(false);
      expect(getUpdatedResponse.body.name).toBe('Updated Rule Name');

      // Delete rule
      const deleteResponse = await request(app).delete(`/rules/${ruleId}`);
      expect(deleteResponse.status).toBe(200);

      // Verify deletion
      const getDeletedResponse = await request(app).get(`/rules/${ruleId}`);
      expect(getDeletedResponse.status).toBe(404);
    });

    test('should validate rule structure', async () => {
      const invalidRuleResponse = await request(app)
        .post('/rules')
        .send({
          name: 'Invalid Rule',
          // Missing required fields
        });
      expect(invalidRuleResponse.status).toBe(400);
    });
  });

  describe('Template System', () => {
    test('should manage contract templates', async () => {
      // Create template
      const createTemplateResponse = await request(app)
        .post('/templates')
        .send({
          name: 'Data Processing Contract',
          description: 'Standard contract for data processing services',
          content: `# Data Processing Agreement

Provider: {{PROVIDER_NAME}}
Consumer: {{CONSUMER_NAME}}
Dataset: {{DATASET_ID}}
Price: {{PRICE_SATS}} satoshis

Generated: {{GENERATED_AT}}`,
          type: 'markdown',
          variables: {
            variables: [
              { name: 'PROVIDER_NAME', type: 'string', required: true },
              { name: 'CONSUMER_NAME', type: 'string', required: true },
              { name: 'DATASET_ID', type: 'string', required: true },
              { name: 'PRICE_SATS', type: 'number', required: true }
            ]
          }
        });

      expect(createTemplateResponse.status).toBe(200);
      const templateId = createTemplateResponse.body.templateId;

      // List templates
      const listResponse = await request(app).get('/templates');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.items.length).toBeGreaterThan(0);

      // Get template
      const getResponse = await request(app).get(`/templates/${templateId}`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.name).toBe('Data Processing Contract');

      // Generate contract
      const generateResponse = await request(app)
        .post(`/templates/${templateId}/generate`)
        .send({
          variables: {
            PROVIDER_NAME: 'Data Corp',
            CONSUMER_NAME: 'Analytics Inc',
            DATASET_ID: 'financial-data-2024',
            PRICE_SATS: 1500
          }
        });

      expect(generateResponse.status).toBe(200);
      expect(generateResponse.body.content).toContain('Data Corp');
      expect(generateResponse.body.content).toContain('Analytics Inc');
      expect(generateResponse.body.content).toContain('financial-data-2024');
      expect(generateResponse.body.content).toContain('1500 satoshis');

      // Test validation failure
      const invalidGenerateResponse = await request(app)
        .post(`/templates/${templateId}/generate`)
        .send({
          variables: {
            PROVIDER_NAME: 'Data Corp',
            // Missing required fields
          }
        });

      expect(invalidGenerateResponse.status).toBe(400);
      expect(invalidGenerateResponse.body.error).toBe('generation-failed');
    });

    test('should bootstrap example template', async () => {
      // Delete existing templates first (for clean test)
      await request(app).get('/templates')
        .then(res => {
          const promises = res.body.items.map((template: any) =>
            request(app).delete(`/templates/${template.templateId}`)
          );
          return Promise.all(promises);
        });

      const bootstrapResponse = await request(app)
        .post('/templates/bootstrap');

      expect(bootstrapResponse.status).toBe(200);
      expect(bootstrapResponse.body.templateId).toBeDefined();
      expect(bootstrapResponse.body.message).toBe('Example template created');

      // Verify template was created
      const listResponse = await request(app).get('/templates');
      expect(listResponse.body.items).toHaveLength(1);
    });
  });

  describe('Job Processing', () => {
    test('should process job queue states', async () => {
      // Check initial empty state
      const initialJobsResponse = await request(app).get('/jobs');
      expect(initialJobsResponse.status).toBe(200);

      // Filter by state
      const queuedJobsResponse = await request(app).get('/jobs?state=queued');
      expect(queuedJobsResponse.status).toBe(200);

      const runningJobsResponse = await request(app).get('/jobs?state=running');
      expect(runningJobsResponse.status).toBe(200);
    });
  });

  describe('Artifacts System', () => {
    test('should manage artifacts', async () => {
      // List artifacts (should be empty initially)
      const initialArtifactsResponse = await request(app).get('/artifacts');
      expect(initialArtifactsResponse.status).toBe(200);

      // Test artifact filtering
      const contractArtifactsResponse = await request(app).get('/artifacts?type=contract/markdown');
      expect(contractArtifactsResponse.status).toBe(200);

      const publishedArtifactsResponse = await request(app).get('/artifacts?published=true');
      expect(publishedArtifactsResponse.status).toBe(200);

      const unpublishedArtifactsResponse = await request(app).get('/artifacts?published=false');
      expect(unpublishedArtifactsResponse.status).toBe(200);
    });
  });

  describe('Policy Enforcement Edge Cases', () => {
    test('should enforce agent registration limits per IP', async () => {
      const results = [];

      // Attempt to register more agents than allowed - do sequentially to test rate limiting properly
      for (let i = 0; i < 7; i++) {
        const response = await request(app)
          .post('/agents/register')
          .set('x-test-rate-limits', 'true')
          .send({
            name: `Rate Limit Test Agent ${i}`,
            webhookUrl: `https://example.com/webhook-${i}`,
            capabilities: ['test']
          });
        results.push(response.status);
      }

      const successCount = results.filter(code => code === 201).length;
      const rateLimitedCount = results.filter(code => code === 429).length;

      // With default limit of 5, expect 5 successes and 2 rate limited
      expect(successCount).toBe(5);
      expect(rateLimitedCount).toBe(2);
    });

    test('should enforce resource limits', async () => {
      // Test oversized template content
      const largeContent = 'x'.repeat(200 * 1024); // 200KB
      const oversizedTemplateResponse = await request(app)
        .post('/templates')
        .set('x-test-resource-limits', 'true')
        .send({
          name: 'Oversized Template',
          content: largeContent,
          type: 'markdown'
        });

      expect(oversizedTemplateResponse.status).toBe(413);
      expect(oversizedTemplateResponse.body.error).toBe('template-too-large');
    });

    test('should validate webhook URLs in production mode', async () => {
      // Test localhost URL (should be rejected with validation header)
      const localhostResponse = await request(app)
        .post('/agents/register')
        .set('x-test-webhook-validation', 'true')
        .send({
          name: 'Localhost Agent',
          webhookUrl: 'http://localhost:3000/webhook',
          capabilities: ['test']
        });

      expect(localhostResponse.status).toBe(400);
      expect(localhostResponse.body.error).toBe('invalid-webhook-url');

      // Test HTTP URL (should be rejected with validation header)
      const httpResponse = await request(app)
        .post('/agents/register')
        .set('x-test-webhook-validation', 'true')
        .send({
          name: 'HTTP Agent',
          webhookUrl: 'http://example.com/webhook',
          capabilities: ['test']
        });

      expect(httpResponse.status).toBe(400);
      expect(httpResponse.body.error).toBe('invalid-webhook-url');

      // Test valid HTTPS URL (should succeed - no validation header needed)
      const httpsResponse = await request(app)
        .post('/agents/register')
        .send({
          name: 'HTTPS Agent',
          webhookUrl: 'https://api.example.com/webhook',
          capabilities: ['test']
        });

      expect(httpsResponse.status).toBe(201);
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 errors gracefully', async () => {
      const responses = await Promise.all([
        request(app).get('/agents/nonexistent-agent'),
        request(app).get('/rules/nonexistent-rule'),
        request(app).get('/templates/nonexistent-template'),
        request(app).get('/artifacts/nonexistent-artifact')
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(404);
        if (response.body && response.body.error) {
          expect(response.body.error).toBe('not-found');
        }
      });
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/agents/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });
});

describe('End-to-End Workflow with DLM1', () => {
  test('should complete full agent marketplace workflow', async () => {
    // 1. Create a test agent
    const agentResponse = await request(app)
      .post('/agents/register')
      .send({
        name: 'E2E Test Agent',
        webhookUrl: 'https://api.test.com/webhook',
        capabilities: ['notify', 'contract.generate']
      });

    expect(agentResponse.status).toBe(201);
    const agentId = agentResponse.body.agentId;

    // 2. Bootstrap template if needed
    await request(app).post('/templates/bootstrap');

    const templatesResponse = await request(app).get('/templates');
    const templateId = templatesResponse.body.items[0].templateId;

    // 3. Create a comprehensive rule
    const ruleResponse = await request(app)
      .post('/rules')
      .send({
        name: 'E2E Test Rule',
        enabled: true,
        when: { type: 'ready', predicate: {} },
        find: { source: 'search', query: { q: 'test' }, limit: 1 },
        actions: [
          { action: 'notify', agentId },
          {
            action: 'contract.generate',
            templateId,
            variables: {
              AGREEMENT_ID: 'E2E-TEST-001',
              PROVIDER_NAME: 'Test Provider',
              CONSUMER_NAME: 'Test Consumer',
              DATASET_ID: 'e2e-test-dataset',
              VERSION_ID: 'v1.0.0',
              PROCESSING_TYPE: 'analysis',
              PRICE_SATS: 2000,
              QUANTITY: 1,
              TOTAL_COST: 2000,
              USAGE_RIGHTS: 'analysis and reporting'
            }
          }
        ]
      });

    expect(ruleResponse.status).toBe(201);
    const ruleId = ruleResponse.body.ruleId;

    // 4. Wait a moment for any background processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 5. Verify rule was created correctly
    const getRuleResponse = await request(app).get(`/rules/${ruleId}`);
    expect(getRuleResponse.status).toBe(200);
    expect(getRuleResponse.body.actions).toBeDefined();

    // 6. Check artifacts were created (in case worker processed something)
    const artifactsResponse = await request(app).get('/artifacts');
    expect(artifactsResponse.status).toBe(200);

    // Note: In a real test environment, you would trigger the rule and verify
    // that it creates jobs, generates contracts, and publishes to DLM1
    // This requires a more complex setup with manifest data
  }, 15000);
});