#!/usr/bin/env npx tsx
/**
 * A2A Demo Script
 *
 * This script demonstrates the complete Agent-to-Agent workflow
 * by making HTTP requests to the GitData overlay API.
 *
 * Prerequisites:
 * 1. Start the overlay server: npm run dev
 * 2. Start the example agent: npx tsx examples/agent-webhook.ts
 * 3. Run this demo: npx tsx examples/a2a-demo.ts
 */

import { generatePrivateKey } from '../src/brc31/signer';

const API_BASE = process.env.API_BASE || 'http://localhost:3030';
const AGENT_WEBHOOK_URL = process.env.AGENT_WEBHOOK_URL || 'http://localhost:9099/webhook';

interface ApiResponse {
  ok: boolean;
  status?: number;
  data?: any;
  error?: string;
}

async function apiCall(method: string, path: string, body?: any): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      data: response.ok ? data : undefined,
      error: response.ok ? undefined : data.error || data.message || 'Unknown error'
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runA2ADemo() {
  console.log('🤖 GitData A2A Demo');
  console.log('====================');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Agent Webhook: ${AGENT_WEBHOOK_URL}\n`);

  let agentId: string;
  let ruleId: string;

  // Step 1: Health Check
  console.log('1. Health Check...');
  const health = await apiCall('GET', '/health');
  if (!health.ok) {
    console.error('❌ Health check failed:', health.error);
    return;
  }
  console.log('✅ Server is healthy\n');

  // Step 2: Register Agent
  console.log('2. Registering Agent...');
  const agentRegistration = await apiCall('POST', '/agents/register', {
    name: 'Demo Contract Agent',
    capabilities: ['contract.review', 'data.analysis', 'notification.handler'],
    webhookUrl: AGENT_WEBHOOK_URL,
    identityKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
  });

  if (!agentRegistration.ok) {
    console.error('❌ Agent registration failed:', agentRegistration.error);
    return;
  }

  agentId = agentRegistration.data.agentId;
  console.log(`✅ Agent registered: ${agentId}\n`);

  // Step 3: Search Agents
  console.log('3. Searching Agents...');
  const agentSearch = await apiCall('GET', '/agents/search?capability=contract.review&status=active');
  if (!agentSearch.ok) {
    console.error('❌ Agent search failed:', agentSearch.error);
    return;
  }
  console.log(`✅ Found ${agentSearch.data.agents.length} agents\n`);

  // Step 4: Create Rule
  console.log('4. Creating Rule...');
  const ruleCreation = await apiCall('POST', '/rules', {
    name: 'Demo Contract Detection Rule',
    enabled: true,
    when: { trigger: 'manual' },
    find: {
      source: 'search',
      query: { q: 'contract', datasetId: 'test-dataset' },
      limit: 3
    },
    actions: [
      { action: 'notify', agentId: agentId },
      { action: 'contract.generate' }
    ]
  });

  if (!ruleCreation.ok) {
    console.error('❌ Rule creation failed:', ruleCreation.error);
    return;
  }

  ruleId = ruleCreation.data.ruleId;
  console.log(`✅ Rule created: ${ruleId}\n`);

  // Step 5: List Rules
  console.log('5. Listing Rules...');
  const rulesList = await apiCall('GET', '/rules?enabled=true');
  if (!rulesList.ok) {
    console.error('❌ Rules list failed:', rulesList.error);
    return;
  }
  console.log(`✅ Found ${rulesList.data.rules.length} enabled rules\n`);

  // Step 6: Trigger Rule
  console.log('6. Triggering Rule Execution...');
  const ruleTrigger = await apiCall('POST', `/rules/${ruleId}/run`);
  if (!ruleTrigger.ok) {
    console.error('❌ Rule trigger failed:', ruleTrigger.error);
    return;
  }
  console.log(`✅ Rule triggered, ${ruleTrigger.data.enqueued} jobs enqueued\n`);

  // Step 7: Monitor Jobs
  console.log('7. Monitoring Jobs...');
  for (let i = 0; i < 10; i++) {
    await delay(1000);

    const jobsList = await apiCall('GET', `/jobs?ruleId=${ruleId}`);
    if (!jobsList.ok) {
      console.error('❌ Jobs list failed:', jobsList.error);
      continue;
    }

    const jobs = jobsList.data.jobs;
    console.log(`   Attempt ${i + 1}: ${jobs.length} jobs found`);

    if (jobs.length > 0) {
      const states = jobs.reduce((acc: any, job: any) => {
        acc[job.state] = (acc[job.state] || 0) + 1;
        return acc;
      }, {});

      console.log(`   Job states: ${JSON.stringify(states)}`);

      // Check if all jobs are completed
      const allCompleted = jobs.every((job: any) => job.state === 'done' || job.state === 'dead');
      if (allCompleted) {
        console.log('✅ All jobs completed\n');
        break;
      }
    }

    if (i === 9) {
      console.log('⏱️  Jobs still processing after 10 seconds\n');
    }
  }

  // Step 8: Get Job Details
  console.log('8. Getting Job Details...');
  const finalJobsList = await apiCall('GET', `/jobs?ruleId=${ruleId}`);
  if (finalJobsList.ok && finalJobsList.data.jobs.length > 0) {
    const job = finalJobsList.data.jobs[0];
    const jobDetails = await apiCall('GET', `/jobs/${job.jobId}`);

    if (jobDetails.ok) {
      console.log(`✅ Job ${job.jobId} details:`);
      console.log(`   State: ${jobDetails.data.state}`);
      console.log(`   Evidence: ${JSON.stringify(jobDetails.data.evidence, null, 2)}\n`);
    }
  }

  // Step 9: Agent Ping
  console.log('9. Pinging Agent...');
  const agentPing = await apiCall('POST', `/agents/${agentId}/ping`);
  if (!agentPing.ok) {
    console.error('❌ Agent ping failed:', agentPing.error);
    return;
  }
  console.log('✅ Agent ping successful\n');

  // Step 10: Cleanup
  console.log('10. Cleanup...');

  // Disable rule
  const ruleUpdate = await apiCall('PATCH', `/rules/${ruleId}`, { enabled: false });
  if (ruleUpdate.ok) {
    console.log('✅ Rule disabled');
  }

  // Delete rule
  const ruleDelete = await apiCall('DELETE', `/rules/${ruleId}`);
  if (ruleDelete.ok) {
    console.log('✅ Rule deleted');
  }

  console.log('\n🎉 A2A Demo completed successfully!');
  console.log('\nNext steps:');
  console.log('- Check the agent webhook logs for received notifications');
  console.log('- Import postman/a2a_demo_collection.json for manual testing');
  console.log('- Review docs/D16-A2A-Demo.md for more details');
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runA2ADemo().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}