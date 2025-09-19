import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { getDeclarationByVersion, getParents } from '../db';
import {
  loadHeaders,
  verifyEnvelopeAgainstHeaders,
  type HeadersIndex,
} from '../spv/verify-envelope';

function getPolicyMinConfs() {
  return Number(process.env.POLICY_MIN_CONFS || 1);
}
const BUNDLE_MAX_DEPTH = Number(process.env.BUNDLE_MAX_DEPTH || 8);
const HEADERS_FILE = process.env.HEADERS_FILE || './data/headers.json';

let headersIdx: HeadersIndex | null = null;
function ensureHeaders(): HeadersIndex {
  // Always reload headers for fresh data (no caching in tests)
  headersIdx = loadHeaders(HEADERS_FILE);
  return headersIdx!;
}

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
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

        const decl = getDeclarationByVersion(db, v);
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
      return json(res, 200, { ready: true, reason: null, confirmations: confsOut });
    } catch (e: any) {
      return json(res, 500, { ready: false, reason: String(e?.message || e) });
    }
  });

  return router;
}
