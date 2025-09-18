import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import {
  getDeclarationByVersion,
  getManifest,
  getParents,
  listListings,
} from '../db';
import { loadHeaders, verifyEnvelopeAgainstHeaders, type HeadersIndex } from '../spv/verify-envelope';

const BUNDLE_MAX_DEPTH = Number(process.env.BUNDLE_MAX_DEPTH || 8);
const POLICY_MIN_CONFS = Number(process.env.POLICY_MIN_CONFS || 1);
const HEADERS_FILE = process.env.HEADERS_FILE || './data/headers.json';

let headersIdx: HeadersIndex | null = null;
function ensureHeaders(): HeadersIndex {
  if (!headersIdx) headersIdx = loadHeaders(HEADERS_FILE);
  return headersIdx!;
}

async function collectLineage(db: Database.Database, root: string, depth = BUNDLE_MAX_DEPTH) {
  const nodes: { versionId: string; manifestHash: string; txo: string }[] = [];
  const edges: { child: string; parent: string }[] = [];
  const manifestsArr: any[] = [];
  const proofsArr: any[] = [];

  const visited = new Set<string>();
  const stack: string[] = [root];

  while (stack.length && visited.size < 1000) {
    const v = stack.pop()!;
    if (visited.has(v)) continue;
    visited.add(v);

    const decl = getDeclarationByVersion(db, v);
    const man = getManifest(db, v);
    if (!man) throw new Error(`missing-manifest:${v}`);

    // Parse txo (discover vout only if we stored it; default to :0 for MVP)
    const vout = decl?.opret_vout ?? 0;
    const txo = decl?.txid ? `${decl.txid}:${vout}` : `${'0'.repeat(64)}:0`;

    nodes.push({ versionId: v, manifestHash: man.manifest_hash, txo });
    manifestsArr.push({ manifestHash: man.manifest_hash, manifest: JSON.parse(man.manifest_json) });

    // Envelope (must exist and be valid for MVP bundle)
    if (decl?.proof_json) {
      const envelope = JSON.parse(decl.proof_json);
      proofsArr.push({ versionId: v, envelope });
    } else {
      // No envelope persisted yet
      throw new Error(`missing-envelope:${v}`);
    }

    // Parents
    if (depth > 0) {
      const parents = getParents(db, v);
      for (const p of parents) {
        edges.push({ child: v, parent: p });
        stack.push(p);
      }
    }
  }

  return { nodes, edges, manifestsArr, proofsArr };
}

export function bundleRouter(db: Database.Database): Router {
  const router = makeRouter();

  router.get('/bundle', async (req: Request, res: Response) => {
    try {
      const versionId = String(req.query.versionId || '').toLowerCase();
      if (!/^[0-9a-fA-F]{64}$/.test(versionId)) {
        return res.status(400).json({ error: 'bad-request', hint: 'Provide versionId=64-hex' });
      }

      const { nodes, edges, manifestsArr, proofsArr } = await collectLineage(db, versionId, BUNDLE_MAX_DEPTH);

      // Verify each SPV envelope before serving (SPV-first)
      const idx = ensureHeaders();
      for (const p of proofsArr) {
        const env = p.envelope;
        const vr = await verifyEnvelopeAgainstHeaders(env, idx, POLICY_MIN_CONFS);
        if (!vr.ok) {
          return res.status(409).json({ error: 'invalid-envelope', versionId: p.versionId, reason: vr.reason });
        }
        // update confirmations for freshness
        p.envelope.confirmations = vr.confirmations ?? 0;
      }

      const bundle = {
        bundleType: 'datasetLineageBundle',
        target: versionId,
        graph: { nodes, edges },
        manifests: manifestsArr,
        proofs: proofsArr,
      };

      return res.status(200).json(bundle);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.startsWith('missing-manifest:') || msg.startsWith('missing-envelope:')) {
        return res.status(409).json({ error: 'incomplete-lineage', hint: msg });
      }
      return res.status(500).json({ error: 'bundle-failed', message: msg });
    }
  });

  return router;
}
