"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.producersRouter = producersRouter;
const express_1 = require("express");
const db_1 = require("../db");
function json(res, code, body) {
    return res.status(code).json(body);
}
/**
 * Producers API
 * - GET /producers/:id
 * - GET /producers?datasetId=...  (resolve mapping)
 * - (Optional) GET /producers?q=... (basic search by name, requires additional DB helper; omitted in MVP)
 */
function producersRouter() {
    const router = (0, express_1.Router)();
    // Resolve by datasetId
    router.get('/producers', async (req, res) => {
        const datasetId = String(req.query.datasetId || '').trim();
        if (!datasetId) {
            return json(res, 400, { error: 'bad-request', hint: 'provide datasetId' });
        }
        const p = await (0, db_1.getProducerByDatasetId)(datasetId);
        if (!p)
            return json(res, 404, { error: 'not-found', hint: 'no producer for datasetId' });
        return json(res, 200, {
            producerId: p.producer_id,
            name: p.display_name || p.name,
            website: p.website,
            identityKey: p.identity_key,
            createdAt: p.created_at,
        });
    });
    // Fetch by producer_id
    router.get('/producers/:id', async (req, res) => {
        const id = String(req.params.id || '').trim();
        if (!id)
            return json(res, 400, { error: 'bad-request' });
        const p = await (0, db_1.getProducerById)(id);
        if (!p)
            return json(res, 404, { error: 'not-found' });
        return json(res, 200, {
            producerId: p.producer_id,
            name: p.display_name || p.name,
            website: p.website,
            identityKey: p.identity_key,
            createdAt: p.created_at,
        });
    });
    return router;
}
//# sourceMappingURL=producers.js.map