/**
 * Minimal verification façade for Lineage Bundles.
 * Wire these to your SPV, manifest digest, and signature verification modules.
 */

import type { LineageBundle } from './index';
import type { BRC36 } from '../brc';

export type VerifyOptions = {
  verifyEnvelope: (env: BRC36.SPVEnvelope) => Promise<boolean>;
  digestManifest: (manifest: unknown) => Promise<string>; // hex digest of canonical manifest
  verifyManifestSignatures?: (manifest: unknown) => Promise<boolean>;
};

export async function verifyBundle(bundle: LineageBundle, opts: VerifyOptions): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (bundle.bundleType !== 'datasetLineageBundle') {
    errors.push('invalid bundleType');
    return { ok: false, errors };
  }

  // 1) SPV for each node
  for (const p of bundle.proofs) {
    const ok = await opts.verifyEnvelope(p.envelope).catch(() => false);
    if (!ok) errors.push(`SPV failed for versionId=${p.versionId}`);
  }

  // 2) Manifest hash integrity
  for (const n of bundle.graph.nodes) {
    const mm = bundle.manifests.find((m) => m.manifestHash.toLowerCase() === n.manifestHash.toLowerCase());
    if (!mm) { errors.push(`missing manifest for ${n.manifestHash}`); continue; }
    const d = await opts.digestManifest(mm.manifest).catch(() => '');
    if (!d || d.toLowerCase() !== n.manifestHash.toLowerCase()) {
      errors.push(`manifest hash mismatch for versionId=${n.versionId}`);
    }
    if (opts.verifyManifestSignatures) {
      const ok = await opts.verifyManifestSignatures(mm.manifest).catch(() => false);
      if (!ok) errors.push(`manifest signature invalid for versionId=${n.versionId}`);
    }
  }

  // 3) DAG sanity
  const nodeSet = new Set(bundle.graph.nodes.map((x) => x.versionId.toLowerCase()));
  for (const e of bundle.graph.edges) {
    if (!nodeSet.has(e.child.toLowerCase()) || !nodeSet.has(e.parent.toLowerCase())) {
      errors.push(`edge references unknown node ${JSON.stringify(e)}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
