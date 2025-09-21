import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { getDeclarationByVersion, getParents } from '../db';
import { listAdvisoriesForVersionActive, listAdvisoriesForProducerActive, getProducerIdForVersion } from '../db';
import {
  loadHeaders,
  verifyEnvelopeAgainstHeaders,
  type HeadersIndex,
} from '../spv/verify-envelope';
import { evaluatePolicy, type PolicyJSON, type PolicyDecision } from '../policies';

function getPolicyMinConfs() {
  return Number(process.env.POLICY_MIN_CONFS || 1);
}
const BUNDLE_MAX_DEPTH = Number(process.env.BUNDLE_MAX_DEPTH || 8);

let headersIdx: HeadersIndex | null = null;
function ensureHeaders(): HeadersIndex {
  // Always reload headers for fresh data (no caching in tests)
  const HEADERS_FILE = process.env.HEADERS_FILE || './data/headers.json';
  headersIdx = loadHeaders(HEADERS_FILE);
  return headersIdx!;
}

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

async function getPolicy(db: any, policyId: string) {
  try {
    const { getPostgreSQLClient } = await import('../db/postgresql');
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query(
      `SELECT * FROM policies WHERE policy_id = $1 AND enabled = 1`,
      [policyId]
    );
    const row = result.rows[0] as any;
    return row ? JSON.parse(row.policy_json) : null;
  } catch (e) {
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
export function readyRouter(db: Database.Database): Router {
  const router = makeRouter();

  router.get('/ready', async (req: Request, res: Response) => {
    try {
      const versionId = String(req.query.versionId || '').toLowerCase();
      if (!/^[0-9a-fA-F]{64}$/.test(versionId)) {
        return json(res, 400, { ready: false, reason: 'bad-request' });
      }

      // Load headers snapshot once for this request
      let idx: HeadersIndex;
      try {
        idx = ensureHeaders();
      } catch (e: any) {
        return json(res, 200, { ready: false, reason: 'headers-unavailable' });
      }

      // DFS lineage
      const stack: Array<{ v: string; d: number }> = [{ v: versionId, d: 0 }];
      const seen = new Set<string>();
      let minConfsAcross = Number.POSITIVE_INFINITY;

      while (stack.length) {
        const { v, d } = stack.pop()!;
        if (seen.has(v)) continue;
        seen.add(v);

        // Advisory check (active)
        const now = Math.floor(Date.now() / 1000);
        const pid = getProducerIdForVersion(db, v);
        const advV = listAdvisoriesForVersionActive(db, v, now);
        const advP = pid ? listAdvisoriesForProducerActive(db, pid, now) : [];
        const hasBlock = [...advV, ...advP].some((a) => a.type === 'BLOCK');
        if (hasBlock) {
          return json(res, 200, { ready: false, reason: 'advisory-blocked' });
        }

        const decl = await getDeclarationByVersion(v);
        if (!decl?.proof_json) {
          return json(res, 200, { ready: false, reason: `missing-envelope:${v}` });
        }

        const env = JSON.parse(decl.proof_json);
        const vr = await verifyEnvelopeAgainstHeaders(env, idx, getPolicyMinConfs());
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
          const parents = getParents(db, v);
          for (const p of parents) {
            if (!seen.has(p)) stack.push({ v: p, d: d + 1 });
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
      let policyDecision: PolicyDecision | null = null;

      if (policyId) {
        try {
          const policy = await getPolicy(db, policyId);
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
              createdAt: new Date().toISOString()
            },
            content: { mimeType: 'application/json' }
          };

          // Create mock lineage
          const lineage = Array.from(seen).map(v => ({ versionId: v, type: 'data' }));

          policyDecision = await evaluatePolicy(versionId, policy, manifest, lineage);

          // If policy blocks, override ready status
          if (policyDecision.decision === 'block') {
            return json(res, 200, {
              ready: false,
              reason: 'policy-blocked',
              confirmations: confsOut,
              policy: policyDecision
            });
          }
        } catch (e) {
          // Policy evaluation error - don't block, just warn
          policyDecision = {
            decision: 'warn' as const,
            reasons: [`Policy evaluation failed: ${e.message}`],
            evidence: {}
          };
        }
      }

      const response: any = { ready: true, reason: null, confirmations: confsOut };
      if (policyDecision) {
        response.policy = policyDecision;
      }

      return json(res, 200, response);
    } catch (e: any) {
      return json(res, 500, { ready: false, reason: String(e?.message || e) });
    }
  });

  return router;
}
