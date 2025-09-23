// D07 Agent Streaming Routes
import { Router } from 'express';

import { getHybridDatabase } from '../db/hybrid.js';

export function agentStreamingRouter() {
  const router = Router();
  const db = getHybridDatabase();

  // POST /v1/agent/streaming/sessions - Handle agent streaming session lifecycle
  router.post('/sessions', async (req, res) => {
    try {
      const { agentId, receiptId, action } = req.body;

      if (!agentId || !receiptId) {
        return res.status(400).json({ error: 'agentId and receiptId are required' });
      }

      if (action === 'create') {
        // Create new agent streaming session
        const sessionResult = await db.pg.queryOne(
          `
          INSERT INTO agent_streaming_sessions (
            agent_id, receipt_id, session_type, session_status,
            total_content_bytes, estimated_cost_satoshis
          )
          VALUES ($1, $2, 'standard', 'active', 2097152, 2000)
          RETURNING *
        `,
          [agentId, receiptId],
        );

        res.json({
          agentSessionId: sessionResult.id,
          status: sessionResult.session_status,
          estimatedCost: sessionResult.estimated_cost_satoshis,
        });
      } else if (action === 'update') {
        // Update existing session
        const { agentSessionId, bytesProcessed } = req.body;

        await db.pg.query(
          `
          UPDATE agent_streaming_sessions
          SET bytes_processed = $1, updated_at = NOW()
          WHERE id = $2 AND agent_id = $3
        `,
          [bytesProcessed, agentSessionId, agentId],
        );

        res.json({ status: 'updated' });
      } else if (action === 'complete') {
        // Complete session
        const { agentSessionId } = req.body;

        await db.pg.query(
          `
          UPDATE agent_streaming_sessions
          SET session_status = 'completed', updated_at = NOW()
          WHERE id = $1 AND agent_id = $2
        `,
          [agentSessionId, agentId],
        );

        res.json({ status: 'completed' });
      } else {
        res.status(400).json({ error: 'Invalid action. Must be create, update, or complete' });
      }
    } catch (error) {
      console.error('Error handling agent session:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
