import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { getDeclarationByVersion, getParents } from '../db';
import { loadHeaders, verifyEnvelopeAgainstHeaders, type HeadersIndex } from '../spv/verify-envelope';

const POLICY_MIN_CONFS = Number(process.env.POLICY_MIN_CONFS || 1);
const BUNDLE_MAX_DEPTH = Number(process.env.BUNDLE_MAX_DEPTH || 8);
const HEADERS_FILE = process.env.HEADERS_FILE || './data/headers.json';

let headersIdx: HeadersIndex | null = null;
function ensureHeaders(): HeadersIndex {
  if (!headersIdx) headersIdx = loadHeaders(HEADERS_FILE);
  return headersIdx!;
}

export function readyRouter(db: Database.Database): Router {
  const router = makeRouter();

  router.get('/ready', async (req: Request, res: Response) => {
    try {
      const versionId = String(req.query.versionId || '').toLowerCase();
      if (!/^[0-9a-fA-F]{64}$/.test(versionId)) {
        return res.status(400).json({ ready: false, reason: 'bad-request' });
      }

      // DFS lineage and verify envelopes
      const stack = [versionId];
      const seen = new Set<string>();
      const idx = ensureHeaders();

      while (stack.length) {
        const v = stack.pop()!;
        if (seen.has(v)) continue;
        seen.add(v);

        const decl = getDeclarationByVersion(db, v);
        if (!decl?.proof_json) {
          return res.status(200).json({ ready: false, reason: `missing-envelope:${v}` });
        }
        const env = JSON.parse(decl.proof_json);

        const vr = await verifyEnvelopeAgainstHeaders(env, idx, POLICY_MIN_CONFS);
        if (!vr.ok) {
          return res.status(200).json({ ready: false, reason: vr.reason, confirmations: vr.confirmations ?? 0 });
        }

        // enqueue parents
        if (seen.size <= BUNDLE_MAX_DEPTH) {
          const parents = getParents(db, v);
          for (const p of parents) stack.push(p);
        }
      }

      return res.status(200).json({ ready: true, reason: null });
    } catch (e: any) {
      return res.status(500).json({ ready: false, reason: String(e?.message || e) });
    }
  });

  return router;
}
