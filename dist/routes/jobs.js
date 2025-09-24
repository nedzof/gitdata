"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobsRouter = jobsRouter;
// Basic jobs router for testing
const express_1 = require("express");
function jobsRouter() {
    const router = (0, express_1.Router)();
    router.get('/', (req, res) => {
        res.json({ items: [], total: 0 });
    });
    router.post('/', (req, res) => {
        res.json({ success: true, jobId: 'test-job-id' });
    });
    return router;
}
//# sourceMappingURL=jobs.js.map