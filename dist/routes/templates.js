"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templatesRouter = templatesRouter;
const express_1 = require("express");
const templates_1 = require("../agents/templates");
const db_1 = require("../db");
const identity_1 = require("../middleware/identity");
function json(res, code, body) {
    return res.status(code).json(body);
}
function templatesRouter() {
    const router = (0, express_1.Router)();
    // POST / (create template)
    router.post('/', (0, identity_1.requireIdentity)(false), async (req, res) => {
        try {
            const { name, description, content, type = 'pdf', variables } = req.body || {};
            if (!name || !content) {
                return json(res, 400, { error: 'bad-request', hint: 'name and content required' });
            }
            const id = await (0, db_1.createTemplate)({
                name,
                description,
                template_content: content,
                template_type: type,
                variables_json: variables ? JSON.stringify(variables) : null,
            });
            return json(res, 200, { status: 'ok', templateId: id });
        }
        catch (e) {
            return json(res, 500, { error: 'create-template-failed', message: String(e?.message || e) });
        }
    });
    // GET / (list templates)
    router.get('/', async (req, res) => {
        try {
            const ownerId = req.query.owner ? String(req.query.owner) : undefined;
            const templates = await (0, db_1.listTemplates)(100, 0);
            const items = templates.map((t) => ({
                templateId: t.template_id,
                name: t.name,
                description: t.description,
                type: t.template_type,
                variables: t.variables_json ? JSON.parse(t.variables_json) : null,
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            }));
            // TODO: Filter by ownerId if needed
            return json(res, 200, { items });
        }
        catch (e) {
            return json(res, 500, { error: 'list-templates-failed', message: String(e?.message || e) });
        }
    });
    // GET /:id (get template)
    router.get('/:id', async (req, res) => {
        try {
            const templateId = String(req.params.id);
            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(templateId)) {
                return json(res, 404, { error: 'not-found' });
            }
            const t = await (0, db_1.getTemplate)(templateId);
            if (!t)
                return json(res, 404, { error: 'not-found' });
            return json(res, 200, {
                templateId: t.template_id,
                name: t.name,
                description: t.description,
                content: t.template_content,
                type: t.template_type,
                variables: t.variables_json ? JSON.parse(t.variables_json) : null,
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            });
        }
        catch (e) {
            return json(res, 500, { error: 'get-template-failed', message: String(e?.message || e) });
        }
    });
    // PATCH /:id (update template)
    router.patch('/:id', (0, identity_1.requireIdentity)(false), async (req, res) => {
        try {
            const id = String(req.params.id);
            const t = await (0, db_1.getTemplate)(id);
            if (!t)
                return json(res, 404, { error: 'not-found' });
            const patch = {};
            if (typeof req.body?.name === 'string')
                patch.name = req.body.name;
            if (typeof req.body?.description === 'string')
                patch.description = req.body.description;
            if (typeof req.body?.content === 'string')
                patch.template_content = req.body.content;
            if (typeof req.body?.type === 'string')
                patch.template_type = req.body.type;
            if (req.body?.variables)
                patch.variables_json = JSON.stringify(req.body.variables);
            await (0, db_1.updateTemplate)(id, patch);
            return json(res, 200, { status: 'ok' });
        }
        catch (e) {
            return json(res, 500, { error: 'update-template-failed', message: String(e?.message || e) });
        }
    });
    // DELETE /:id
    router.delete('/:id', (0, identity_1.requireIdentity)(false), async (req, res) => {
        try {
            const deleted = await (0, db_1.deleteTemplate)(String(req.params.id));
            if (!deleted)
                return json(res, 404, { error: 'not-found' });
            return json(res, 200, { status: 'ok' });
        }
        catch (e) {
            return json(res, 500, { error: 'delete-template-failed', message: String(e?.message || e) });
        }
    });
    // POST /:id/generate (generate contract from template)
    router.post('/:id/generate', (0, identity_1.requireIdentity)(false), async (req, res) => {
        try {
            const templateId = String(req.params.id);
            const variables = req.body?.variables || {};
            const template = await (0, db_1.getTemplate)(templateId);
            if (!template) {
                return json(res, 404, { error: 'not-found' });
            }
            const result = await (0, templates_1.generateContract)(template, variables);
            if (!result.success) {
                return json(res, 400, { error: 'generation-failed', message: result.error });
            }
            return json(res, 200, {
                status: 'ok',
                content: result.content,
                metadata: result.metadata,
            });
        }
        catch (e) {
            return json(res, 500, { error: 'generate-failed', message: String(e?.message || e) });
        }
    });
    // POST /bootstrap (create example template)
    router.post('/bootstrap', (0, identity_1.requireIdentity)(false), async (req, res) => {
        try {
            const existingTemplates = await (0, db_1.listTemplates)(1, 0);
            if (existingTemplates.length > 0) {
                return json(res, 400, {
                    error: 'templates-exist',
                    hint: 'Bootstrap only works on empty systems',
                });
            }
            const id = await (0, db_1.createTemplate)({
                name: 'Data Processing Agreement',
                description: 'Standard template for data processing agreements',
                template_content: templates_1.EXAMPLE_CONTRACT_TEMPLATE,
                template_type: 'markdown',
                variables_json: JSON.stringify(templates_1.EXAMPLE_TEMPLATE_SCHEMA),
            });
            return json(res, 200, { status: 'ok', templateId: id, message: 'Example template created' });
        }
        catch (e) {
            return json(res, 500, { error: 'bootstrap-failed', message: String(e?.message || e) });
        }
    });
    return router;
}
//# sourceMappingURL=templates.js.map