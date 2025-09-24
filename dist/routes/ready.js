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
exports.readyRouter = readyRouter;
const express_1 = require("express");
const policies_1 = require("../policies");
const verify_envelope_1 = require("../spv/verify-envelope");
function getPolicyMinConfs() {
    return Number(process.env.POLICY_MIN_CONFS || 1);
}
const BUNDLE_MAX_DEPTH = Number(process.env.BUNDLE_MAX_DEPTH || 8);
let headersIdx = null;
function ensureHeaders() {
    // Always reload headers for fresh data (no caching in tests)
    const HEADERS_FILE = process.env.HEADERS_FILE || './data/headers.json';
    headersIdx = (0, verify_envelope_1.loadHeaders)(HEADERS_FILE);
    return headersIdx;
}
function json(res, code, body) {
    return res.status(code).json(body);
}
async function getPolicy(policyId) {
    try {
        const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
        const pgClient = getPostgreSQLClient();
        const result = await pgClient.query(`SELECT * FROM policies WHERE policy_id = $1 AND enabled = 1`, [policyId]);
        const row = result.rows[0];
        return row ? JSON.parse(row.policy_json) : null;
    }
    catch (e) {
        return null;
    }
}
/**
 * /ready
 * DFS over lineage (depth ≤ BUNDLE_MAX_DEPTH), verify SPV envelope for each node against current headers,
 * enforce min confirmations. No pinning — confirmations are computed live from headers.
 *
 * Response: { ready: boolean, reason?: string, confirmations?: number }
 * - confirmations (if present) is the minimum confirmations across all verified nodes at time of check.
 */
function readyRouter() {
    const router = (0, express_1.Router)();
    router.get('/ready', async (req, res) => {
        try {
            const versionId = String(req.query.versionId || '').toLowerCase();
            if (!/^[0-9a-fA-F]{64}$/.test(versionId)) {
                return json(res, 400, { ready: false, reason: 'bad-request' });
            }
            // Load headers snapshot once for this request
            let idx;
            try {
                idx = ensureHeaders();
            }
            catch (e) {
                return json(res, 200, { ready: false, reason: 'headers-unavailable' });
            }
            // DFS lineage
            const stack = [{ v: versionId, d: 0 }];
            const seen = new Set();
            let minConfsAcross = Number.POSITIVE_INFINITY;
            while (stack.length) {
                const { v, d } = stack.pop();
                if (seen.has(v))
                    continue;
                seen.add(v);
                // Advisory check (active) - use async PostgreSQL functions
                const now = Math.floor(Date.now() / 1000);
                const { listAdvisoriesForVersionActiveAsync, listAdvisoriesForProducerActiveAsync, getProducerIdForVersionAsync, } = await Promise.resolve().then(() => __importStar(require('../db')));
                const pid = await getProducerIdForVersionAsync(v);
                const advV = await listAdvisoriesForVersionActiveAsync(v, now);
                const advP = pid ? await listAdvisoriesForProducerActiveAsync(pid, now) : [];
                const hasBlock = [...advV, ...advP].some((a) => a.type === 'BLOCK');
                if (hasBlock) {
                    return json(res, 200, { ready: false, reason: 'advisory-blocked' });
                }
                const { getDeclarationByVersion } = await Promise.resolve().then(() => __importStar(require('../db')));
                const decl = await getDeclarationByVersion(v);
                if (!decl?.proof_json) {
                    return json(res, 200, { ready: false, reason: `missing-envelope:${v}` });
                }
                const env = JSON.parse(decl.proof_json);
                const vr = await (0, verify_envelope_1.verifyEnvelopeAgainstHeaders)(env, idx, getPolicyMinConfs());
                if (!vr.ok) {
                    // Propagate reason; if insufficient confs, include computed confs
                    return json(res, 200, {
                        ready: false,
                        reason: vr.reason,
                        confirmations: vr.confirmations ?? 0,
                    });
                }
                if (typeof vr.confirmations === 'number') {
                    minConfsAcross = Math.min(minConfsAcross, vr.confirmations);
                }
                // Enqueue parents
                if (d < BUNDLE_MAX_DEPTH) {
                    const { getParents } = await Promise.resolve().then(() => __importStar(require('../db')));
                    const parents = await getParents(v);
                    for (const p of parents) {
                        if (!seen.has(p))
                            stack.push({ v: p, d: d + 1 });
                    }
                }
            }
            // If lineage had no nodes (shouldn't happen), treat as not ready
            if (!seen.size) {
                return json(res, 200, { ready: false, reason: 'not-found' });
            }
            const confsOut = Number.isFinite(minConfsAcross) ? minConfsAcross : undefined;
            // D28: Optional policy evaluation
            const policyId = req.query.policyId ? String(req.query.policyId) : null;
            let policyDecision = null;
            if (policyId) {
                try {
                    const policy = await getPolicy(policyId);
                    if (!policy) {
                        return json(res, 404, { ready: false, reason: 'policy-not-found' });
                    }
                    // Create mock manifest for policy evaluation
                    const manifest = {
                        confirmations: confsOut || 0,
                        recalled: false, // Would check advisories in production
                        policy: { classification: 'public', license: 'MIT' },
                        provenance: {
                            producer: { identityKey: 'demo-producer' },
                            createdAt: new Date().toISOString(),
                        },
                        content: { mimeType: 'application/json' },
                    };
                    // Create mock lineage
                    const lineage = Array.from(seen).map((v) => ({ versionId: v, type: 'data' }));
                    policyDecision = await (0, policies_1.evaluatePolicy)(versionId, policy, manifest, lineage);
                    // If policy blocks, override ready status
                    if (policyDecision.decision === 'block') {
                        return json(res, 200, {
                            ready: false,
                            reason: 'policy-blocked',
                            confirmations: confsOut,
                            policy: policyDecision,
                        });
                    }
                }
                catch (e) {
                    // Policy evaluation error - don't block, just warn
                    policyDecision = {
                        decision: 'warn',
                        reasons: [`Policy evaluation failed: ${e.message}`],
                        evidence: {},
                    };
                }
            }
            const response = { ready: true, reason: null, confirmations: confsOut };
            if (policyDecision) {
                response.policy = policyDecision;
            }
            return json(res, 200, response);
        }
        catch (e) {
            return json(res, 500, { ready: false, reason: String(e?.message || e) });
        }
    });
    return router;
}
//# sourceMappingURL=ready.js.map