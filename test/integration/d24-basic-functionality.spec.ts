import { test, expect, beforeEach, afterEach, describe } from 'vitest';
import request from 'supertest';
import express from 'express';
 //import { initSchema, getTestDatabase } from '../../src/db';
import { agentsRouter } from '../../src/routes/agents';
import { rulesRouter } from '../../src/routes/rules';
import { jobsRouter } from '../../src/routes/jobs';
import { templatesRouter } from '../../src/routes/templates';
import { createArtifactRoutes } from '../../src/agents/dlm1-publisher';
import { startJobsWorker } from '../../src/agents/worker';

// Create a fresh setup for each test to avoid rate limiting conflicts
function createTestApp() {
  // Create fresh database for this test
  const db = new Database(':memory:');

  // Initialize base schema in test database
  const initSQL = `
    CREATE TABLE IF NOT EXISTS agents (
      agent_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capabilities_json TEXT NOT NULL DEFAULT '[]',
      webhook_url TEXT NOT NULL,
      identity_key TEXT,
      status TEXT DEFAULT 'unknown',
      last_ping_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rules (
      rule_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      when_json TEXT NOT NULL,
      find_json TEXT NOT NULL,
      actions_json TEXT NOT NULL,
      owner_producer_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      target_id TEXT,
      state TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_run_at INTEGER NOT NULL,
      last_error TEXT,
      evidence_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contract_templates (
      template_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      template_content TEXT NOT NULL,
      template_type TEXT DEFAULT 'pdf',
      variables_json TEXT,
      owner_producer_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      artifact_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      file_path TEXT,
      content_data BLOB,
      version_id TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      published_at INTEGER
    );
  `;

  db.exec(initSQL);

  const app = express();
  app.use(express.json());

  // Mount routes without policy enforcement for basic functionality tests
  app.use('/agents', agentsRouter(db));
  app.use('/rules', rulesRouter(db));
  app.use('/jobs', jobsRouter(db));
  app.use('/templates', templatesRouter(db));
  app.use('/artifacts', createArtifactRoutes(db));

  return { app, db };
}

