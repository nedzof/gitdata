import type { Request, Response } from 'express';
import { BRC22 } from '../brc/index';
import {
  verifyEnvelopeAgainstHeaders,
  loadHeaders,
  type HeadersIndex,
  type SPVEnvelope,
  txidFromRawTx,
} from '../spv/verify-envelope';
import { findFirstOpReturn } from '../utils/opreturn';
import { decodeDLM1 } from '../dlm1/codec';

type DeclarationRecord = { id: string; created: boolean };

type DeclarationsRepo = {
  createOrGet(opts: {
    versionId?: string; // derived from on-chain DLM1 payload
    txid: string;
    type: 'DLM1' | 'TRN1' | 'UNKNOWN';
    txHex: string;
    metadata?: any;
  }): Promise<DeclarationRecord>;
};

// Cache headers index in-process (swap to TTL/mTime in prod)
let headersIdx: HeadersIndex | null = null;

async function ensureHeaders(headersFile: string): Promise<HeadersIndex> {
  if (!headersIdx) headersIdx = loadHeaders(headersFile);
  return headersIdx;
}

function jsonError(res: Response, code: number, error: string, hint?: string) {
  return res.status(code).json({ error, hint });
}

// Extract DLM1 CBOR for both encodings:
// - Single push: push0 = "DLM1" || CBOR
// - Multi  push: push0 = "DLM1", push1 = CBOR
function extractDlm1CborFromPushes(pushesHex: string[], pushesAscii: (string | null)[]): string | null {
  if (!pushesHex.length) return null;
  const tagHex = Buffer.from('DLM1', 'ascii').toString('hex');

  // Multi-push first: explicit tag then CBOR
  if (pushesAscii[0] === 'DLM1' && pushesHex.length >= 2) {
    return pushesHex[1];
  }

  // Single-push: tag prefix followed by CBOR
  const first = pushesHex[0];
  if (first.startsWith(tagHex) && first.length > tagHex.length) {
    return first.slice(tagHex.length);
  }
  return null;
}

export function submitHandlerFactory(opts: {
  repo: DeclarationsRepo;
  headersFile: string; // e.g., "./data/headers.json"
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

      // Parse OP_RETURN (legacy BSV tx format)
      const opret = findFirstOpReturn(rawTx);
      const detected: 'DLM1' | 'TRN1' | 'UNKNOWN' =
        opret?.tagAscii === 'DLM1' ? 'DLM1' :
        opret?.tagAscii === 'TRN1' ? 'TRN1' : 'UNKNOWN';

      // Decode DLM1 → versionId (mh) for both encodings
      let versionId: string | undefined;
      if (opret?.tagAscii === 'DLM1') {
        const cborHex = extractDlm1CborFromPushes(opret.pushesHex, opret.pushesAscii);
        if (cborHex) {
          try {
            const decoded = decodeDLM1(Buffer.from(cborHex, 'hex'));
            versionId = decoded.mh;
          } catch (e) {
            console.warn(`DLM1 decode failed for txid ${txid}`, e);
          }
        }
      }

      // Optional SPV verification if client supplies a full envelope
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

      // Persist (idempotent upsert) using your DB repo
      const rec = await repo.createOrGet({
        versionId,
        txid,
        type: detected,
        txHex: rawTx,
        metadata: body.manifest ?? undefined,
      });

      // Topics echo (filter to hosted set in your Topic Manager if needed)
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
        versionId, // echo for confirmation
      });
    } catch (e: any) {
      return jsonError(res, 500, 'submit-failed', e?.message || 'unknown-error');
    }
  };
}
