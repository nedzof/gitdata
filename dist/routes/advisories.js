"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.advisoriesRouter = advisoriesRouter;
const express_1 = require("express");
const db_1 = require("../db");
const advisory_1 = require("../validators/advisory");
function json(res, code, body) {
    return res.status(code).json(body);
}
function advisoriesRouter() {
    const router = (0, express_1.Router)();
    (0, advisory_1.initAdvisoryValidator)();
    // POST /advisories
    // Body: { type:'BLOCK'|'WARN', reason:string, expiresAt?:number, payload?:object, targets:{ versionIds?:string[], producerIds?:string[] } }
    router.post('/advisories', async (req, res) => {
        try {
            const { type, reason, expiresAt, payload, targets } = req.body || {};
            if (type !== 'BLOCK' && type !== 'WARN')
                return json(res, 400, { error: 'bad-request', hint: 'type must be BLOCK or WARN' });
            if (typeof reason !== 'string' || reason.length < 3)
                return json(res, 400, { error: 'bad-request', hint: 'reason required' });
            const advisoryId = 'adv_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
            const now = Math.floor(Date.now() / 1000);
            const doc = {
                advisoryId,
                type,
                reason,
                createdAt: now,
                ...(typeof expiresAt === 'number' ? { expiresAt } : {}),
                ...(payload && typeof payload === 'object' ? { payload } : {}),
            };
            const v = (0, advisory_1.validateAdvisory)(doc);
            if (!v.ok)
                return json(res, 422, { error: 'schema-validation-failed', details: v.errors });
            const advRow = {
                advisory_id: advisoryId,
                type,
                reason,
                created_at: now,
                expires_at: typeof expiresAt === 'number' ? Number(expiresAt) : null,
                payload_json: payload ? JSON.stringify(payload) : null,
            };
            const tgtList = [];
            if (targets && typeof targets === 'object') {
                const vIds = Array.isArray(targets.versionIds) ? targets.versionIds : [];
                for (const vId of vIds) {
                    if (/^[0-9a-fA-F]{64}$/.test(String(vId || '')))
                        tgtList.push({ version_id: String(vId).toLowerCase(), producer_id: null });
                }
                const pIds = Array.isArray(targets.producerIds) ? targets.producerIds : [];
                for (const pId of pIds) {
                    if (typeof pId === 'string' && pId.length > 2)
                        tgtList.push({ version_id: null, producer_id: pId });
                }
            }
            if (tgtList.length === 0)
                return json(res, 400, {
                    error: 'bad-request',
                    hint: 'at least one target (versionIds or producerIds) required',
                });
            // Use PostgreSQL only
            await (0, db_1.insertAdvisory)(advRow);
            await (0, db_1.insertAdvisoryTargets)(advisoryId, tgtList);
            return json(res, 200, { status: 'ok', advisoryId });
        }
        catch (e) {
            console.error('[advisories POST] Error details:', e);
            return json(res, 500, {
                error: 'advisory-create-failed',
                message: String(e?.message || e),
                stack: e?.stack,
            });
        }
    });
    // GET /advisories?versionId=... | /advisories?producerId=...
    router.get('/advisories', async (req, res) => {
        const versionId = req.query.versionId ? String(req.query.versionId).toLowerCase() : undefined;
        const producerId = req.query.producerId ? String(req.query.producerId) : undefined;
        const now = Math.floor(Date.now() / 1000);
        if (!versionId && !producerId)
            return json(res, 400, { error: 'bad-request', hint: 'versionId or producerId required' });
        try {
            let list = [];
            // Use PostgreSQL only
            const { listAdvisoriesForVersionActiveAsync, listAdvisoriesForProducerActiveAsync, getProducerIdForVersionAsync, } = await Promise.resolve().then(() => __importStar(require('../db')));
            if (versionId) {
                console.log(`[advisories GET] Looking for advisories for versionId: ${versionId}, now: ${now}`);
                list = await listAdvisoriesForVersionActiveAsync(versionId, now);
                console.log(`[advisories GET] Found ${list.length} version-scoped advisories`);
                // Also check producer-scoped advisories for this version's producer
                const pid = await getProducerIdForVersionAsync(versionId);
                console.log(`[advisories GET] Producer ID for version: ${pid}`);
                if (pid) {
                    const producerAdvs = await listAdvisoriesForProducerActiveAsync(pid, now);
                    console.log(`[advisories GET] Found ${producerAdvs.length} producer-scoped advisories`);
                    list = list.concat(producerAdvs);
                }
            }
            if (producerId) {
                const producerAdvs = await listAdvisoriesForProducerActiveAsync(producerId, now);
                list = list.concat(producerAdvs);
            }
            // De-dupe by advisory_id
            const map = new Map();
            for (const a of list)
                map.set(a.advisory_id, a);
            const out = Array.from(map.values()).map((a) => ({
                advisoryId: a.advisory_id,
                type: a.type,
                reason: a.reason,
                createdAt: a.created_at,
                expiresAt: a.expires_at ?? undefined,
                payload: a.payload_json ? JSON.parse(a.payload_json) : undefined,
            }));
            return json(res, 200, { items: out });
        }
        catch (e) {
            return json(res, 500, { error: 'advisories-fetch-failed', message: String(e?.message || e) });
        }
    });
    return router;
}
//# sourceMappingURL=advisories.js.map