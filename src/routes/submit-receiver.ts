import type { Request, Response } from 'express';
import { BRC22 } from '../brc/index';
import { verifyEnvelopeAgainstHeaders, loadHeaders, type HeadersIndex, type SPVEnvelope, txidFromRawTx } from '../spv/verify-envelope';
import { findFirstOpReturn } from '../utils/opreturn';
// ---> ADD THIS IMPORT
import { decodeDLM1 } from '../dlm1/codec'; 

type DeclarationsRepo = {
  createOrGet(opts: {
    versionId?: string; // Now we can populate this!
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

      const txid = txidFromRawTx(rawTx);
      
      const opret = findFirstOpReturn(rawTx);
      const detected = opret?.tagAscii === 'DLM1' || opret?.tagAscii === 'TRN1' ? opret.tagAscii : 'UNKNOWN';

      // ---> ADD THIS DECODING LOGIC
      let versionId: string | undefined = undefined;
      if (opret && opret.tagAscii === 'DLM1' && opret.pushesHex[0]) {
        try {
          // The first push is "DLM1" + CBOR hex. We need to strip the tag.
          const tagHex = Buffer.from('DLM1', 'ascii').toString('hex');
          const cborHex = opret.pushesHex[0].slice(tagHex.length);
          const decoded = decodeDLM1(Buffer.from(cborHex, 'hex'));
          versionId = decoded.mh; // Extract the manifest hash (versionId)
        } catch (decodeErr) {
          console.warn(`Failed to decode DLM1 payload for txid ${txid}`, decodeErr);
          // Proceed without versionId, but log the issue.
        }
      }

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

      const rec = await repo.createOrGet({
        versionId, // ---> PASS THE DECODED versionId HERE
        txid,
        type: detected,
        txHex: rawTx,
        metadata: body.manifest ?? undefined,
      });

      const topics = Array.isArray(body.topics) ? body.topics : [];
      const topicsMap: Record<string, number[]> = {};
      for (const t of topics) topicsMap[t] = [0];

      return res.status(200).json({
        status: 'success',
        txid,
        id: rec.id,
        created: rec.created,
        topics: topicsMap,
        type: detected,
        // Also return the versionId for confirmation
        versionId: versionId,
      });
    } catch (e: any) {
      return jsonError(res, 500, 'submit-failed', e?.message || 'unknown-error');
    }
  };
}
