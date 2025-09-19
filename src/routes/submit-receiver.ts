import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { BRC22 } from '../brc/index';
import {
  txidFromRawTx,
  verifyEnvelopeAgainstHeaders,
  loadHeaders,
  type HeadersIndex,
  type SPVEnvelope,
} from '../spv/verify-envelope';
import { ingestSubmission } from '../services/ingest';
import { metricsRoute } from '../middleware/metrics';
import { incAdmissions } from '../metrics/registry';

// This new factory function connects directly to the database
// instead of a generic 'repo'.
export function submitReceiverRouter(db: Database.Database, opts: {
  headersFile: string;
  minConfs: number;
  bodyMaxSize: number;
}): Router {
  const router = makeRouter();
  const { headersFile, minConfs, bodyMaxSize } = opts;
  let headersIdx: HeadersIndex | null = null;

  // metrics for submit route
  router.use('/submit', metricsRoute('submit'));

  function ensureHeaders(): HeadersIndex {
    if (!headersIdx) headersIdx = loadHeaders(headersFile);
    return headersIdx!;
  }

  function jsonError(res: Response, code: number, error: string, hint?: string) {
    return res.status(code).json({ error, hint });
  }

  router.post('/submit', async (req: Request, res: Response) => {
    try {
      // Your existing request validation logic is preserved
      if (!req.is('application/json')) {
        return jsonError(res, 415, 'unsupported-media-type', 'Use application/json');
      }

      const body = req.body;
      if (!BRC22.isSubmitEnvelope(body)) {
        return jsonError(res, 400, 'invalid-body', 'Expect BRC-22 SubmitEnvelope with rawTx');
      }

      const rawTx = String(body.rawTx || '');
      if (!/^[0-9a-fA-F]{2,}$/.test(rawTx) || rawTx.length > bodyMaxSize * 2) {
        return jsonError(res, 400, 'invalid-rawtx', 'Hex only; enforce body size limit');
      }
      
      if (!body.manifest || typeof body.manifest !== 'object') {
        return jsonError(res, 400, 'invalid-manifest', 'Body.manifest is required (object)');
      }

      const txid = txidFromRawTx(rawTx);

      // Your existing SPV verification logic is also preserved
      let envelopeToPersist: any | undefined = undefined;
      if (body.suggestedEnvelope && typeof body.suggestedEnvelope === 'object') {
        const vr = await verifyEnvelopeAgainstHeaders(
          body.suggestedEnvelope as SPVEnvelope,
          ensureHeaders(),
          minConfs
        );
        if (!vr.ok) {
          return jsonError(res, 409, 'spv-verification-failed', vr.reason || 'invalid-envelope');
        }
        envelopeToPersist = body.suggestedEnvelope;
      }

      // *** THE CORE CHANGE ***
      // We replace the generic `repo.createOrGet` call with the new, specific
      // `ingestSubmission` function which handles all database operations.
      const { versionId, opretVout, tag } = await ingestSubmission({
        db,
        manifest: body.manifest,
        txid,
        rawTx,
        envelopeJson: envelopeToPersist,
      });

      // Count successful admission
      incAdmissions(1);

      // Your existing 'topics' logic is preserved
      const topics = Array.isArray(body.topics) ? body.topics : [];
      const topicsMap: Record<string, number[]> = {};
      for (const t of topics) topicsMap[t] = [0];

      // The response is updated to reflect the data returned by the new service.
      // Note: `id` and `created` are no longer returned, as the upsert logic
      // in the DB layer doesn't provide this. `versionId` is the canonical ID.
      return res.status(200).json({
        status: 'success',
        txid,
        versionId,
        type: tag,
        vout: opretVout,
        topics: topicsMap,
      });

    } catch (e: any) {
      return jsonError(res, 500, 'submit-failed', e?.message || 'unknown-error');
    }
  });

  return router;
}
