import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { validateDlm1Manifest, initValidators } from '../validators';
import { requireIdentity } from '../middleware/identity';
import * as db from '../db';
import {
  buildDlm1AnchorFromManifest,
  deriveManifestIds,
} from '../dlm1/codec';
import {
  composeTag,
  buildOpReturnScript,
  opReturnOutputSize,
} from '../builders/opreturn';

type SubmitResponse = {
  status: 'ok';
  versionId: string;
  manifestHash: string;
  parents: string[];
  outputs: { scriptHex: string; satoshis: number }[];
  // optional helpers
  opReturnScriptHex: string;
  opReturnOutputBytes: number;
};

function jsonError(res: Response, code: number, error: string, hint?: string, details?: unknown) {
  return res.status(code).json({ error, hint, details });
}

/**
 * Factory: create a router with a single POST /submit/dlm1 route
 * Body:
 * {
 *   "manifest": <object conforming to dlm1-manifest.schema.json>
 * }
 *
 * Response (200):
 * {
 *   "status": "ok",
 *   "versionId": "<64-hex>",
 *   "manifestHash": "<64-hex>",
 *   "parents": ["<64-hex>", ...],
 *   "outputs": [{ "scriptHex": "<hex>", "satoshis": 0 }],
 *   "opReturnScriptHex": "<hex>",
 *   "opReturnOutputBytes": <number>
 * }
 */
export function submitDlm1Router(opts?: { manifestSchemaPath?: string }): Router {
  if (opts?.manifestSchemaPath) {
    initValidators(opts.manifestSchemaPath);
  } else {
    initValidators();
  }

  const router = makeRouter();

  router.post('/submit/dlm1', requireIdentity(), async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        return jsonError(res, 415, 'unsupported-media-type', 'Use application/json');
      }

      const body = req.body || {};
      const manifest = body.manifest;

      if (!manifest || typeof manifest !== 'object') {
        return jsonError(res, 400, 'invalid-input', 'Body.manifest is required (object)');
      }

      // 1) Validate manifest against schema
      const vres = validateDlm1Manifest(manifest);
      if (!vres.ok) {
        return jsonError(res, 422, 'schema-validation-failed', 'Manifest does not conform to schema', vres.errors);
      }

      // 2) Derive versionId with canonicalization (signatures + versionId excluded)
      const { versionId, manifestHash } = deriveManifestIds(manifest);

      // 3) Encode DLM1 CBOR anchor and build OP_RETURN script
      const built = buildDlm1AnchorFromManifest(manifest); // { cbor, versionId, parents }
      if (built.versionId !== versionId) {
        // Defensive check; they should match bit-for-bit
        return jsonError(res, 500, 'derive-mismatch', 'Internal mismatch in versionId derivation');
      }

      const blob = composeTag('DLM1', built.cbor);
      const scriptHex = buildOpReturnScript(blob);

      // 4) Store the manifest in the database for searching (if db is provided)
      if (db) {
        try {
          await db.upsertManifest({
            version_id: versionId,
            manifest_hash: manifestHash,
            dataset_id: manifest.datasetId || 'unknown',
            content_hash: manifest.content?.contentHash || null,
            title: manifest.description || null,
            license: manifest.policy?.license || null,
            classification: manifest.policy?.classification || null,
            created_at: manifest.provenance?.createdAt || new Date().toISOString(),
            manifest_json: JSON.stringify(manifest),
            producer_id: null
          });
        } catch (error) {
          // Log error but don't fail the submission since this is for testing
          console.warn('Failed to store manifest in database:', error);
        }
      }

      // 5) Return wallet-ready outputs (BRC-100 compatible shape)
      const outputs = [{ scriptHex, satoshis: 0 }];
      const outBytes = opReturnOutputSize(blob.length);

      const resp: SubmitResponse = {
        status: 'ok',
        versionId,
        manifestHash,
        parents: built.parents,
        outputs,
        opReturnScriptHex: scriptHex,
        opReturnOutputBytes: outBytes,
      };
      return res.status(200).json(resp);
    } catch (e: any) {
      return jsonError(res, 500, 'submit-dlm1-failed', e?.message || 'unknown-error');
    }
  });

  return router;
}
