import type { Request, Response } from 'express';
import { BRC22 } from '../brc/index';
import { verifyEnvelopeAgainstHeaders, loadHeaders, type HeadersIndex, type SPVEnvelope } from '../spv/verify-envelope';
import { findFirstOpReturn } from '../utils/opreturn';

type DeclarationsRepo = {
  createOrGet(opts: {
    versionId?: string;
    txid: string;
    type: 'DLM1' | 'TRN1' | 'UNKNOWN';
    txHex: string;
    metadata?: any;
  }): Promise<{ id: string; created: boolean }>;
};

// Minimal in-memory cache of headers; replace with your mirror + TTL strategy.
let headersIdx: HeadersIndex | null = null;

async function ensureHeaders(headersFile: string): Promise<HeadersIndex> {
  if (!headersIdx) {
    headersIdx = loadHeaders(headersFile);
  }
  return headersIdx;
}

function jsonError(res: Response, code: number, error: string, hint?: string) {
  return res.status(code).json({ error, hint });
}

export function submitHandlerFactory(opts: {
  repo: DeclarationsRepo;
  headersFile: string;
  policy: { BODY_MAX_SIZE: number; POLICY_MIN_CONFS: number };
}) {
  const { repo, headersFile, policy } = opts;

  return async function submit(req: Request, res: Response) {
    try {
      if (!req.is('application/json')) {
        return jsonError(res, 415, 'unsupported-media-type', 'Use application/json');
      }
      const body = req.body;
      if (!BRC22.isSubmitEnvelope(body)) {
        return jsonError(res, 400, 'invalid-body', 'Expect BRC-22 SubmitEnvelope with rawTx');
      }
      const rawTx = String(body.rawTx || '');
      if (!/^[0-9a-fA-F]{2,}$/.test(rawTx) || rawTx.length > policy.BODY_MAX_SIZE * 2) {
        return jsonError(res, 400, 'invalid-rawtx', 'Hex only; enforce body size limit');
      }

      const txid = require('../spv/verify-envelope').txidFromRawTx(rawTx);
      
      // Use the robust OP_RETURN parser
      const opret = findFirstOpReturn(rawTx);
      const detected = opret?.tagAscii === 'DLM1' || opret?.tagAscii === 'TRN1' ? opret.tagAscii : 'UNKNOWN';

      // Optional SPV check at submit-time (only if you provide a complete envelope here).
      // If you want to verify now, send an SPVEnvelope-like object inside body.suggestedEnvelope.
      if (body.suggestedEnvelope) {
        const idx = await ensureHeaders(headersFile);
        const result = await verifyEnvelopeAgainstHeaders(
          body.suggestedEnvelope as SPVEnvelope,
          idx,
          policy.POLICY_MIN_CONFS,
        );
        if (!result.ok) {
          return jsonError(res, 409, 'spv-verification-failed', result.reason);
        }
      }

      // Persist (idempotent upsert). You already have actual DB migrations; this is just the call surface.
      const rec = await repo.createOrGet({
        versionId: undefined, // If you parse DLM1 payload, put its mh/versionId here
        txid,
        type: detected,
        txHex: rawTx,
        metadata: body.manifest ?? undefined,
      });

      // BRC-22 response with topics echo
      const topics = Array.isArray(body.topics) ? body.topics : [];
      // Admit only hosted topics in your Topic Manager; here we echo all for simplicity.
      const topicsMap: Record<string, number[]> = {};
      for (const t of topics) topicsMap[t] = [0]; // e.g., "we admitted output 0" (illustrative)

      return res.status(200).json({
        status: 'success',
        txid,
        id: rec.id,
        created: rec.created,
        topics: topicsMap,
        type: detected,
      });
    } catch (e: any) {
      return jsonError(res, 500, 'submit-failed', e?.message || 'unknown-error');
    }
  };
}
