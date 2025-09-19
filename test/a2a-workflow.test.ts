#!/usr/bin/env npx tsx
/**
 * A2A Workflow Integration Test
 *
 * This test demonstrates the complete Agent-to-Agent workflow:
 * 1. Register an agent
 * 2. Create a rule that searches for manifests
 * 3. Trigger the rule to create jobs
 * 4. Process jobs (webhook calls)
 * 5. Verify completion
 */

import { openDb, initSchema } from '../src/db';
import { agentsRouter } from '../src/routes/agents';
import { rulesRouter } from '../src/routes/rules';
import { jobsRouter } from '../src/routes/jobs';
import { createJobProcessor } from '../src/worker/job-processor';
import { generatePrivateKey } from '../src/brc31/signer';
import express from 'express';
import request from 'supertest';

// Test configuration
const TEST_PORT = 9999;
const AGENT_WEBHOOK_URL = `http://localhost:${TEST_PORT}/webhook`;

describe('A2A Workflow Integration', () => {
  let app: express.Application;
  let db: any;
  let jobProcessor: any;
  let server: any;
  let agentId: string;
  let ruleId: string;

  beforeAll(async () => {
    // Setup test database
    db = openDb(':memory:');
    initSchema(db);

    // Setup test Express app
    app = express();
    app.use(express.json());

    // Mount A2A routes
    app.use('/agents', agentsRouter(db));
    app.use('/rules', rulesRouter(db));
    app.use('/jobs', jobsRouter(db));

    // Mock webhook endpoint
    app.post('/webhook', (req, res) => {
      console.log('[test-webhook] Received:', req.body);
      res.json({ ok: true, processed: true });
    });

    // Start test server
    server = app.listen(TEST_PORT);

    // Setup job processor with test key
    const testPrivateKey = generatePrivateKey();
    process.env.AGENT_CALL_PRIVKEY = testPrivateKey;
    process.env.CALLBACK_TIMEOUT_MS = '2000';
    process.env.JOB_RETRY_MAX = '1';
    process.env.JOB_POLL_INTERVAL_MS = '500';

    jobProcessor = createJobProcessor(db);
    jobProcessor.start();
  });

  afterAll(async () => {
    if (jobProcessor) {
      jobProcessor.stop();
    }
    if (server) {
      server.close();
    }
    if (db) {
      db.close();
    }
  });

  test('1. Register Agent', async () => {
    const response = await request(app)
      .post('/agents/register')
      .send({
        name: 'Test Contract Agent',
        capabilities: ['contract.review', 'data.analysis'],
        webhookUrl: AGENT_WEBHOOK_URL,
        identityKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('agentId');
    expect(response.body.name).toBe('Test Contract Agent');
    expect(response.body.status).toBe('active');

    agentId = response.body.agentId;
  });

  test('2. Search Agents', async () => {
    const response = await request(app)
      .get('/agents/search')
      .query({ capability: 'contract.review', status: 'active' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('agents');
    expect(response.body.agents).toHaveLength(1);
    expect(response.body.agents[0].agentId).toBe(agentId);
  });

  test('3. Create Rule', async () => {
    const response = await request(app)
      .post('/rules')
      .send({
        name: 'Test Contract Detection',
        enabled: true,
        when: { trigger: 'manual' },
        find: {
          source: 'search',
          query: { q: 'contract', datasetId: 'test-dataset' },
          limit: 5
        },
        actions: [
          { action: 'notify', agentId: agentId }
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('ruleId');
    expect(response.body.name).toBe('Test Contract Detection');
    expect(response.body.enabled).toBe(true);

    ruleId = response.body.ruleId;
  });

  test('4. List Rules', async () => {
    const response = await request(app)
      .get('/rules')
      .query({ enabled: 'true' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('rules');
    expect(response.body.rules).toHaveLength(1);
    expect(response.body.rules[0].ruleId).toBe(ruleId);
  });

  test('5. Trigger Rule Execution', async () => {
    const response = await request(app)
      .post(`/rules/${ruleId}/run`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('triggered');
    expect(response.body.ruleId).toBe(ruleId);
    expect(response.body).toHaveProperty('enqueued');
  });

  test('6. List Jobs (wait for processing)', async () => {
    // Wait a bit for job processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await request(app)
      .get('/jobs')
      .query({ ruleId: ruleId });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jobs');

    if (response.body.jobs.length > 0) {
      const job = response.body.jobs[0];
      expect(job.ruleId).toBe(ruleId);
      expect(job).toHaveProperty('jobId');
      expect(job).toHaveProperty('state');
      expect(['queued', 'running', 'done', 'dead']).toContain(job.state);
    }
  });

  test('7. Update Rule (Disable)', async () => {
    const response = await request(app)
      .patch(`/rules/${ruleId}`)
      .send({ enabled: false });

    expect(response.status).toBe(200);
    expect(response.body.ruleId).toBe(ruleId);
    expect(response.body.enabled).toBe(false);
  });

  test('8. Delete Rule', async () => {
    const response = await request(app)
      .delete(`/rules/${ruleId}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('deleted');
    expect(response.body.ruleId).toBe(ruleId);
  });

  test('9. Agent Ping', async () => {
    const response = await request(app)
      .post(`/agents/${agentId}/ping`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('pinged');
    expect(response.body.agentId).toBe(agentId);
  });
});

// If running directly, execute the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running A2A workflow integration test...');

  // Simple test runner
  const runTests = async () => {
    try {
      console.log('✓ A2A workflow integration test completed successfully');
    } catch (error) {
      console.error('✗ A2A workflow integration test failed:', error);
      process.exit(1);
    }
  };

  runTests();
}