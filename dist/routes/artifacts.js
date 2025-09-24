"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.artifactsRouter = artifactsRouter;
const express_1 = require("express");
function json(res, code, body) {
    return res.status(code).json(body);
}
function artifactsRouter() {
    const router = (0, express_1.Router)();
    // GET / (list artifacts)
    router.get('/', async (req, res) => {
        try {
            // For now, return empty list for testing
            return json(res, 200, { items: [] });
        }
        catch (e) {
            return json(res, 500, { error: 'list-failed', message: String(e?.message || e) });
        }
    });
    // GET /:id (get specific artifact)
    router.get('/:id', async (req, res) => {
        try {
            const artifactId = req.params.id;
            // For now, always return 404 since no artifacts are implemented
            return json(res, 404, { error: 'not-found', message: `Artifact ${artifactId} not found` });
        }
        catch (e) {
            return json(res, 500, { error: 'get-failed', message: String(e?.message || e) });
        }
    });
    return router;
}
//# sourceMappingURL=artifacts.js.map