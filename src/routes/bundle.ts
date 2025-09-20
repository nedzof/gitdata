import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { getDeclarationByVersion, getManifest, getParents } from '../db';
import { verifyEnvelopeAgainstHeaders } from '../spv/verify-envelope';
import { getHeadersSnapshot } from '../spv/headers-cache';
import { bundlesGet, bundlesSet, bundlesInvalidate, bundlesKey } from '../cache/bundles';
import { metricsRoute } from '../middleware/metrics';
import { cacheHit, cacheMiss, observeProofLatency } from '../metrics/registry';

const BUNDLE_MAX_DEPTH = Number(process.env.BUNDLE_MAX_DEPTH || 8);
const POLICY_MIN_CONFS = Number(process.env.POLICY_MIN_CONFS || 1);
const VALIDATE_BUNDLE = /^true$/i.test(process.env.BUNDLE_VALIDATE || 'false');
// Note: runtime schema validation optional (init validator only if enabled)
let validatorReady = false;
let validateBundleFn: ((doc: unknown) => { ok: boolean; errors?: any }) | null = null;
function ensureValidator() {
  if (!VALIDATE_BUNDLE || validatorReady) return;
  const { initBundleValidator, validateBundle } = require('../validators/bundle');
  initBundleValidator();
  validateBundleFn = validateBundle;
  validatorReady = true;
}

type NodeOut = { versionId: string; manifestHash: string; txo: string };
type EdgeOut = { child: string; parent: string };

async function collectLineage(root: string, depth = BUNDLE_MAX_DEPTH) {
  const nodes: NodeOut[] = [];
  const edges: EdgeOut[] = [];
  const manifestsArr: any[] = [];
  const proofsArr: any[] = [];

  const visited = new Set<string>();
  const stack: Array<{ v: string; d: number }> = [{ v: root, d: 0 }];

  while (stack.length) {
    const { v, d } = stack.pop()!;
    if (visited.has(v)) continue;
    visited.add(v);

    const decl = await getDeclarationByVersion(v);
    const man = await getManifest(v);
    if (!man) throw new Error(`missing-manifest:${v}`);

    const vout = decl?.opret_vout ?? 0;
    const txo = decl?.txid ? `${decl.txid}:${vout}` : `${'0'.repeat(64)}:0`;

    nodes.push({ versionId: v, manifestHash: man.manifest_hash, txo });
    manifestsArr.push({ manifestHash: man.manifest_hash, manifest: JSON.parse(man.manifest_json) });

    if (decl?.proof_json) {
      const envelope = JSON.parse(decl.proof_json);
      proofsArr.push({ versionId: v, envelope });
    } else {
      throw new Error(`missing-envelope:${v}`);
    }

    if (d < depth) {
      const parents = await getParents(v);
      for (const p of parents) {
        edges.push({ child: v, parent: p });
        if (!visited.has(p)) stack.push({ v: p, d: d + 1 });
      }
    }
  }

  return { nodes, edges, manifestsArr, proofsArr };
}

/**
 * Recompute confirmations for a cached bundle using current headers snapshot.
 * Also enforce POLICY_MIN_CONFS; if violated, return { ok:false, reason }.
 */
async function recomputeConfsAndEnforce(
  bundle: any,
): Promise<{ ok: boolean; reason?: string }> {
  const HEADERS_FILE = process.env.HEADERS_FILE || './data/headers.json';
  const idx = getHeadersSnapshot(HEADERS_FILE);
  for (const p of bundle.proofs as any[]) {
    const env = p.envelope;
    const vr = await verifyEnvelopeAgainstHeaders(env, idx, POLICY_MIN_CONFS);
    if (!vr.ok) {
      return { ok: false, reason: vr.reason };
    }
    p.envelope.confirmations = vr.confirmations ?? 0; // dynamic
  }
  return { ok: true };
}

export function bundleRouter(): Router {
  const router = makeRouter();

  ensureValidator();

  // record request metrics for bundle route
  router.use('/bundle', metricsRoute('bundle'));

  router.get('/bundle', async (req: Request, res: Response) => {
    try {
      const versionId = String(req.query.versionId || '').toLowerCase();
      if (!/^[0-9a-fA-F]{64}$/.test(versionId)) {
        return res.status(400).json({ error: 'bad-request', hint: 'Provide versionId=64-hex' });
      }
      const depth = Number(req.query.depth || BUNDLE_MAX_DEPTH);
      const key = bundlesKey(versionId, depth);

      // 1) Try cache
      const cached = await bundlesGet(key);
      if (cached) {
        cacheHit();
        // Use a shallow copy so we don't mutate the cache body
        const body = JSON.parse(JSON.stringify(cached.body));
        const t0 = Date.now();
        const re = await recomputeConfsAndEnforce(body);
        observeProofLatency(Date.now() - t0);
        if (!re.ok) {
          // If policy now fails (e.g., reorg or threshold), invalidate cache and fall through to rebuild
          await bundlesInvalidate(key);
        } else {
          if (VALIDATE_BUNDLE && validateBundleFn) {
            const vb = validateBundleFn(body);
            if (!vb.ok) return res.status(500).json({ error: 'bundle-schema-invalid', details: vb.errors });
          }
          res.setHeader('x-cache', 'hit');
          return res.status(200).json(body);
        }
      } else {
        cacheMiss();
      }

      // 2) Build fresh
      const { nodes, edges, manifestsArr, proofsArr } = await collectLineage(versionId, depth);

      // Verify & compute confirmations with current headers
      const HEADERS_FILE = process.env.HEADERS_FILE || './data/headers.json';
      const idx = getHeadersSnapshot(HEADERS_FILE);
      const t1 = Date.now();
      for (const p of proofsArr) {
        const env = p.envelope;
        const vr = await verifyEnvelopeAgainstHeaders(env, idx, POLICY_MIN_CONFS);
        if (!vr.ok) {
          return res.status(409).json({ error: 'invalid-envelope', versionId: p.versionId, reason: vr.reason });
        }
        p.envelope.confirmations = vr.confirmations ?? 0;
      }
      observeProofLatency(Date.now() - t1);

      const bundle = {
        bundleType: 'datasetLineageBundle',
        target: versionId,
        graph: { nodes, edges },
        manifests: manifestsArr,
        proofs: proofsArr,
      };

      if (VALIDATE_BUNDLE && validateBundleFn) {
        const vb = validateBundleFn(bundle);
        if (!vb.ok) return res.status(500).json({ error: 'bundle-schema-invalid', details: vb.errors });
      }

      // 3) Cache (structure only). confirmations dynamic on future reads.
      await bundlesSet(key, bundle, true);
      res.setHeader('x-cache', 'miss');
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