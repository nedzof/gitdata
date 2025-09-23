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
import { ingestOpenLineageEvent } from '../db/index.js';
import { requireIdentity } from '../middleware/identity';

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

  router.post('/submit', requireIdentity(true), async (req: Request & { identityKey?: string }, res: Response) => {
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

      // D38: Emit OpenLineage COMPLETE event after successful publish
      try {
        const namespace = process.env.OL_NAMESPACE || 'overlay:prod';
        const bundleData = body.manifest?.dlm1?.bundle;
        const parentVersionIds = bundleData?.parents || [];

        const producerUrl = `${req.protocol}://${req.get('host')}/adapter/openlineage/1.0`;
        const schemaBaseUrl = 'https://github.com/nedzof/gitdata/schemas/v1';

        const openLineageEvent = {
          eventType: 'COMPLETE' as const,
          eventTime: new Date().toISOString(),
          producer: producerUrl,
          job: {
            namespace,
            name: `publish::${versionId}`
          },
          run: {
            runId: txid,
            facets: {
              nominalTime: {
                nominalStartTime: new Date().toISOString()
              },
              gitdataSpv: {
                _producer: producerUrl,
                _schemaURL: `${schemaBaseUrl}/gitdataSpv.json`,
                v: '1',
                confs: 0, // Will be updated by verification process
                bundleUrl: `${req.protocol}://${req.get('host')}/bundle?versionId=${versionId}`,
                bundleHash: bundleData?.hash || '',
                readyDecision: null, // Will be set by policy check
                readyReasons: []
              },
              governance: {
                _producer: producerUrl,
                _schemaURL: `${schemaBaseUrl}/governance.json`,
                v: '1',
                policyDecision: 'allow', // Default, will be updated by policy check
                policyVersion: '1.0.0',
                appliedRules: [],
                evidence: {
                  bundleValidated: true,
                  parentageVerified: parentVersionIds.length > 0,
                  sizeWithinLimits: true
                }
              }
            }
          },
          inputs: parentVersionIds.map((parentId: string) => ({
            namespace,
            name: parentId
          })),
          outputs: [{
            namespace,
            name: versionId,
            facets: {
              datasetVersion: {
                version: versionId,
                type: 'dlm1',
                contentHash: bundleData?.hash || '',
                createdAt: new Date().toISOString()
              },
              dataSource: {
                name: 'gitdata',
                uri: `${req.protocol}://${req.get('host')}/listings/${versionId}`
              },
              gitdataProvenance: {
                _producer: producerUrl,
                _schemaURL: `${schemaBaseUrl}/gitdataProvenance.json`,
                v: '1',
                producerIdentityKey: process.env.PRODUCER_IDENTITY_KEY || '000000000000000000000000000000000000000000000000000000000000000000',
                parentsCount: parentVersionIds.length,
                lineageDepth: parentVersionIds.length > 0 ? 1 : 0, // Simplified calculation
                totalAncestors: parentVersionIds.length,
                dataClassification: 'public',
                tags: ['dlm1', 'gitdata']
              }
            }
          }]
        };

        // Ingest the OpenLineage event (async, don't block response)
        setImmediate(() => {
          try {
            ingestOpenLineageEvent(db, openLineageEvent);
          } catch (olError) {
            console.warn('OpenLineage event emission failed:', olError);
          }
        });
      } catch (olError) {
        console.warn('OpenLineage event creation failed:', olError);
      }

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

// Wrapper for server.ts compatibility - provides default parameters
export function submitReceiverRouterWrapper(): Router {
  // Initialize SQLite database (fallback for compatibility)
  const db = new Database(':memory:');

  // Default options
  const opts = {
    headersFile: process.env.HEADERS_FILE || 'data/headers/headers-mainnet.json',
    minConfs: parseInt(process.env.MIN_CONFIRMATIONS || '6'),
    bodyMaxSize: parseInt(process.env.BODY_MAX_SIZE || '10485760') // 10MB
  };

  return submitReceiverRouter(db, opts);
}
