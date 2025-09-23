import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { createTemplate, getTemplate, listTemplates, updateTemplate, deleteTemplate } from '../db';
import { generateContract, EXAMPLE_CONTRACT_TEMPLATE, EXAMPLE_TEMPLATE_SCHEMA } from '../agents/templates';
import { requireIdentity } from '../middleware/identity';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function templatesRouter(): Router {
  const router = makeRouter();

  // POST / (create template)
  router.post('/', requireIdentity(false), async (req: Request, res: Response) => {
    try {
      const { name, description, content, type = 'pdf', variables } = req.body || {};
      if (!name || !content) {
        return json(res, 400, { error: 'bad-request', hint: 'name and content required' });
      }

      const id = await createTemplate({
        name,
        description,
        template_content: content,
        template_type: type,
        variables_json: variables ? JSON.stringify(variables) : null
      });

      return json(res, 200, { status: 'ok', templateId: id });
    } catch (e: any) {
      return json(res, 500, { error: 'create-template-failed', message: String(e?.message || e) });
    }
  });

  // GET / (list templates)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const ownerId = req.query.owner ? String(req.query.owner) : undefined;
      const templates = await listTemplates(100, 0);
      const items = templates.map(t => ({
        templateId: t.template_id,
        name: t.name,
        description: t.description,
        type: t.template_type,
        variables: t.variables_json ? JSON.parse(t.variables_json) : null,
        createdAt: t.created_at,
      updatedAt: t.updated_at
    }));
    // TODO: Filter by ownerId if needed
      return json(res, 200, { items });
    } catch (e: any) {
      return json(res, 500, { error: 'list-templates-failed', message: String(e?.message || e) });
    }
  });

  // GET /:id (get template)
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const templateId = String(req.params.id);

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(templateId)) {
        return json(res, 404, { error: 'not-found' });
      }

      const t = await getTemplate(templateId);
      if (!t) return json(res, 404, { error: 'not-found' });

      return json(res, 200, {
        templateId: t.template_id,
        name: t.name,
        description: t.description,
        content: t.template_content,
        type: t.template_type,
        variables: t.variables_json ? JSON.parse(t.variables_json) : null,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      });
    } catch (e: any) {
      return json(res, 500, { error: 'get-template-failed', message: String(e?.message || e) });
    }
  });

  // PATCH /:id (update template)
  router.patch('/:id', requireIdentity(false), async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const t = await getTemplate(id);
      if (!t) return json(res, 404, { error: 'not-found' });

      const patch: any = {};
      if (typeof req.body?.name === 'string') patch.name = req.body.name;
      if (typeof req.body?.description === 'string') patch.description = req.body.description;
      if (typeof req.body?.content === 'string') patch.template_content = req.body.content;
      if (typeof req.body?.type === 'string') patch.template_type = req.body.type;
      if (req.body?.variables) patch.variables_json = JSON.stringify(req.body.variables);

      await updateTemplate(id, patch);
      return json(res, 200, { status: 'ok' });
    } catch (e: any) {
      return json(res, 500, { error: 'update-template-failed', message: String(e?.message || e) });
    }
  });

  // DELETE /:id
  router.delete('/:id', requireIdentity(false), async (req: Request, res: Response) => {
    try {
      const deleted = await deleteTemplate(String(req.params.id));
      if (!deleted) return json(res, 404, { error: 'not-found' });
      return json(res, 200, { status: 'ok' });
    } catch (e: any) {
      return json(res, 500, { error: 'delete-template-failed', message: String(e?.message || e) });
    }
  });

  // POST /:id/generate (generate contract from template)
  router.post('/:id/generate', requireIdentity(false), async (req: Request, res: Response) => {
    try {
      const templateId = String(req.params.id);
      const variables = req.body?.variables || {};

      const template = await getTemplate(templateId);
      if (!template) {
        return json(res, 404, { error: 'not-found' });
      }

      const result = await generateContract(template, variables);

      if (!result.success) {
        return json(res, 400, { error: 'generation-failed', message: result.error });
      }

      return json(res, 200, {
        status: 'ok',
        content: result.content,
        metadata: result.metadata
      });
    } catch (e: any) {
      return json(res, 500, { error: 'generate-failed', message: String(e?.message || e) });
    }
  });

  // POST /bootstrap (create example template)
  router.post('/bootstrap', requireIdentity(false), async (req: Request, res: Response) => {
    try {
      const existingTemplates = await listTemplates(1, 0);
      if (existingTemplates.length > 0) {
        return json(res, 400, { error: 'templates-exist', hint: 'Bootstrap only works on empty systems' });
      }

      const id = await createTemplate({
        name: 'Data Processing Agreement',
        description: 'Standard template for data processing agreements',
        template_content: EXAMPLE_CONTRACT_TEMPLATE,
        template_type: 'markdown',
        variables_json: JSON.stringify(EXAMPLE_TEMPLATE_SCHEMA)
      });

      return json(res, 200, { status: 'ok', templateId: id, message: 'Example template created' });
    } catch (e: any) {
      return json(res, 500, { error: 'bootstrap-failed', message: String(e?.message || e) });
    }
  });

  return router;
}