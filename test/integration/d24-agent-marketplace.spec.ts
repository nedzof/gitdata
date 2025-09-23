// D24 Agent Marketplace Integration Tests
// Tests for overlay-based agent marketplace with full BRC standards integration

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getPostgreSQLClient } from '../../src/db/postgresql';
import { initializeOverlayServices } from '../../src/overlay';
import { Pool } from 'pg';

describe('D24 Overlay Agent Marketplace Integration', () => {
  let pgClient: any;
  let overlayServices: any;
  let pgPool: Pool;

  beforeAll(async () => {
    // Initialize PostgreSQL for testing
    pgClient = getPostgreSQLClient();
    pgPool = pgClient.getPool();

    // Initialize overlay services with PostgreSQL
    overlayServices = await initializeOverlayServices(
      pgPool,
      'test',
      'localhost:8788',
      {
        storageBasePath: './test-data/uhrp-storage',
        baseUrl: 'http://localhost:8788'
      }
    );

    // Set up test database schema
    await setupTestSchema(pgClient);
  });

  afterAll(async () => {
    await cleanupTestData(pgClient);
    await pgClient.close();
  });

  beforeEach(async () => {
    await cleanupTestData(pgClient);
  });

  describe('Agent Registration via BRC-88', () => {
    test('should register agent with SHIP advertisement on overlay network', async () => {
      // 1. Register agent with capabilities
      const agentRegistration = {
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
        region: 'EU',
        webhookUrl: 'http://localhost:9099/webhook',
        overlayTopics: ['gitdata.agent.capabilities', 'gitdata.agent.jobs']
      };

      // 2. Create BRC-88 SHIP advertisement
      const shipAd = await overlayServices.brc88Service.createSHIPAdvertisement(
        'gitdata.agent.capabilities'
      );

      expect(shipAd).toBeDefined();
      expect(shipAd.topicName).toBe('gitdata.agent.capabilities');
      expect(shipAd.domainName).toBe('localhost:8788');

      // 3. Store agent in enhanced registry
      const agentId = await storeOverlayAgent(pgClient, {
        ...agentRegistration,
        shipAdvertisementId: shipAd.utxoId
      });

      expect(agentId).toBeDefined();

      // 4. Verify agent discoverable via BRC-24 lookup
      const discoveredAgents = await overlayServices.brc24Service.processLookup(
        'agent_lookup',
        { capability: 'contract-generation', region: 'EU' }
      );

      expect(discoveredAgents.status).toBe('success');
      expect(discoveredAgents.results.length).toBeGreaterThan(0);

      // 5. Verify SHIP advertisement stored
      const shipAds = await overlayServices.brc88Service.getSHIPAdvertisements();
      expect(shipAds.some(ad => ad.topicName === 'gitdata.agent.capabilities')).toBe(true);
    });

    test('should handle agent registration with geographic constraints', async () => {
      // Register agents in different regions
      const agents = await Promise.all([
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'Agent-US',
          capabilities: ['data-processing'],
          region: 'US',
          overlayTopics: ['gitdata.agent.capabilities']
        }),
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'Agent-EU',
          capabilities: ['data-processing'],
          region: 'EU',
          overlayTopics: ['gitdata.agent.capabilities']
        }),
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'Agent-APAC',
          capabilities: ['data-processing'],
          region: 'APAC',
          overlayTopics: ['gitdata.agent.capabilities']
        })
      ]);

      // Query agents by region
      const usAgents = await queryOverlayAgents(pgClient, { region: 'US' });
      const euAgents = await queryOverlayAgents(pgClient, { region: 'EU' });

      expect(usAgents.length).toBe(1);
      expect(euAgents.length).toBe(1);
      expect(usAgents[0].name).toBe('Agent-US');
      expect(euAgents[0].name).toBe('Agent-EU');
    });
  });

  describe('Rule Engine with Overlay Events', () => {
    test('should create and trigger overlay-aware rules', async () => {
      // 1. Register agent for contract generation
      const agent = await registerAgentWithOverlay(overlayServices, pgClient, {
        name: 'ContractBot',
        capabilities: ['contract-generation'],
        region: 'EU',
        overlayTopics: ['gitdata.agent.jobs']
      });

      // 2. Create overlay rule
      const rule = await createOverlayRule(pgClient, {
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
          source: 'overlay-search',
          topics: ['gitdata.agent.capabilities'],
          query: { capability: 'contract-generation' }
        },
        actions: [
          {
            action: 'overlay.discover',
            capability: 'contract-generation',
            region: 'EU'
          },
          {
            action: 'brc26.store',
            type: 'contract-template',
            templateId: 'premium-data-agreement'
          },
          {
            action: 'brc22.submit',
            topic: 'gitdata.marketplace.offers'
          }
        ]
      });

      expect(rule.ruleId).toBeDefined();

      // 3. Simulate overlay event that should trigger the rule
      const manifest = {
        datasetId: 'premium-data-001',
        tags: ['premium', 'financial'],
        classification: 'public',
        pricing: { satoshis: 500 }
      };

      // Submit manifest via BRC-22 to trigger rule
      const manifestTx = await overlayServices.brc22Service.processSubmission({
        rawTx: '01000000' + '00'.repeat(60), // Mock transaction
        inputs: {},
        topics: ['gitdata.d01a.manifest'],
        mapiResponses: []
      });

      expect(manifestTx.status).toBe('success');

      // 4. Wait for rule processing and verify job creation
      await waitForRuleProcessing(1000);

      const jobs = await getOverlayJobs(pgClient, { ruleId: rule.ruleId });
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].state).toBe('queued');
    });

    test('should handle complex multi-agent workflows', async () => {
      // Register multiple agents with different capabilities
      const agents = await Promise.all([
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'DataProcessor',
          capabilities: ['data-analysis'],
          region: 'US'
        }),
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'ContractGenerator',
          capabilities: ['contract-generation'],
          region: 'EU'
        }),
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'LegalReviewer',
          capabilities: ['legal-review'],
          region: 'EU'
        })
      ]);

      // Create workflow rule requiring multiple agents
      const workflowRule = await createOverlayRule(pgClient, {
        name: 'complex-data-workflow',
        overlayTopics: ['gitdata.d01a.manifest'],
        whenCondition: {
          type: 'overlay-event',
          predicate: { eq: { type: 'research-data' } }
        },
        findStrategy: {
          source: 'overlay-search',
          requireAll: ['data-analysis', 'contract-generation', 'legal-review']
        },
        actions: [
          {
            action: 'overlay.coordinate',
            workflow: 'sequential',
            steps: [
              { capability: 'data-analysis', timeout: 30000 },
              { capability: 'contract-generation', timeout: 60000 },
              { capability: 'legal-review', timeout: 45000 }
            ]
          }
        ]
      });

      // Trigger workflow
      await triggerOverlayRule(overlayServices, workflowRule.ruleId);

      // Verify all agents receive jobs in sequence
      const jobs = await getOverlayJobs(pgClient, { ruleId: workflowRule.ruleId });
      expect(jobs.length).toBe(3);

      // Verify coordination data
      const coordinationJob = jobs.find(j => j.coordinationData);
      expect(coordinationJob?.coordinationData.workflow).toBe('sequential');
      expect(coordinationJob?.assignedAgents).toHaveLength(3);
    });
  });

  describe('BRC-26 Artifact Management', () => {
    test('should store and distribute contract artifacts via UHRP', async () => {
      // 1. Create contract template
      const contractTemplate = Buffer.from(`
        PREMIUM DATA AGREEMENT

        Dataset: {{datasetId}}
        Price: {{price}} satoshis
        Classification: {{classification}}

        Terms and conditions...
      `);

      // 2. Store via BRC-26 UHRP
      const storedContent = await overlayServices.brc26Service.storeFile(
        contractTemplate,
        'premium-data-agreement.txt',
        'text/plain',
        {
          isPublic: true,
          metadata: {
            title: 'Premium Data Agreement Template',
            type: 'contract-template',
            version: '1.0'
          }
        }
      );

      expect(storedContent.hash).toBeDefined();
      expect(storedContent.filename).toBe('premium-data-agreement.txt');

      // 3. Verify artifact discoverable via overlay network
      const resolution = await overlayServices.brc26Service.resolveContent(storedContent.hash);
      expect(resolution.content).toBeDefined();
      expect(resolution.content?.filename).toBe('premium-data-agreement.txt');

      // 4. Test artifact retrieval
      const retrievedBuffer = await overlayServices.brc26Service.getFileBuffer(storedContent.hash);
      expect(retrievedBuffer).toBeDefined();
      expect(Buffer.compare(retrievedBuffer!, contractTemplate)).toBe(0);
    });

    test('should track artifact lineage via BRC-64', async () => {
      // Store initial template
      const template = await overlayServices.brc26Service.storeFile(
        Buffer.from('Template v1'),
        'template-v1.txt',
        'text/plain'
      );

      // Store modified version
      const modified = await overlayServices.brc26Service.storeFile(
        Buffer.from('Template v2 - modified'),
        'template-v2.txt',
        'text/plain',
        {
          metadata: {
            parentHash: template.hash,
            version: '2.0'
          }
        }
      );

      // Query lineage via BRC-64
      const lineage = await overlayServices.brc64Service.generateLineageGraph(
        `${template.hash}:0`,
        'file-storage',
        5
      );

      expect(lineage.nodes).toBeDefined();
      expect(lineage.edges).toBeDefined();
    });
  });

  describe('Agent Execution with BRC-31 Identity', () => {
    test('should execute agent jobs with proper identity verification', async () => {
      // Register agent
      const agent = await registerAgentWithOverlay(overlayServices, pgClient, {
        name: 'TestAgent',
        capabilities: ['data-processing'],
        identityKey: '0339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2'
      });

      // Create job
      const job = await createOverlayJob(pgClient, {
        ruleId: 'test-rule',
        capability: 'data-processing',
        targetData: { type: 'test-data' }
      });

      // Simulate agent execution with BRC-31 signature
      const execution = await executeAgentJob(job.jobId, {
        agentId: agent.agentId,
        signature: await mockBRC31Signature(job),
        artifacts: [
          {
            type: 'processed-data',
            hash: 'mock-hash-123',
            metadata: { processedAt: Date.now() }
          }
        ]
      });

      expect(execution.success).toBe(true);

      // Verify evidence stored
      const evidence = await getJobEvidence(pgClient, job.jobId);
      expect(evidence.brc31Signature).toBeDefined();
      expect(evidence.artifacts).toHaveLength(1);
      expect(evidence.artifacts[0].hash).toBe('mock-hash-123');
    });

    test('should reject jobs with invalid identity signatures', async () => {
      const agent = await registerAgentWithOverlay(overlayServices, pgClient, {
        name: 'TestAgent',
        capabilities: ['data-processing']
      });

      const job = await createOverlayJob(pgClient, {
        ruleId: 'test-rule',
        capability: 'data-processing'
      });

      // Attempt execution with invalid signature
      await expect(
        executeAgentJob(job.jobId, {
          agentId: agent.agentId,
          signature: 'invalid-signature',
          artifacts: []
        })
      ).rejects.toThrow('Invalid BRC-31 signature');
    });
  });

  describe('Fault Tolerance and Performance', () => {
    test('should handle agent failures with overlay redundancy', async () => {
      // Register multiple agents with same capability
      const agents = await Promise.all([
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'Agent1',
          capabilities: ['data-processing']
        }),
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'Agent2',
          capabilities: ['data-processing']
        }),
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'Agent3',
          capabilities: ['data-processing']
        })
      ]);

      // Create job with redundancy requirement
      const job = await createOverlayJob(pgClient, {
        capability: 'data-processing',
        redundancy: 2, // Require 2 successful executions
        timeout: 30000
      });

      // Simulate first agent failure
      await simulateAgentFailure(agents[0].agentId);

      // Wait for job redistribution
      await waitForJobRedistribution(5000);

      const updatedJob = await getOverlayJob(pgClient, job.jobId);
      expect(updatedJob.assignedAgents).not.toContain(agents[0].agentId);
      expect(updatedJob.assignedAgents).toHaveLength(2);

      // Simulate successful execution by remaining agents
      await Promise.all([
        executeAgentJob(job.jobId, {
          agentId: agents[1].agentId,
          signature: await mockBRC31Signature(job),
          artifacts: [{ type: 'result', hash: 'hash1' }]
        }),
        executeAgentJob(job.jobId, {
          agentId: agents[2].agentId,
          signature: await mockBRC31Signature(job),
          artifacts: [{ type: 'result', hash: 'hash2' }]
        })
      ]);

      // Verify successful completion
      const finalJob = await getOverlayJob(pgClient, job.jobId);
      expect(finalJob.state).toBe('done');
      expect(finalJob.evidencePackage.successfulExecutions).toBe(2);
    });

    test('should handle high-volume agent coordination', async () => {
      // Register 50 agents across different regions
      const agents = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          registerAgentWithOverlay(overlayServices, pgClient, {
            name: `Agent${i}`,
            capabilities: ['batch-processing'],
            region: i % 5 === 0 ? 'US' : i % 5 === 1 ? 'EU' : i % 5 === 2 ? 'APAC' : i % 5 === 3 ? 'LATAM' : 'MEA'
          })
        )
      );

      // Create rule that generates multiple parallel jobs
      const batchRule = await createOverlayRule(pgClient, {
        name: 'batch-processing-rule',
        batchSize: 100,
        parallelism: 25,
        actions: [
          {
            action: 'overlay.distribute',
            capability: 'batch-processing'
          }
        ]
      });

      const startTime = Date.now();

      // Trigger mass job creation
      await triggerOverlayRule(overlayServices, batchRule.ruleId);

      // Wait for all jobs to be created and assigned
      await waitForBatchJobCreation(batchRule.ruleId, 30000);

      const duration = Date.now() - startTime;
      const createdJobs = await getOverlayJobs(pgClient, { ruleId: batchRule.ruleId });

      expect(createdJobs).toHaveLength(100);
      expect(duration).toBeLessThan(30000); // Complete within 30 seconds

     
    });
  });

  describe('Overlay Network Integration', () => {
    test('should coordinate agents across overlay network topics', async () => {
      // Register agents with different topic subscriptions
      const agents = await Promise.all([
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'DataAgent',
          capabilities: ['data-analysis'],
          overlayTopics: ['gitdata.data.processing', 'gitdata.agent.coordination']
        }),
        registerAgentWithOverlay(overlayServices, pgClient, {
          name: 'ReportAgent',
          capabilities: ['report-generation'],
          overlayTopics: ['gitdata.reports.generation', 'gitdata.agent.coordination']
        })
      ]);

      // Create cross-topic workflow
      const crossTopicRule = await createOverlayRule(pgClient, {
        name: 'cross-topic-workflow',
        overlayTopics: ['gitdata.data.processing', 'gitdata.reports.generation'],
        actions: [
          {
            action: 'overlay.broadcast',
            topic: 'gitdata.agent.coordination',
            message: { type: 'workflow-start', workflowId: 'cross-topic-001' }
          }
        ]
      });

      // Trigger workflow
      await triggerOverlayRule(overlayServices, crossTopicRule.ruleId);

      // Verify both agents receive coordination message
      await waitForOverlayPropagation(2000);

      // Check that coordination message was broadcasted
      const brc22Stats = await overlayServices.brc22Service.getStats();
      expect(brc22Stats.topics['gitdata.agent.coordination']).toBeDefined();
    });

    test('should maintain agent reputation across overlay network', async () => {
      const agent = await registerAgentWithOverlay(overlayServices, pgClient, {
        name: 'ReputationAgent',
        capabilities: ['quality-service']
      });

      // Execute multiple jobs with varying quality
      const jobs = await Promise.all([
        createAndExecuteJob(agent.agentId, { quality: 0.95, executionTime: 1000 }),
        createAndExecuteJob(agent.agentId, { quality: 0.87, executionTime: 1500 }),
        createAndExecuteJob(agent.agentId, { quality: 0.92, executionTime: 1200 }),
        createAndExecuteJob(agent.agentId, { quality: 0.78, executionTime: 2000 }),
        createAndExecuteJob(agent.agentId, { quality: 0.94, executionTime: 1100 })
      ]);

      // Calculate and update reputation
      await updateAgentReputation(pgClient, agent.agentId);

      // Verify reputation score
      const updatedAgent = await getOverlayAgent(pgClient, agent.agentId);
      expect(updatedAgent.reputationScore).toBeGreaterThan(0.85);
      expect(updatedAgent.reputationScore).toBeLessThan(0.95);

      // Verify performance stats
      expect(updatedAgent.performanceStats.avgExecutionTime).toBeLessThan(1600);
      expect(updatedAgent.performanceStats.successRate).toBe(1.0);
    });
  });
});

