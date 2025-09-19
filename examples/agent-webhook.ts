#!/usr/bin/env npx tsx
/**
 * Example A2A Agent Webhook Handler
 *
 * This is a simple webhook endpoint that receives BRC-31 signed notifications
 * from the gitdata overlay system and responds appropriately.
 *
 * Usage: npx tsx examples/agent-webhook.ts
 */

import express from 'express';
import { verifyBRC31Signature } from '../src/brc31/signer';

const app = express();
const PORT = 9099;

// Parse JSON bodies
app.use(express.json());

// Parse raw body for signature verification
app.use('/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.body = req.body.toString();
  next();
});

/**
 * Main webhook endpoint for receiving A2A notifications
 */
app.post('/webhook', (req, res) => {
  console.log('\n[agent] Received webhook notification');
  console.log('Headers:', {
    'X-Identity-Key': req.headers['x-identity-key'],
    'X-Nonce': req.headers['x-nonce'],
    'X-Signature': req.headers['x-signature']
  });

  try {
    // Parse request body
    const payload = JSON.parse(req.body);
    console.log('Payload:', payload);

    // Verify BRC-31 signature
    const isValid = verifyBRC31Signature({
      'X-Identity-Key': req.headers['x-identity-key'] as string,
      'X-Nonce': req.headers['x-nonce'] as string,
      'X-Signature': req.headers['x-signature'] as string
    }, req.body);

    if (!isValid) {
      console.log('[agent] Invalid BRC-31 signature');
      return res.status(401).json({
        error: 'invalid-signature',
        message: 'BRC-31 signature verification failed'
      });
    }

    console.log('[agent] BRC-31 signature verified successfully');

    // Process the notification based on action type
    switch (payload.action) {
      case 'notify':
        return handleNotification(payload, req, res);

      default:
        console.log(`[agent] Unknown action: ${payload.action}`);
        return res.status(400).json({
          error: 'unknown-action',
          message: `Action '${payload.action}' is not supported`
        });
    }

  } catch (error) {
    console.error('[agent] Webhook processing error:', error);
    return res.status(400).json({
      error: 'processing-failed',
      message: 'Failed to process webhook payload'
    });
  }
});

/**
 * Handle notify action from A2A system
 */
function handleNotification(payload: any, req: express.Request, res: express.Response) {
  console.log(`[agent] Processing notification for agent ${payload.agentId}`);
  console.log(`[agent] Trigger: ${payload.trigger}`);

  if (payload.manifest) {
    console.log(`[agent] Manifest: ${JSON.stringify(payload.manifest, null, 2)}`);
  }

  // Simulate some processing work
  console.log('[agent] Performing work based on notification...');

  // For demo purposes, we always respond with success
  const response = {
    ok: true,
    agentId: payload.agentId,
    processed: true,
    timestamp: Math.floor(Date.now() / 1000),
    message: 'Notification processed successfully'
  };

  console.log('[agent] Sending response:', response);
  res.json(response);
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'example-agent-webhook',
    timestamp: Math.floor(Date.now() / 1000)
  });
});

/**
 * Agent info endpoint
 */
app.get('/info', (req, res) => {
  res.json({
    name: 'Example A2A Agent',
    capabilities: ['contract.review', 'data.analysis', 'notification.handler'],
    webhookUrl: `http://localhost:${PORT}/webhook`,
    version: '1.0.0'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n🤖 Example A2A Agent Webhook Handler`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`ℹ️  Agent info: http://localhost:${PORT}/info`);
  console.log('\nReady to receive BRC-31 signed notifications from gitdata overlay...\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[agent] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[agent] Shutting down gracefully...');
  process.exit(0);
});