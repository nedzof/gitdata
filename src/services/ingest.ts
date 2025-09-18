import Database from 'better-sqlite3';
import {
  upsertDeclaration,
  upsertManifest,
  replaceEdges,
  setOpretVout,
  setProofEnvelope,
} from '../db';
import { deriveManifestIds, extractParents } from '../dlm1/codec';
import { findFirstOpReturn } from '../utils/opreturn';
import { decodeDLM1 } from '../dlm1/codec';

export async function ingestSubmission(opts: {
  db: Database.Database;
  manifest: any;
  txid: string;
  rawTx: string;
  envelopeJson?: any; // optional SPV envelope already verified upstream
}): Promise<{ versionId: string; opretVout: number | null; tag: 'DLM1' | 'TRN1' | 'UNKNOWN' }> {
  const { db, manifest, txid, rawTx, envelopeJson } = opts;

  // 1) Derive canonical IDs (throws if explicit versionId mismatches canonical)
  const { versionId, manifestHash } = deriveManifestIds(manifest);
  const parents = extractParents(manifest);

  // 2) Parse OP_RETURN and try to decode on-chain DLM1 (consistency check)
  const opret = findFirstOpReturn(rawTx);
  let tag: 'DLM1' | 'TRN1' | 'UNKNOWN' = 'UNKNOWN';
  let opretVout: number | null = null;

  if (opret) {
    opretVout = opret.vout;
    tag = opret.tagAscii === 'DLM1' ? 'DLM1' : opret.tagAscii === 'TRN1' ? 'TRN1' : 'UNKNOWN';

    if (tag === 'DLM1' && opret.pushesHex.length > 0) {
      // Single-push: "DLM1||CBOR" or Multi-push: "DLM1", CBOR
      const tagHex = Buffer.from('DLM1', 'ascii').toString('hex');
      let cborHex: string | null = null;
      if (opret.pushesAscii[0] === 'DLM1' && opret.pushesHex[1]) cborHex = opret.pushesHex[1];
      else if (opret.pushesHex[0].startsWith(tagHex)) cborHex = opret.pushesHex[0].slice(tagHex.length);

      if (cborHex && cborHex.length > 0) {
        const decoded = decodeDLM1(Buffer.from(cborHex, 'hex'));
        if (decoded.mh.toLowerCase() !== versionId.toLowerCase()) {
          throw new Error('onchain-mh-mismatch: DLM1.mh != derived manifest hash');
        }
      }
    }
  }

  // 3) Persist manifest row
  upsertManifest(db, {
    version_id: versionId,
    manifest_hash: manifestHash,
    content_hash: manifest?.content?.contentHash || null,
    title: manifest?.description || null, // map description -> title for UI
    license: manifest?.policy?.license || null,
    classification: manifest?.policy?.classification || null,
    created_at: manifest?.provenance?.createdAt || null,
    manifest_json: JSON.stringify(manifest),
  });

  // 4) Persist declaration row
  upsertDeclaration(db, {
    version_id: versionId,
    txid: txid.toLowerCase(),
    type: tag,
    status: 'pending',
    created_at: Math.floor(Date.now() / 1000),
    raw_tx: rawTx,
  } as any);

  if (opretVout !== null) {
    setOpretVout(db, versionId, opretVout);
  }

  // 5) Persist edges
  if (parents.length) {
    replaceEdges(db, versionId, parents);
  }

  // 6) Optionally persist SPV envelope (JSON string)
  if (envelopeJson) {
    setProofEnvelope(db, versionId, JSON.stringify(envelopeJson));
  }

  return { versionId, opretVout, tag };
}