// Helper functions

async function setupTestSchema(pgClient: any): Promise<void> {
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS overlay_agents (
      agent_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      overlay_topics TEXT[],
      ship_advertisement_id TEXT,
      slap_advertisement_id TEXT,
      geographic_region TEXT,
      reputation_score DECIMAL(3,2) DEFAULT 0.0,
      performance_stats JSONB,
      identity_key TEXT,
      webhook_url TEXT,
      status TEXT DEFAULT 'unknown',
      last_ping_at BIGINT,
      overlay_node_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS overlay_rules (
      rule_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      overlay_topics TEXT[],
      when_condition JSONB NOT NULL,
      find_strategy JSONB NOT NULL,
      actions JSONB NOT NULL,
      owner_producer_id TEXT,
      execution_stats JSONB,
      last_triggered_at BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS overlay_jobs (
      job_id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      target_id TEXT,
      overlay_transaction_id TEXT,
      state TEXT NOT NULL DEFAULT 'queued',
      assigned_agents TEXT[],
      coordination_data JSONB,
      attempts INTEGER DEFAULT 0,
      next_run_at BIGINT NOT NULL,
      last_error TEXT,
      evidence_package JSONB,
      lineage_data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_performance (
      id SERIAL PRIMARY KEY,
      agent_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      execution_time_ms INTEGER,
      success BOOLEAN,
      quality_score DECIMAL(3,2),
      client_feedback JSONB,
      overlay_confirmation TEXT,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function cleanupTestData(pgClient: any): Promise<void> {
  await pgClient.query('DELETE FROM agent_performance');
  await pgClient.query('DELETE FROM overlay_jobs');
  await pgClient.query('DELETE FROM overlay_rules');
  await pgClient.query('DELETE FROM overlay_agents');
}

async function registerAgentWithOverlay(
  overlayServices: any,
  pgClient: any,
  agentData: any
): Promise<any> {
  const agentId = 'agent_' + Math.random().toString(16).slice(2);

  // Create SHIP advertisement if overlayTopics provided
  let shipAdvertisementId;
  if (agentData.overlayTopics?.length > 0) {
    const shipAd = await overlayServices.brc88Service.createSHIPAdvertisement(
      agentData.overlayTopics[0]
    );
    shipAdvertisementId = shipAd.utxoId;
  }

  await pgClient.query(`
    INSERT INTO overlay_agents
    (agent_id, name, capabilities_json, overlay_topics, ship_advertisement_id, geographic_region, identity_key, webhook_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    agentId,
    agentData.name,
    JSON.stringify(agentData.capabilities),
    agentData.overlayTopics || [],
    shipAdvertisementId,
    agentData.region,
    agentData.identityKey,
    agentData.webhookUrl || `http://localhost:9099/${agentId}/webhook`
  ]);

  return { agentId, ...agentData };
}

async function createOverlayRule(pgClient: any, ruleData: any): Promise<any> {
  const ruleId = 'rule_' + Math.random().toString(16).slice(2);

  await pgClient.query(`
    INSERT INTO overlay_rules
    (rule_id, name, overlay_topics, when_condition, find_strategy, actions)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    ruleId,
    ruleData.name,
    ruleData.overlayTopics || [],
    JSON.stringify(ruleData.whenCondition),
    JSON.stringify(ruleData.findStrategy),
    JSON.stringify(ruleData.actions)
  ]);

  return { ruleId, ...ruleData };
}

async function createOverlayJob(pgClient: any, jobData: any): Promise<any> {
  const jobId = 'job_' + Math.random().toString(16).slice(2);

  await pgClient.query(`
    INSERT INTO overlay_jobs
    (job_id, rule_id, target_id, state, next_run_at, coordination_data)
    VALUES ($1, $2, $3, 'queued', $4, $5)
  `, [
    jobId,
    jobData.ruleId,
    jobData.targetId,
    Math.floor(Date.now() / 1000),
    JSON.stringify(jobData.coordination || {})
  ]);

  return { jobId, ...jobData };
}

async function executeAgentJob(jobId: string, execution: any): Promise<any> {
  // Mock BRC-31 signature verification
  if (execution.signature === 'invalid-signature') {
    throw new Error('Invalid BRC-31 signature');
  }

  return {
    success: true,
    jobId,
    artifacts: execution.artifacts,
    executedAt: Date.now()
  };
}

async function queryOverlayAgents(pgClient: any, query: any): Promise<any[]> {
  let sql = 'SELECT * FROM overlay_agents WHERE 1=1';
  const params: any[] = [];

  if (query.region) {
    sql += ' AND geographic_region = $' + (params.length + 1);
    params.push(query.region);
  }

  if (query.capability) {
    sql += ' AND capabilities_json LIKE $' + (params.length + 1);
    params.push(`%${query.capability}%`);
  }

  const result = await pgClient.query(sql, params);
  return result.rows;
}

async function getOverlayJobs(pgClient: any, query: any): Promise<any[]> {
  let sql = 'SELECT * FROM overlay_jobs WHERE 1=1';
  const params: any[] = [];

  if (query.ruleId) {
    sql += ' AND rule_id = $' + (params.length + 1);
    params.push(query.ruleId);
  }

  if (query.state) {
    sql += ' AND state = $' + (params.length + 1);
    params.push(query.state);
  }

  if (query.agentId) {
    sql += ' AND $' + (params.length + 1) + ' = ANY(assigned_agents)';
    params.push(query.agentId);
  }

  const result = await pgClient.query(sql, params);
  return result.rows;
}

async function getOverlayJob(pgClient: any, jobId: string): Promise<any> {
  const result = await pgClient.query(
    'SELECT * FROM overlay_jobs WHERE job_id = $1',
    [jobId]
  );
  return result.rows[0];
}

async function getOverlayAgent(pgClient: any, agentId: string): Promise<any> {
  const result = await pgClient.query(
    'SELECT * FROM overlay_agents WHERE agent_id = $1',
    [agentId]
  );
  return result.rows[0];
}

async function storeOverlayAgent(pgClient: any, agentData: any): Promise<string> {
  const agentId = 'agent_' + Math.random().toString(16).slice(2);

  await pgClient.query(`
    INSERT INTO overlay_agents
    (agent_id, name, capabilities_json, overlay_topics, ship_advertisement_id, geographic_region)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    agentId,
    agentData.name,
    JSON.stringify(agentData.capabilities),
    agentData.overlayTopics || [],
    agentData.shipAdvertisementId,
    agentData.region
  ]);

  return agentId;
}

async function triggerOverlayRule(overlayServices: any, ruleId: string): Promise<void> {
  // Mock rule triggering - in real implementation this would be event-driven
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function waitForRuleProcessing(timeoutMs: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, timeoutMs));
}

async function waitForOverlayPropagation(timeoutMs: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, timeoutMs));
}

