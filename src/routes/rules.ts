// D24 rules router with database persistence
import { Router } from 'express';
import { getPostgreSQLClient } from '../db/postgresql';
import crypto from 'crypto';

export function rulesRouter() {
  const router = Router();
  const pgClient = getPostgreSQLClient();

  // GET /rules - List all rules
  router.get('/', async (req, res) => {
    try {
      const result = await pgClient.query('SELECT * FROM overlay_rules ORDER BY created_at DESC');

      // Map database fields to API format
      const mappedItems = result.rows.map(row => ({
        ruleId: row.rule_id,
        name: row.name,
        description: row.description,
        enabled: row.enabled,
        triggers: row.trigger_config || [],
        actions: row.action_config || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      res.json({ items: mappedItems, total: mappedItems.length });
    } catch (error) {
      console.error('Error listing rules:', error);
      res.status(500).json({ error: 'internal-error' });
    }
  });

  // POST /rules - Create new rule
  router.post('/', async (req, res) => {
    try {
      const { name, description, triggers = [], actions = [], enabled = true } = req.body;

      if (!name || !actions || actions.length === 0) {
        return res.status(400).json({ error: 'bad-request' });
      }

      const ruleId = crypto.randomUUID();

      await pgClient.query(`
        INSERT INTO overlay_rules (
          rule_id, name, description, trigger_config, action_config,
          when_condition, find_strategy, actions, enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        ruleId,
        name,
        description,
        JSON.stringify(triggers),
        JSON.stringify(actions),
        JSON.stringify({ triggers }), // when_condition
        JSON.stringify({ type: 'basic' }), // find_strategy
        JSON.stringify(actions), // actions column
        enabled
      ]);

      res.status(201).json({ success: true, ruleId });
    } catch (error) {
      console.error('Error creating rule:', error);
      res.status(500).json({ error: 'internal-error' });
    }
  });

  // GET /rules/:ruleId - Get specific rule
  router.get('/:ruleId', async (req, res) => {
    try {
      const { ruleId } = req.params;
      const result = await pgClient.query('SELECT * FROM overlay_rules WHERE rule_id = $1', [ruleId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'not-found' });
      }

      const rule = result.rows[0];
      // Map database fields to API format
      const mappedRule = {
        ruleId: rule.rule_id,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        triggers: rule.trigger_config || [],
        actions: rule.action_config || [],
        createdAt: rule.created_at,
        updatedAt: rule.updated_at
      };

      res.json(mappedRule);
    } catch (error) {
      console.error('Error getting rule:', error);
      res.status(500).json({ error: 'internal-error' });
    }
  });

  // PATCH /rules/:ruleId - Update specific rule
  router.patch('/:ruleId', async (req, res) => {
    try {
      const { ruleId } = req.params;
      const { name, description, triggers, actions, enabled } = req.body;

      // Check if rule exists
      const existingRule = await pgClient.query('SELECT * FROM overlay_rules WHERE rule_id = $1', [ruleId]);
      if (existingRule.rows.length === 0) {
        return res.status(404).json({ error: 'not-found' });
      }

      // Build update query dynamically based on provided fields
      const updateFields = [];
      const updateValues = [];
      let valueIndex = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${valueIndex}`);
        updateValues.push(name);
        valueIndex++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${valueIndex}`);
        updateValues.push(description);
        valueIndex++;
      }

      if (triggers !== undefined) {
        updateFields.push(`trigger_config = $${valueIndex}`);
        updateValues.push(JSON.stringify(triggers));
        valueIndex++;
      }

      if (actions !== undefined) {
        updateFields.push(`action_config = $${valueIndex}`);
        updateValues.push(JSON.stringify(actions));
        valueIndex++;
        updateFields.push(`actions = $${valueIndex}`);
        updateValues.push(JSON.stringify(actions));
        valueIndex++;
      }

      if (enabled !== undefined) {
        updateFields.push(`enabled = $${valueIndex}`);
        updateValues.push(enabled);
        valueIndex++;
      }

      updateFields.push(`updated_at = NOW()`);

      if (updateFields.length === 1) { // only updated_at
        return res.status(400).json({ error: 'no-updates-provided' });
      }

      // Add the ruleId for WHERE clause
      updateValues.push(ruleId);

      const updateQuery = `
        UPDATE overlay_rules
        SET ${updateFields.join(', ')}
        WHERE rule_id = $${valueIndex}
        RETURNING *
      `;

      const result = await pgClient.query(updateQuery, updateValues);
      const updatedRule = result.rows[0];

      // Map database fields to API format
      const mappedRule = {
        ruleId: updatedRule.rule_id,
        name: updatedRule.name,
        description: updatedRule.description,
        enabled: updatedRule.enabled,
        triggers: updatedRule.trigger_config || [],
        actions: updatedRule.action_config || [],
        createdAt: updatedRule.created_at,
        updatedAt: updatedRule.updated_at
      };

      res.json(mappedRule);
    } catch (error) {
      console.error('Error updating rule:', error);
      res.status(500).json({ error: 'internal-error' });
    }
  });

  // DELETE /rules/:ruleId - Delete specific rule
  router.delete('/:ruleId', async (req, res) => {
    try {
      const { ruleId } = req.params;

      const result = await pgClient.query('DELETE FROM overlay_rules WHERE rule_id = $1 RETURNING *', [ruleId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'not-found' });
      }

      res.json({ success: true, ruleId });
    } catch (error) {
      console.error('Error deleting rule:', error);
      res.status(500).json({ error: 'internal-error' });
    }
  });

  return router;
}