describe('D24 Basic Functionality Tests', () => {

  describe('Agent Registration and Management', () => {
    test('should register and retrieve agents', async () => {
      const { app, db } = createTestApp();

      // Clean up any existing agents
      const { getPostgreSQLClient } = await import('../../src/db/postgresql');
      const pgClient = getPostgreSQLClient();
      await pgClient.query('DELETE FROM agents');

      try {
        // Register an agent
        const registerResponse = await request(app)
          .post('/agents/register')
          .send({
            name: 'Test Agent',
            webhookUrl: 'https://api.example.com/webhook',
            capabilities: ['notify', 'process']
          });

        expect(registerResponse.status).toBe(201);
        expect(registerResponse.body.status).toBe('active');
        expect(registerResponse.body.agentId).toBeDefined();

        const agentId = registerResponse.body.agentId;

        // Search for the agent
        const searchResponse = await request(app)
          .get('/agents/search?q=Test');

        expect(searchResponse.status).toBe(200);
        expect(searchResponse.body.items).toHaveLength(1);
        expect(searchResponse.body.items[0].agentId).toBe(agentId);
        expect(searchResponse.body.items[0].name).toBe('Test Agent');

        // Ping the agent
        const pingResponse = await request(app)
          .post(`/agents/${agentId}/ping`);

        expect(pingResponse.status).toBe(200);
        expect(pingResponse.body.status).toBe('pinged');
      } finally {
        db.close();
      }
    });

    test('should validate agent registration fields', async () => {
      const { app, db } = createTestApp();

      try {
        // Missing fields
        const missingFieldsResponse = await request(app)
          .post('/agents/register')
          .send({
            name: 'Incomplete Agent'
            // Missing webhookUrl and capabilities
          });

        expect(missingFieldsResponse.status).toBe(400);
        expect(missingFieldsResponse.body.error).toBe('bad-request');
      } finally {
        db.close();
      }
    });
  });

  describe('Rule Management', () => {
    test('should create and manage rules', async () => {
      const { app, db } = createTestApp();

      try {
        // First create an agent
        const agentResponse = await request(app)
          .post('/agents/register')
          .send({
            name: 'Rule Test Agent',
            webhookUrl: 'https://api.example.com/webhook',
            capabilities: ['notify']
          });

        const agentId = agentResponse.body.agentId;

        // Create a rule
        const createRuleResponse = await request(app)
          .post('/rules')
          .send({
            name: 'Test Rule',
            enabled: true,
            when: { type: 'ready', predicate: {} },
            find: { source: 'search', query: { q: 'test' }, limit: 5 },
            actions: [
              { action: 'notify', agentId, payload: { message: 'Test notification' } }
            ]
          });

        expect(createRuleResponse.status).toBe(201);
        expect(createRuleResponse.body.ruleId).toBeDefined();

        const ruleId = createRuleResponse.body.ruleId;

        // Get the rule
        const getRuleResponse = await request(app).get(`/rules/${ruleId}`);
        expect(getRuleResponse.status).toBe(200);
        expect(getRuleResponse.body.name).toBe('Test Rule');
        expect(getRuleResponse.body.enabled).toBe(true);

        // List rules
        const listRulesResponse = await request(app).get('/rules');
        expect(listRulesResponse.status).toBe(200);
        expect(listRulesResponse.body.items.length).toBeGreaterThan(0);

        // Update rule
        const updateRuleResponse = await request(app)
          .patch(`/rules/${ruleId}`)
          .send({ enabled: false });

        expect(updateRuleResponse.status).toBe(200);

        // Verify update
        const getUpdatedRuleResponse = await request(app).get(`/rules/${ruleId}`);
        expect(getUpdatedRuleResponse.body.enabled).toBe(false);

        // Delete rule
        const deleteRuleResponse = await request(app).delete(`/rules/${ruleId}`);
        expect(deleteRuleResponse.status).toBe(200);

        // Verify deletion
        const getDeletedRuleResponse = await request(app).get(`/rules/${ruleId}`);
        expect(getDeletedRuleResponse.status).toBe(404);
      } finally {
        db.close();
      }
    });
  });

  describe('Template System', () => {
    test('should create templates and generate contracts', async () => {
      const { app, db } = createTestApp();

      try {
        // Create a template
        const createTemplateResponse = await request(app)
          .post('/templates')
          .send({
            name: 'Test Contract',
            content: 'Contract for {{CLIENT}} with amount {{AMOUNT}}',
            type: 'markdown',
            variables: {
              variables: [
                { name: 'CLIENT', type: 'string', required: true },
                { name: 'AMOUNT', type: 'number', required: true }
              ]
            }
          });

        expect(createTemplateResponse.status).toBe(200);
        const templateId = createTemplateResponse.body.templateId;

        // Generate contract
        const generateResponse = await request(app)
          .post(`/templates/${templateId}/generate`)
          .send({
            variables: {
              CLIENT: 'Test Corp',
              AMOUNT: 1000
            }
          });

        expect(generateResponse.status).toBe(200);
        expect(generateResponse.body.content).toContain('Test Corp');
        expect(generateResponse.body.content).toContain('1000');

        // List templates
        const listResponse = await request(app).get('/templates');
        expect(listResponse.status).toBe(200);
        expect(listResponse.body.items.length).toBeGreaterThan(0);
      } finally {
        db.close();
      }
    });

    test('should validate template variables', async () => {
      const { app, db } = createTestApp();

      try {
        // Create template with required variables
        const createTemplateResponse = await request(app)
          .post('/templates')
          .send({
            name: 'Validation Test Template',
            content: 'Name: {{NAME}}, Age: {{AGE}}',
            variables: {
              variables: [
                { name: 'NAME', type: 'string', required: true },
                { name: 'AGE', type: 'number', required: true }
              ]
            }
          });

        const templateId = createTemplateResponse.body.templateId;

        // Try to generate without required variables
        const generateResponse = await request(app)
          .post(`/templates/${templateId}/generate`)
          .send({
            variables: {
              NAME: 'John'
              // Missing AGE
            }
          });

        expect(generateResponse.status).toBe(400);
        expect(generateResponse.body.error).toBe('generation-failed');
      } finally {
        db.close();
      }
    });
  });

  describe('Jobs System', () => {
    test('should handle job queue operations', async () => {
      const { app, db } = createTestApp();

      try {
        // Check initial jobs (should be empty)
        const initialJobsResponse = await request(app).get('/jobs');
        expect(initialJobsResponse.status).toBe(200);
        expect(initialJobsResponse.body.items).toHaveLength(0);

        // Test job filtering
        const queuedJobsResponse = await request(app).get('/jobs?state=queued');
        expect(queuedJobsResponse.status).toBe(200);

        const runningJobsResponse = await request(app).get('/jobs?state=running');
        expect(runningJobsResponse.status).toBe(200);

        const doneJobsResponse = await request(app).get('/jobs?state=done');
        expect(doneJobsResponse.status).toBe(200);
      } finally {
        db.close();
      }
    });
  });

  describe('Artifacts System', () => {
    test('should manage artifacts', async () => {
      const { app, db } = createTestApp();

      try {
        // List artifacts (should be empty initially)
        const initialArtifactsResponse = await request(app).get('/artifacts');
        expect(initialArtifactsResponse.status).toBe(200);
        expect(initialArtifactsResponse.body.items).toHaveLength(0);

        // Test artifact filtering
        const contractArtifactsResponse = await request(app)
          .get('/artifacts?type=contract/markdown');
        expect(contractArtifactsResponse.status).toBe(200);

        const publishedArtifactsResponse = await request(app)
          .get('/artifacts?published=true');
        expect(publishedArtifactsResponse.status).toBe(200);

        const unpublishedArtifactsResponse = await request(app)
          .get('/artifacts?published=false');
        expect(unpublishedArtifactsResponse.status).toBe(200);
      } finally {
        db.close();
      }
    });
  });

  describe('Integration Workflow', () => {
    test('should complete basic agent-rule-template workflow', async () => {
      const { app, db } = createTestApp();
      let workerCleanup: any;

      try {
        // Start worker for this test
        workerCleanup = startJobsWorker(db);

        // 1. Register agent
        const agentResponse = await request(app)
          .post('/agents/register')
          .send({
            name: 'Workflow Test Agent',
            webhookUrl: 'https://webhook.site/test-endpoint',
            capabilities: ['notify', 'contract.generate']
          });

        expect(agentResponse.status).toBe(201);
        const agentId = agentResponse.body.agentId;

        // 2. Create template
        const templateResponse = await request(app)
          .post('/templates')
          .send({
            name: 'Workflow Contract',
            content: 'Agreement with {{PARTY}} for {{AMOUNT}} satoshis',
            variables: {
              variables: [
                { name: 'PARTY', type: 'string', required: true },
                { name: 'AMOUNT', type: 'number', required: true }
              ]
            }
          });

        expect(templateResponse.status).toBe(200);
        const templateId = templateResponse.body.templateId;

        // 3. Create rule
        const ruleResponse = await request(app)
          .post('/rules')
          .send({
            name: 'Workflow Test Rule',
            enabled: true,
            when: { type: 'ready', predicate: {} },
            find: { source: 'search', query: { q: 'workflow' }, limit: 1 },
            actions: [
              { action: 'notify', agentId },
              {
                action: 'contract.generate',
                templateId,
                variables: {
                  PARTY: 'Test Company',
                  AMOUNT: 5000
                }
              }
            ]
          });

        expect(ruleResponse.status).toBe(201);
        expect(ruleResponse.body.ruleId).toBeDefined();

        // 4. Verify everything was created
        const verifyAgentResponse = await request(app).get('/agents/search');
        expect(verifyAgentResponse.body.items.length).toBeGreaterThan(0);

        const verifyRulesResponse = await request(app).get('/rules');
        expect(verifyRulesResponse.body.items.length).toBeGreaterThan(0);

        const verifyTemplatesResponse = await request(app).get('/templates');
        expect(verifyTemplatesResponse.body.items.length).toBeGreaterThan(0);

      } finally {
        if (workerCleanup) workerCleanup();
        db.close();
      }
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should handle 404 errors gracefully', async () => {
      const { app, db } = createTestApp();

      try {
        const responses = await Promise.all([
          request(app).post('/agents/nonexistent-agent/ping'),
          request(app).get('/rules/nonexistent-rule'),
          request(app).get('/templates/nonexistent-template'),
          request(app).get('/artifacts/nonexistent-artifact')
        ]);

        responses.forEach(response => {
          expect(response.status).toBe(404);
          expect(response.body.error).toBe('not-found');
        });
      } finally {
        db.close();
      }
    });

    test('should validate JSON parsing', async () => {
      const { app, db } = createTestApp();

      try {
        const response = await request(app)
          .post('/agents/register')
          .set('Content-Type', 'application/json')
          .send('{ invalid json }');

        expect(response.status).toBe(400);
      } finally {
        db.close();
      }
    });
  });
});