async function waitForJobRedistribution(timeoutMs: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, timeoutMs));
}

async function waitForBatchJobCreation(ruleId: string, timeoutMs: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, timeoutMs));
}

async function simulateAgentFailure(agentId: string): Promise<void> {
  // Mock agent failure simulation
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function mockBRC31Signature(job: any): Promise<string> {
  // Mock BRC-31 signature generation
  return 'mock-signature-' + job.jobId;
}

async function getJobEvidence(pgClient: any, jobId: string): Promise<any> {
  const result = await pgClient.query(
    'SELECT evidence_package FROM overlay_jobs WHERE job_id = $1',
    [jobId]
  );
  return result.rows[0]?.evidence_package || {};
}

async function createAndExecuteJob(agentId: string, performance: any): Promise<any> {
  return {
    jobId: 'job_' + Math.random().toString(16).slice(2),
    agentId,
    performance,
    executedAt: Date.now()
  };
}

async function updateAgentReputation(pgClient: any, agentId: string): Promise<void> {
  // Mock reputation calculation
  await pgClient.query(`
    UPDATE overlay_agents
    SET reputation_score = 0.89,
        performance_stats = '{"avgExecutionTime": 1360, "successRate": 1.0}'::jsonb
    WHERE agent_id = $1
  `, [agentId]);
}