"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.producersRegisterRouter = producersRegisterRouter;
const express_1 = require("express");
const db_1 = require("../db");
const identity_1 = require("../middleware/identity");
/**
 * POST /producers/register { name?, website? }
 * Requires identity signature; associates identity key with producer profile.
 */
function producersRegisterRouter() {
    const router = (0, express_1.Router)();
    router.post('/producers/register', (0, identity_1.requireIdentity)(true), async (req, res) => {
        try {
            const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
            const website = typeof req.body?.website === 'string' ? req.body.website : undefined;
            const pid = await (0, db_1.upsertProducer)({ identity_key: req.identityKey, name, website });
            return res.status(200).json({ status: 'ok', producerId: pid });
        }
        catch (e) {
            return res.status(500).json({ error: 'register-failed', message: String(e?.message || e) });
        }
    });
    return router;
}
//# sourceMappingURL=producers-register.js.map